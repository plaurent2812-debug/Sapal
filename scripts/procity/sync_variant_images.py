#!/usr/bin/env python3
"""
Synchronise les images des variants Procity depuis procity.eu vers Supabase Storage.

Objectif : remplir le champ `product_variants.images` pour tous les variants
qui ont actuellement `images: []`, en téléchargeant l'image du bon coloris/structure
depuis Procity et en l'uploadant dans Supabase Storage (bucket `products`).

Comportement :
  - Ne touche QUE les variants avec images vides (skip sinon)
  - Ne modifie AUCUN autre champ (prix, nom, description, specs)
  - Pour chaque variant, recherche la page Procity via l'Excel tarif (ref parent)
  - Récupère l'image via l'API interne Procity /open_api/product/image/{variantId}
  - Si Procity n'a pas d'image pour ce variant : skip (option C — pas de recolorisation)

Usage :
    python3 sync_variant_images.py --dry-run          # ne fait que lister
    python3 sync_variant_images.py --limit 5          # teste sur 5 produits
    python3 sync_variant_images.py --product 1072     # un produit précis
    python3 sync_variant_images.py                    # tout en une passe
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Excel indexer local
from excel_index import build_index, get_variant_data

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent.parent  # Site internet/
load_dotenv(ROOT / ".env.local")

# Mapping d'URLs Procity cassées → URLs corrigées
_URL_OVERRIDES_PATH = Path(__file__).parent / "broken_urls_resolved.json"
URL_OVERRIDES: dict[str, str] = {}
if _URL_OVERRIDES_PATH.exists():
    try:
        URL_OVERRIDES = json.loads(_URL_OVERRIDES_PATH.read_text())
    except Exception:
        URL_OVERRIDES = {}

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "products"
STORAGE_PREFIX = "procity"  # chemins = procity/{product_id}/{variant_ref}.jpg

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
http = requests.Session()
http.headers.update(HEADERS)

JS_VAR_RE_PSES = re.compile(r"var\s+PSES\s*=\s*(\[.*?\])\s*;", re.DOTALL)

# Cache des PSES par URL (évite de re-télécharger la page Procity plusieurs fois)
_pses_cache: dict[str, dict[str, int]] = {}


# -----------------------------------------------------------------------------
# Procity scraping
# -----------------------------------------------------------------------------


def get_procity_variants_map(procity_url: str) -> dict[str, int]:
    """
    Depuis une URL Procity, retourne {ref_variant: procity_variant_id}.
    Ex: {"206200.9005": 32625, "206200.3004": 32620, ...}
    """
    if procity_url in _pses_cache:
        return _pses_cache[procity_url]

    try:
        r = http.get(procity_url, timeout=20)
        r.raise_for_status()
        m = JS_VAR_RE_PSES.search(r.text)
        if not m:
            _pses_cache[procity_url] = {}
            return {}
        pses = json.loads(m.group(1))
        mapping = {p["ref"]: p["id"] for p in pses}
        _pses_cache[procity_url] = mapping
        return mapping
    except Exception as e:
        print(f"   ⚠ Erreur fetch {procity_url}: {e}")
        _pses_cache[procity_url] = {}
        return {}


def fetch_variant_image_url(procity_variant_id: int) -> str | None:
    """Appelle l'API Procity pour récupérer l'URL de la 1ère image du variant."""
    try:
        r = http.get(
            f"https://www.procity.eu/fr/open_api/product/image/{procity_variant_id}",
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if data and isinstance(data, list) and data[0].get("image_url"):
            return data[0]["image_url"]
    except Exception:
        pass
    return None


def download_image_bytes(url: str) -> tuple[bytes, str] | None:
    """Télécharge l'image, retourne (bytes, content_type)."""
    try:
        # Normalise : la page utilise souvent procity.eu/fr/cache/... mais l'hôte
        # canonique est www.procity.eu
        if url.startswith("/"):
            url = f"https://www.procity.eu{url}"
        r = http.get(url, timeout=20)
        r.raise_for_status()
        ct = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        return r.content, ct
    except Exception as e:
        print(f"   ⚠ DL failed {url}: {e}")
        return None


# -----------------------------------------------------------------------------
# Supabase Storage
# -----------------------------------------------------------------------------


def extension_from_url(url: str, content_type: str = "image/jpeg") -> str:
    """Retourne une extension propre (.jpg / .webp) pour le fichier stocké."""
    ext = Path(urlparse(url).path).suffix.lower()
    if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ".jpg" if ext == ".jpeg" else ext
    # Fallback depuis content-type
    mapping = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    return mapping.get(content_type, ".jpg")


def upload_to_storage(
    sb: Client, product_id: str, variant_ref: str, data: bytes, ext: str
) -> str:
    """Upload l'image et retourne l'URL publique."""
    # Sanitize variant_ref pour storage (pas de caractères spéciaux)
    safe_ref = re.sub(r"[^a-zA-Z0-9._-]", "_", variant_ref)
    path = f"{STORAGE_PREFIX}/{product_id}/{safe_ref}{ext}"

    content_type_map = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}
    content_type = content_type_map.get(ext, "image/jpeg")

    try:
        sb.storage.from_(BUCKET).upload(
            path=path,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as e:
        # Si déjà présent, tente un update
        try:
            sb.storage.from_(BUCKET).update(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "true"},
            )
        except Exception:
            raise e

    public_url = sb.storage.from_(BUCKET).get_public_url(path)
    # Retire le query string par défaut ("?")
    return public_url.rstrip("?")


# -----------------------------------------------------------------------------
# Main sync
# -----------------------------------------------------------------------------


def process_variant(
    sb: Client,
    variant: dict,
    excel_idx: dict,
    dry_run: bool,
    stats: dict,
) -> None:
    ref = variant["reference"]
    product_id = variant["product_id"]

    # Étape 1 : trouver la page Procity depuis l'Excel via la ref parent
    excel = get_variant_data(excel_idx, ref)
    if not excel or not excel.get("url"):
        stats["no_excel"] += 1
        return

    procity_url = URL_OVERRIDES.get(excel["url"], excel["url"])

    # Étape 2 : récupérer le mapping {ref: variant_id} de la page
    variant_map = get_procity_variants_map(procity_url)
    if not variant_map:
        stats["no_pses"] += 1
        return

    procity_id = variant_map.get(ref)
    if not procity_id:
        # Le variant existe en Supabase mais pas dans PSES Procity
        # (peut-être un ancien variant supprimé côté Procity)
        stats["no_procity_variant"] += 1
        return

    # Étape 3 : récupérer l'URL de l'image pour ce variant
    image_url = fetch_variant_image_url(procity_id)
    if not image_url:
        stats["no_image_procity"] += 1
        return

    if dry_run:
        stats["would_upload"] += 1
        if stats["would_upload"] <= 10:
            print(f"   [DRY] {ref:20s} ← {image_url[-60:]}")
        return

    # Étape 4 : download + upload Storage
    dl = download_image_bytes(image_url)
    if not dl:
        stats["dl_failed"] += 1
        return
    data, ct = dl
    ext = extension_from_url(image_url, ct)

    try:
        public_url = upload_to_storage(sb, product_id, ref, data, ext)
    except Exception as e:
        print(f"   ✗ Upload failed {ref}: {e}")
        stats["upload_failed"] += 1
        return

    # Étape 5 : update Supabase
    try:
        sb.table("product_variants").update({"images": [public_url]}).eq("id", variant["id"]).execute()
        stats["uploaded"] += 1
        if stats["uploaded"] % 20 == 0:
            print(f"   ✓ {stats['uploaded']} uploadés…")
    except Exception as e:
        print(f"   ✗ DB update failed {ref}: {e}")
        stats["db_update_failed"] += 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Procity images → Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Simule sans uploader")
    parser.add_argument("--limit", type=int, help="Limiter à N variants (pour test)")
    parser.add_argument("--product", type=str, help="Traiter un seul product_id")
    parser.add_argument("--ref-prefix", type=str, help="Filtrer par préfixe de ref (ex: 206200)")
    parser.add_argument("--workers", type=int, default=4, help="Nombre de threads parallèles")
    args = parser.parse_args()

    print("📥 Indexation Excel Procity…")
    excel_idx = build_index()
    print(f"   ✓ {len(excel_idx)} refs parent indexées")

    print("\n🔌 Connexion Supabase…")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Récupère les variants à traiter
    print("\n🔍 Recherche variants sans images…")
    query = sb.table("product_variants").select("id, reference, product_id, label").eq("images", "[]")
    if args.product:
        query = query.eq("product_id", args.product)

    # Paginer (Supabase limite 1000 lignes par défaut)
    all_variants = []
    offset = 0
    while True:
        batch = query.range(offset, offset + 999).execute()
        if not batch.data:
            break
        all_variants.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000

    # Filtrer par préfixe si demandé
    if args.ref_prefix:
        all_variants = [v for v in all_variants if v["reference"].startswith(args.ref_prefix)]

    if args.limit:
        all_variants = all_variants[: args.limit]

    print(f"   ✓ {len(all_variants)} variants à traiter")

    if not all_variants:
        print("\n✅ Rien à faire.")
        return 0

    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"\n🚀 Démarrage en mode {mode}…")
    t0 = time.time()

    stats = {
        "total": len(all_variants),
        "uploaded": 0,
        "would_upload": 0,
        "no_excel": 0,
        "no_pses": 0,
        "no_procity_variant": 0,
        "no_image_procity": 0,
        "dl_failed": 0,
        "upload_failed": 0,
        "db_update_failed": 0,
    }

    # Tri par URL Procity pour maximiser le cache _pses_cache
    # (tous les variants d'une même URL seront traités à la suite)
    def url_key(v):
        excel = get_variant_data(excel_idx, v["reference"])
        return (excel.get("url") if excel else None) or "zzz"

    all_variants.sort(key=url_key)

    # Traitement séquentiel pour maîtriser le cache PSES + éviter rate limit
    for i, v in enumerate(all_variants, 1):
        if i % 50 == 0:
            elapsed = time.time() - t0
            rate = i / elapsed if elapsed > 0 else 0
            eta = (len(all_variants) - i) / rate if rate > 0 else 0
            print(f"   [{i}/{len(all_variants)}] ~{rate:.1f}/s · ETA {eta/60:.1f}min")

        process_variant(sb, v, excel_idx, args.dry_run, stats)
        # Petit throttle pour ne pas surcharger Procity
        time.sleep(0.05)

    elapsed = time.time() - t0
    print(f"\n{'='*70}")
    print(f"✅ Terminé en {elapsed/60:.1f} minutes")
    print(f"{'='*70}")
    print(f"  Total variants traités      : {stats['total']}")
    if args.dry_run:
        print(f"  ✓ Uploadables (dry-run)     : {stats['would_upload']}")
    else:
        print(f"  ✓ Uploadés avec succès      : {stats['uploaded']}")
    print(f"  — Refs absentes Excel       : {stats['no_excel']}")
    print(f"  — Pages sans PSES           : {stats['no_pses']}")
    print(f"  — Variants absents Procity  : {stats['no_procity_variant']}")
    print(f"  — Pas d'image Procity (option C) : {stats['no_image_procity']}")
    if not args.dry_run:
        print(f"  ✗ Erreurs téléchargement    : {stats['dl_failed']}")
        print(f"  ✗ Erreurs upload Storage    : {stats['upload_failed']}")
        print(f"  ✗ Erreurs update DB         : {stats['db_update_failed']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

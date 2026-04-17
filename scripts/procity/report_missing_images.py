#!/usr/bin/env python3
"""
Génère un rapport CSV des variants sans images, avec la raison probable du skip.

Colonnes :
  - variant_id, reference, product_id, product_name, category_slug, label
  - coloris, dimensions, finition
  - ref_parent (calculée depuis reference)
  - excel_found (bool) : ref_parent présente dans l'Excel ?
  - procity_url (si excel_found)
  - url_http_status : 200/404/500/...
  - has_pses (bool) : PSES présent dans la page ?
  - procity_variant_id : id Procity trouvé dans PSES (ou null)
  - has_image_procity : l'API renvoie-t-elle une image ?
  - reason : code standardisé (NO_EXCEL, URL_404, URL_500, NO_PSES, NO_PROCITY_VARIANT, NO_IMAGE_PROCITY)
  - notes

Usage :
    python3 report_missing_images.py
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client

from excel_index import build_index, get_variant_data

ROOT = Path(__file__).parent.parent.parent
load_dotenv(ROOT / ".env.local")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
http = requests.Session()
http.headers.update(HEADERS)

JS_VAR_RE_PSES = re.compile(r"var\s+PSES\s*=\s*(\[.*?\])\s*;", re.DOTALL)

_page_cache: dict[str, dict] = {}


def probe_page(url: str) -> dict:
    """Télécharge la page, retourne {status, pses_map, error}"""
    if url in _page_cache:
        return _page_cache[url]
    try:
        r = http.get(url, timeout=15)
        result = {"status": r.status_code, "pses_map": {}, "error": None}
        if r.status_code == 200:
            m = JS_VAR_RE_PSES.search(r.text)
            if m:
                pses = json.loads(m.group(1))
                result["pses_map"] = {p["ref"]: p["id"] for p in pses}
        _page_cache[url] = result
        return result
    except Exception as e:
        result = {"status": 0, "pses_map": {}, "error": str(e)}
        _page_cache[url] = result
        return result


def check_image_api(variant_id: int) -> bool:
    try:
        r = http.get(f"https://www.procity.eu/fr/open_api/product/image/{variant_id}", timeout=10)
        if r.status_code == 200:
            data = r.json()
            return bool(data and isinstance(data, list) and data[0].get("image_url"))
    except Exception:
        pass
    return False


def main() -> int:
    print("📥 Indexation Excel…")
    excel_idx = build_index()
    print(f"   ✓ {len(excel_idx)} refs parent indexées")

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    print("\n🔍 Variants sans images…")
    all_variants = []
    offset = 0
    while True:
        b = sb.table("product_variants").select(
            "id, reference, product_id, label, coloris, dimensions, finition"
        ).eq("images", "[]").range(offset, offset + 999).execute()
        if not b.data:
            break
        all_variants.extend(b.data)
        if len(b.data) < 1000:
            break
        offset += 1000
    print(f"   ✓ {len(all_variants)} à analyser")

    # Charger noms produits + catégories
    product_ids = sorted({v["product_id"] for v in all_variants})
    pmap = {}
    for i in range(0, len(product_ids), 500):
        batch = sb.table("products").select("id, name, slug, category_id").in_(
            "id", product_ids[i:i + 500]
        ).execute()
        for p in batch.data:
            pmap[p["id"]] = p
    cats = sb.table("categories").select("id, slug").execute()
    cmap = {c["id"]: c["slug"] for c in cats.data}

    # Analyser chaque variant
    rows = []
    t0 = time.time()
    for i, v in enumerate(all_variants, 1):
        if i % 100 == 0:
            rate = i / (time.time() - t0)
            eta = (len(all_variants) - i) / rate if rate else 0
            print(f"   [{i}/{len(all_variants)}] ~{rate:.1f}/s · ETA {eta/60:.1f}min")

        ref = v["reference"]
        ref_parent = ref.split(".")[0] if "." in ref else ref
        p = pmap.get(v["product_id"], {})
        cat = cmap.get(p.get("category_id"), "")

        excel = get_variant_data(excel_idx, ref)
        row = {
            "variant_id": v["id"],
            "reference": ref,
            "ref_parent": ref_parent,
            "product_id": v["product_id"],
            "product_name": p.get("name", ""),
            "category_slug": cat,
            "product_url_sapal": f"https://sapal-site.vercel.app/catalogue/{cat}/{p.get('slug','')}" if cat and p.get("slug") else "",
            "label": v.get("label", ""),
            "coloris": v.get("coloris", ""),
            "dimensions": v.get("dimensions", ""),
            "finition": v.get("finition", ""),
            "excel_found": bool(excel),
            "procity_url": excel.get("url") if excel else "",
            "url_http_status": "",
            "has_pses": "",
            "procity_variant_id": "",
            "has_image_procity": "",
            "reason": "",
            "notes": "",
        }

        if not excel:
            row["reason"] = "NO_EXCEL"
            row["notes"] = "Référence absente du tarif Excel (produit spécial, miroir industriel, retiré ?)"
            rows.append(row)
            continue

        if not excel.get("url"):
            row["reason"] = "NO_URL_EXCEL"
            row["notes"] = "Tarif Excel sans URL Procity"
            rows.append(row)
            continue

        page = probe_page(excel["url"])
        row["url_http_status"] = str(page["status"])
        row["has_pses"] = str(bool(page["pses_map"]))

        if page["status"] == 404:
            row["reason"] = "URL_404"
            row["notes"] = "Page Procity n'existe plus — slug peut avoir changé"
            rows.append(row)
            continue
        if page["status"] >= 500:
            row["reason"] = f"URL_{page['status']}"
            row["notes"] = f"Erreur serveur Procity ({page['error'] or ''})"[:200]
            rows.append(row)
            continue
        if page["status"] != 200:
            row["reason"] = f"URL_{page['status']}"
            rows.append(row)
            continue

        if not page["pses_map"]:
            row["reason"] = "NO_PSES"
            row["notes"] = "Page sans variable JS PSES (produit simple sans variants ?)"
            rows.append(row)
            continue

        procity_id = page["pses_map"].get(ref)
        if not procity_id:
            row["reason"] = "NO_PROCITY_VARIANT"
            row["notes"] = f"Variant {ref} absent de PSES ({len(page['pses_map'])} variants sur la page)"
            rows.append(row)
            continue
        row["procity_variant_id"] = procity_id

        has_img = check_image_api(procity_id)
        row["has_image_procity"] = str(has_img)
        if not has_img:
            row["reason"] = "NO_IMAGE_PROCITY"
            row["notes"] = "Procity expose ce variant mais n'a pas d'image (option C)"
        else:
            row["reason"] = "RETRY_POSSIBLE"
            row["notes"] = "Procity a une image — relancer sync_variant_images.py devrait marcher"

        rows.append(row)

    # Écrire CSV
    out = Path(__file__).parent / "missing_images_report.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    # Stats récap
    reasons = {}
    for r in rows:
        reasons[r["reason"]] = reasons.get(r["reason"], 0) + 1

    print(f"\n✅ Rapport : {out}")
    print(f"\n── Répartition par raison ──")
    for reason, count in sorted(reasons.items(), key=lambda x: -x[1]):
        print(f"   {reason:25s} {count:5d}")

    # Export séparé des produits Procity avec URL 404/500 pour recherche B
    broken = [r for r in rows if r["reason"] in {"URL_404", "URL_500", "URL_503", "URL_502"}]
    if broken:
        broken_urls = sorted({r["procity_url"] for r in broken if r["procity_url"]})
        broken_out = Path(__file__).parent / "broken_procity_urls.txt"
        broken_out.write_text("\n".join(broken_urls), encoding="utf-8")
        print(f"\n── URLs Procity cassées (pour recherche B) ──")
        print(f"   {len(broken_urls)} URLs distinctes → {broken_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Inspection Procity — phase 1 (aucun upsert, juste dump JSON)

Pour chaque URL Procity de l'échantillon :
  - Télécharge la page HTML
  - Extrait PSES, ATTRIBUTES, PRODUCT_ID (variables JS inline)
  - Parse le H1 (nom)
  - Parse les sections <details class="Concertina">
      -> "Caractéristiques techniques" en paires clé/valeur
      -> "Description" en texte long
  - Pour chaque variant (PSE), appelle /fr/open_api/product/image/{id}
    et récupère la liste des images

Sortie : un fichier JSON par URL + un JSON global récapitulatif.
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

SAMPLE_URLS = [
    "https://www.procity.eu/fr/abri-chariots-modulo-1.html",
    "https://www.procity.eu/fr/abri-v%C3%A9los-milan.html",
    "https://www.procity.eu/fr/barriere-main-courante-lisbonne.html",
    "https://www.procity.eu/fr/corbeille-turin-tri-sélectif-2-x-100-litres.html",
    "https://www.procity.eu/fr/banquette-silaos-acier-et-plastique-recyclé.html",
]

OUT_DIR = Path(__file__).parent / "output_inspect"
OUT_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
}

session = requests.Session()
session.headers.update(HEADERS)


# -----------------------------------------------------------------------------
# Extraction helpers
# -----------------------------------------------------------------------------

JS_VAR_RE = {
    "PRODUCT_ID": re.compile(r"var\s+PRODUCT_ID\s*=\s*(\d+)\s*;"),
    "PSES": re.compile(r"var\s+PSES\s*=\s*(\[.*?\])\s*;", re.DOTALL),
    "ATTRIBUTES": re.compile(r"var\s+ATTRIBUTES\s*=\s*(\[.*?\])\s*;", re.DOTALL),
}


def extract_js_globals(html: str) -> dict[str, Any]:
    """Extrait PRODUCT_ID, PSES, ATTRIBUTES depuis les <script> inline."""
    out: dict[str, Any] = {}
    for key, pattern in JS_VAR_RE.items():
        m = pattern.search(html)
        if not m:
            out[key] = None
            continue
        raw = m.group(1)
        if key == "PRODUCT_ID":
            out[key] = int(raw)
        else:
            try:
                out[key] = json.loads(raw)
            except json.JSONDecodeError as e:
                out[key] = {"_parse_error": str(e), "_raw_head": raw[:300]}
    return out


def extract_sections(soup: BeautifulSoup) -> dict[str, Any]:
    """Extrait les sections <details class="Concertina"> (specs + description)."""
    sections: dict[str, Any] = {}
    for concertina in soup.select(".Concertina"):
        title_el = concertina.select_one("h2, h3")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)

        content = concertina.select_one(".Concertina__content")
        if not content:
            sections[title] = {"raw": ""}
            continue

        grid = content.select_one(".grid")
        if grid:
            pairs: list[dict[str, str]] = []
            notes: list[str] = []
            for item in grid.find_all(recursive=False):
                kids = item.find_all(recursive=False)
                if len(kids) >= 2:
                    k = kids[0].get_text(" ", strip=True)
                    v = kids[1].get_text(" ", strip=True)
                    v = re.sub(r"\s+", " ", v)
                    pairs.append({"k": k, "v": v})
                else:
                    txt = item.get_text(" ", strip=True)
                    if txt:
                        notes.append(re.sub(r"\s+", " ", txt))
            sections[title] = {"pairs": pairs, "notes": notes}
        else:
            sections[title] = {
                "text": re.sub(r"\s+", " ", content.get_text(" ", strip=True))
            }
    return sections


def fetch_variant_images(variant_id: int) -> list[str]:
    """Appelle l'API interne Procity pour récupérer les URLs d'images d'un variant."""
    url = f"https://www.procity.eu/fr/open_api/product/image/{variant_id}"
    r = session.get(url, timeout=15)
    r.raise_for_status()
    data = r.json()
    return [item["image_url"] for item in data if "image_url" in item]


# -----------------------------------------------------------------------------
# Per-URL pipeline
# -----------------------------------------------------------------------------


def build_color_struct_labels(attributes: list[dict]) -> dict[int, dict[int, str]]:
    """
    Renvoie un dict {attr_id -> {value_id -> label}} pour tous les attributs
    non vides (permet de décoder la `combination` de chaque PSE).
    """
    mapping: dict[int, dict[int, str]] = {}
    for attr in attributes or []:
        if attr.get("values"):
            mapping[attr["id"]] = {
                v["id"]: v["label"] for v in attr["values"]
            }
    return mapping


def describe_variant(pse: dict, attr_labels: dict[int, dict[int, str]],
                     attr_titles: dict[int, str]) -> dict[str, Any]:
    """Décode la combinaison d'attributs d'un variant en libellés lisibles."""
    combo = {}
    for attr_id, value_id in pse.get("combination", {}).items():
        attr_id_int = int(attr_id)
        title = attr_titles.get(attr_id_int, f"attr_{attr_id_int}")
        label = attr_labels.get(attr_id_int, {}).get(value_id, f"val_{value_id}")
        combo[title] = label
    return {
        "id": pse["id"],
        "ref": pse["ref"],
        "isDefault": pse.get("isDefault", False),
        "weight": pse.get("weight"),
        "quantity": pse.get("quantity"),
        "disponibility": pse.get("disponibility"),
        "combination": combo,
    }


def inspect_url(url: str) -> dict[str, Any]:
    print(f"\n→ {url}")
    t0 = time.time()

    r = session.get(url, timeout=20)
    r.raise_for_status()
    html = r.text

    soup = BeautifulSoup(html, "lxml")

    h1 = soup.select_one("h1")
    name = h1.get_text(strip=True) if h1 else None

    js_globals = extract_js_globals(html)
    sections = extract_sections(soup)

    attrs = js_globals.get("ATTRIBUTES") or []
    pses = js_globals.get("PSES") or []

    attr_labels = build_color_struct_labels(attrs)
    attr_titles = {a["id"]: a["title"] for a in attrs}

    variants: list[dict[str, Any]] = []
    for pse in pses:
        v = describe_variant(pse, attr_labels, attr_titles)
        try:
            v["images"] = fetch_variant_images(pse["id"])
        except Exception as e:
            v["images_error"] = str(e)
            v["images"] = []
        variants.append(v)
        time.sleep(0.2)  # rate-limit soft

    # Construit une description markdown-friendly si on a la section "Description"
    description_section = sections.get("Description")
    description_text = None
    if description_section:
        if "text" in description_section:
            description_text = description_section["text"]
        elif "pairs" in description_section:
            description_text = " ".join(
                f"{p['k']}: {p['v']}" for p in description_section["pairs"]
            )

    # Construit les specs en JSON à partir de "Caractéristiques techniques"
    specs: dict[str, str] = {}
    tech = sections.get("Caractéristiques techniques")
    if tech and "pairs" in tech:
        for p in tech["pairs"]:
            key = normalize_key(p["k"])
            specs[key] = p["v"]

    # Récupère les images du produit par défaut (galerie sans cliquer)
    main_image = None
    for img in soup.select("img"):
        src = img.get("src") or ""
        if "/cache/images/Product/" in src or "/cache/images/product/" in src:
            main_image = src
            break

    result = {
        "url": url,
        "name": name,
        "product_id": js_globals.get("PRODUCT_ID"),
        "main_image": main_image,
        "description": description_text,
        "specifications": specs,
        "raw_specs_pairs": tech.get("pairs") if tech else None,
        "raw_sections_found": list(sections.keys()),
        "attributes_active": [
            {"id": a["id"], "title": a["title"], "nbValues": len(a.get("values", []))}
            for a in attrs if a.get("values")
        ],
        "variants": variants,
        "elapsed_sec": round(time.time() - t0, 2),
    }

    print(
        f"   ✓ {name!r} — {len(variants)} variants — "
        f"{sum(len(v.get('images', [])) for v in variants)} images — "
        f"{result['elapsed_sec']}s"
    )
    return result


def normalize_key(k: str) -> str:
    """Convertit un label FR en snake_case ASCII pour jsonb."""
    import unicodedata

    s = unicodedata.normalize("NFD", k)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # strip accents
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main() -> int:
    urls = sys.argv[1:] or SAMPLE_URLS
    all_results = []
    for url in urls:
        try:
            result = inspect_url(url)
        except Exception as e:
            print(f"   ✗ ERROR: {e}")
            result = {"url": url, "error": str(e)}
        all_results.append(result)

        # Écrit un fichier par URL (nom basé sur le slug)
        slug = url.rsplit("/", 1)[-1].replace(".html", "")
        (OUT_DIR / f"{slug}.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # Récap global
    summary_path = OUT_DIR / "_summary.json"
    summary_path.write_text(
        json.dumps(all_results, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\n✅ Résultats écrits dans {OUT_DIR}/")
    print(f"   Récap : {summary_path}")

    # Petit résumé console
    print("\n─── Résumé ───")
    for r in all_results:
        if "error" in r:
            print(f"  ✗ {r['url']}  →  {r['error']}")
        else:
            specs_n = len(r.get("specifications") or {})
            print(
                f"  ✓ {r['name']:60s} "
                f"{len(r['variants']):>3} variants · "
                f"{specs_n:>2} specs · "
                f"desc={'yes' if r.get('description') else 'no '}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

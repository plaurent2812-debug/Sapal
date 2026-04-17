#!/usr/bin/env python3
"""
Preview local — phase de validation avant upsert Supabase.

Pour chaque URL Procity :
  1. Extrait nom, description, specs, variants, images (réutilise la logique d'inspect)
  2. Télécharge les images dans output_preview/images/ pour rendu offline
  3. Génère un HTML unique output_preview/preview.html qui affiche
     chaque produit comme s'il était sur le site : photo principale,
     description, tableau de specs, grille de variants avec vignettes coloris.

Usage :
    python3 preview_local.py            # utilise l'échantillon par défaut
    python3 preview_local.py url1 url2  # URLs custom
"""

from __future__ import annotations

import hashlib
import html as html_mod
import json
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

SAMPLE_URLS = [
    "https://procity.eu/fr/fourreau-d-amovibilite-simple.html",
    "https://procity.eu/fr/arceau-renforcé-galva-ø60mm.html",
    "https://procity.eu/fr/borne-agora.html",
    "https://procity.eu/fr/corbeille-arc-en-ciel-50-litres.html",
    "https://procity.eu/fr/accoudoir-central-pour-banc-silaos.html",
    "https://procity.eu/fr/bac-à-palmier-acier-et-bois-province-agora.html",
    "https://procity.eu/fr/abri-velo-demi-lune.html",
    "https://procity.eu/fr/appui-cycles-lisbonne.html",
    "https://procity.eu/fr/bandeau-signaletique-horizon.html",
    "https://procity.eu/fr/abri-fumeurs-milan.html",
]

OUT_DIR = Path(__file__).parent / "output_preview"
IMG_DIR = OUT_DIR / "images"
OUT_DIR.mkdir(exist_ok=True)
IMG_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9",
}

session = requests.Session()
session.headers.update(HEADERS)

JS_VAR_RE = {
    "PRODUCT_ID": re.compile(r"var\s+PRODUCT_ID\s*=\s*(\d+)\s*;"),
    "PSES": re.compile(r"var\s+PSES\s*=\s*(\[.*?\])\s*;", re.DOTALL),
    "ATTRIBUTES": re.compile(r"var\s+ATTRIBUTES\s*=\s*(\[.*?\])\s*;", re.DOTALL),
}


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def normalize_key(k: str) -> str:
    s = unicodedata.normalize("NFD", k)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


def extract_js_globals(html_text: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, pattern in JS_VAR_RE.items():
        m = pattern.search(html_text)
        if not m:
            out[key] = None
            continue
        raw = m.group(1)
        out[key] = int(raw) if key == "PRODUCT_ID" else json.loads(raw)
    return out


def extract_sections(soup: BeautifulSoup) -> dict[str, Any]:
    sections: dict[str, Any] = {}
    for concertina in soup.select(".Concertina"):
        title_el = concertina.select_one("h2, h3")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        content = concertina.select_one(".Concertina__content")
        if not content:
            continue
        grid = content.select_one(".grid")
        if grid:
            pairs, notes = [], []
            for item in grid.find_all(recursive=False):
                kids = item.find_all(recursive=False)
                if len(kids) >= 2:
                    pairs.append({
                        "k": kids[0].get_text(" ", strip=True),
                        "v": re.sub(r"\s+", " ", kids[1].get_text(" ", strip=True)),
                    })
                else:
                    txt = item.get_text(" ", strip=True)
                    if txt:
                        notes.append(re.sub(r"\s+", " ", txt))
            sections[title] = {"pairs": pairs, "notes": notes}
        else:
            sections[title] = {"text": re.sub(r"\s+", " ", content.get_text(" ", strip=True))}
    return sections


def fetch_variant_images(variant_id: int) -> list[str]:
    url = f"https://www.procity.eu/fr/open_api/product/image/{variant_id}"
    try:
        r = session.get(url, timeout=15)
        r.raise_for_status()
        return [item["image_url"] for item in r.json() if "image_url" in item]
    except Exception:
        return []


def find_main_image(soup: BeautifulSoup) -> str | None:
    for img in soup.select("img"):
        src = img.get("src") or ""
        if "/cache/images/product/" in src.lower():
            return src
    return None


def download_image(url: str) -> str | None:
    """Télécharge l'image, retourne le chemin relatif depuis output_preview/."""
    try:
        ext = Path(urlparse(url).path).suffix or ".jpg"
        # Nom déterministe pour ne pas re-télécharger
        h = hashlib.md5(url.encode()).hexdigest()[:16]
        fname = f"{h}{ext}"
        path = IMG_DIR / fname
        if not path.exists():
            r = session.get(url, timeout=20)
            r.raise_for_status()
            path.write_bytes(r.content)
        return f"images/{fname}"
    except Exception as e:
        print(f"   ⚠ image failed {url}: {e}")
        return None


def describe_variant(pse: dict, attr_labels, attr_titles) -> dict[str, Any]:
    combo = {}
    for attr_id, value_id in pse.get("combination", {}).items():
        attr_id_int = int(attr_id)
        title = attr_titles.get(attr_id_int, f"attr_{attr_id_int}")
        label = attr_labels.get(attr_id_int, {}).get(value_id, f"val_{value_id}")
        combo[title] = re.sub(r"\s+", " ", label).strip()
    return {
        "id": pse["id"],
        "ref": pse["ref"],
        "isDefault": pse.get("isDefault", False),
        "weight": pse.get("weight"),
        "disponibility": pse.get("disponibility"),
        "combination": combo,
    }


# -----------------------------------------------------------------------------
# Main pipeline per URL
# -----------------------------------------------------------------------------


def inspect_and_download(url: str) -> dict[str, Any]:
    print(f"\n→ {url}")
    t0 = time.time()

    r = session.get(url, timeout=20)
    r.raise_for_status()
    html_text = r.text
    soup = BeautifulSoup(html_text, "lxml")

    name = soup.select_one("h1").get_text(strip=True) if soup.select_one("h1") else url
    js_globals = extract_js_globals(html_text)
    sections = extract_sections(soup)

    attrs = js_globals.get("ATTRIBUTES") or []
    pses = js_globals.get("PSES") or []
    attr_labels = {a["id"]: {v["id"]: v["label"] for v in a["values"]} for a in attrs if a.get("values")}
    attr_titles = {a["id"]: a["title"] for a in attrs}

    # Variants + images via API
    variants = []
    for pse in pses:
        v = describe_variant(pse, attr_labels, attr_titles)
        v["image_urls"] = fetch_variant_images(pse["id"])
        variants.append(v)

    # Image de fallback (si pas de variants ou variant sans image)
    main_image_url = find_main_image(soup)

    # Téléchargement parallèle des images
    all_img_urls = set()
    if main_image_url:
        all_img_urls.add(main_image_url)
    for v in variants:
        all_img_urls.update(v["image_urls"])

    print(f"   ↳ {len(variants)} variants, {len(all_img_urls)} images à télécharger")
    local_map: dict[str, str | None] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(download_image, u): u for u in all_img_urls}
        for fut in as_completed(futures):
            local_map[futures[fut]] = fut.result()

    # Description + specs
    description = None
    for section_name, section in sections.items():
        if "description" in section_name.lower():
            description = section.get("text") or " ".join(
                f"{p['k']}: {p['v']}" for p in section.get("pairs", [])
            )
            break

    specs = {}
    for section_name, section in sections.items():
        if "caractéristiques" in section_name.lower() or "technique" in section_name.lower():
            for p in section.get("pairs", []):
                specs[normalize_key(p["k"])] = p["v"]
            break

    result = {
        "url": url,
        "name": name,
        "product_id": js_globals.get("PRODUCT_ID"),
        "main_image_local": local_map.get(main_image_url) if main_image_url else None,
        "main_image_url": main_image_url,
        "description": description,
        "specifications": specs,
        "variants": [
            {**v, "image_locals": [local_map.get(u) for u in v["image_urls"]]}
            for v in variants
        ],
        "attributes_active": [
            {"id": a["id"], "title": a["title"], "values": [x["label"] for x in a.get("values", [])]}
            for a in attrs if a.get("values")
        ],
        "elapsed_sec": round(time.time() - t0, 2),
    }

    print(f"   ✓ {name!r} — {len(variants)} variants — {len(specs)} specs — {result['elapsed_sec']}s")
    return result


# -----------------------------------------------------------------------------
# HTML rendering
# -----------------------------------------------------------------------------

HTML_HEAD = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Preview scraper Procity — SAPAL</title>
<style>
  :root {
    --bleu: #0a2540;
    --orange: #ed6b2a;
    --gris: #f4f5f7;
    --gris-bord: #e1e4e8;
    --txt: #24292f;
    --muet: #57606a;
  }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 0; background: var(--gris); color: var(--txt); }
  header { background: var(--bleu); color: white; padding: 20px 32px; position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
  header h1 { margin: 0 0 4px 0; font-size: 22px; }
  header .sub { opacity: .8; font-size: 13px; }
  nav.toc { background: white; padding: 16px 32px; border-bottom: 1px solid var(--gris-bord); display: flex; gap: 10px; flex-wrap: wrap; font-size: 13px; }
  nav.toc a { color: var(--bleu); text-decoration: none; padding: 4px 10px; border: 1px solid var(--gris-bord); border-radius: 4px; }
  nav.toc a:hover { background: var(--orange); color: white; border-color: var(--orange); }
  .container { max-width: 1280px; margin: 0 auto; padding: 24px; }
  .product { background: white; border-radius: 10px; padding: 28px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .product h2 { margin: 0 0 6px 0; color: var(--bleu); font-size: 26px; }
  .product .url { font-size: 12px; color: var(--muet); margin-bottom: 20px; }
  .product .url a { color: var(--muet); }
  .product-grid { display: grid; grid-template-columns: 420px 1fr; gap: 32px; }
  .main-img { width: 100%; border-radius: 8px; border: 1px solid var(--gris-bord); background: var(--gris); }
  .no-img { display: flex; align-items: center; justify-content: center; min-height: 280px; background: var(--gris); border: 2px dashed var(--gris-bord); border-radius: 8px; color: var(--muet); }
  .description { margin-bottom: 24px; line-height: 1.6; color: var(--txt); }
  .description .empty { color: var(--muet); font-style: italic; }
  .specs h3, .variants h3 { margin: 24px 0 10px 0; font-size: 15px; text-transform: uppercase; color: var(--bleu); letter-spacing: .5px; }
  .specs table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .specs td { padding: 8px 12px; border-bottom: 1px solid var(--gris-bord); vertical-align: top; }
  .specs td:first-child { font-weight: 600; width: 35%; color: var(--muet); }
  .variants-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 12px; }
  .variant { border: 1px solid var(--gris-bord); border-radius: 8px; overflow: hidden; background: white; transition: transform .1s; }
  .variant:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
  .variant img { width: 100%; aspect-ratio: 1; object-fit: cover; background: var(--gris); border-bottom: 1px solid var(--gris-bord); }
  .variant .no-img-v { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: var(--gris); color: var(--muet); font-size: 12px; border-bottom: 1px solid var(--gris-bord); }
  .variant-body { padding: 10px 12px; font-size: 12px; }
  .variant .ref { font-weight: 600; color: var(--bleu); font-family: monospace; }
  .variant .combo { color: var(--muet); margin-top: 4px; line-height: 1.4; }
  .variant .combo strong { color: var(--txt); font-weight: 500; }
  .stats { display: flex; gap: 20px; margin-bottom: 12px; flex-wrap: wrap; }
  .stats span { font-size: 12px; color: var(--muet); }
  .stats strong { color: var(--txt); }
  .attrs { margin-top: 10px; font-size: 12px; color: var(--muet); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; background: var(--orange); color: white; font-weight: 600; margin-left: 6px; }
  @media (max-width: 800px) { .product-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>Preview scraper Procity — 10 URLs</h1>
  <div class="sub">Aperçu local avant upsert Supabase — images téléchargées, specs extraites, variants mappés</div>
</header>
<nav class="toc">
"""


def render_product(p: dict[str, Any], idx: int) -> str:
    pid = f"p{idx}"
    name = html_mod.escape(p["name"])
    url = html_mod.escape(p["url"])

    # Main image
    if p.get("main_image_local"):
        main_img_html = f'<img class="main-img" src="{p["main_image_local"]}" alt="{name}">'
    else:
        main_img_html = '<div class="no-img">Pas d\'image principale</div>'

    # Description
    desc = p.get("description")
    if desc:
        desc_html = f'<div class="description">{html_mod.escape(desc)}</div>'
    else:
        desc_html = '<div class="description"><span class="empty">Aucune description disponible sur la fiche Procity.</span></div>'

    # Specs
    specs = p.get("specifications") or {}
    if specs:
        specs_rows = "".join(
            f"<tr><td>{html_mod.escape(k.replace('_', ' '))}</td><td>{html_mod.escape(v)}</td></tr>"
            for k, v in specs.items()
        )
        specs_html = f'<div class="specs"><h3>Caractéristiques techniques ({len(specs)})</h3><table>{specs_rows}</table></div>'
    else:
        specs_html = '<div class="specs"><h3>Caractéristiques techniques</h3><p style="color:var(--muet);font-style:italic;">Aucune spec extraite.</p></div>'

    # Attributs actifs
    attrs = p.get("attributes_active") or []
    attrs_html = ""
    if attrs:
        attrs_html = '<div class="attrs">Attributs : ' + ", ".join(
            f'<strong>{html_mod.escape(a["title"])}</strong> ({len(a["values"])})' for a in attrs
        ) + '</div>'

    # Variants
    variants = p.get("variants") or []
    if variants:
        v_cards = []
        for v in variants:
            img_local = (v.get("image_locals") or [None])[0]
            if img_local:
                img_html = f'<img src="{img_local}" loading="lazy">'
            else:
                img_html = '<div class="no-img-v">Pas d\'image</div>'
            combo_html = "<br>".join(
                f'<strong>{html_mod.escape(k)}</strong>: {html_mod.escape(v_)}'
                for k, v_ in v["combination"].items()
            ) or '<em>Variant sans attribut</em>'
            default_badge = '<span class="badge">PAR DÉFAUT</span>' if v.get("isDefault") else ""
            v_cards.append(
                f'<div class="variant">{img_html}'
                f'<div class="variant-body">'
                f'<div class="ref">{html_mod.escape(v["ref"])}{default_badge}</div>'
                f'<div class="combo">{combo_html}</div>'
                f'</div></div>'
            )
        variants_html = (
            f'<div class="variants"><h3>Variants ({len(variants)})</h3>'
            f'<div class="variants-grid">{"".join(v_cards)}</div></div>'
        )
    else:
        variants_html = '<div class="variants"><h3>Variants</h3><p style="color:var(--muet);">Produit simple, sans déclinaisons.</p></div>'

    # Stats
    nb_images = sum(len(v.get("image_locals") or []) for v in variants)
    stats_html = (
        f'<div class="stats">'
        f'<span>PRODUCT_ID: <strong>{p.get("product_id") or "—"}</strong></span>'
        f'<span>Variants: <strong>{len(variants)}</strong></span>'
        f'<span>Images variants: <strong>{nb_images}</strong></span>'
        f'<span>Specs: <strong>{len(specs)}</strong></span>'
        f'<span>Scrape: <strong>{p.get("elapsed_sec")}s</strong></span>'
        f'</div>'
    )

    return f"""
<section id="{pid}" class="product">
  <h2>{name}</h2>
  <div class="url"><a href="{url}" target="_blank">{url}</a></div>
  {stats_html}
  {attrs_html}
  <div class="product-grid">
    <div>{main_img_html}</div>
    <div>
      {desc_html}
      {specs_html}
    </div>
  </div>
  {variants_html}
</section>
"""


def render_html(products: list[dict[str, Any]]) -> str:
    toc = "".join(
        f'<a href="#p{i}">{html_mod.escape(p.get("name") or p["url"])}</a>'
        for i, p in enumerate(products) if "error" not in p
    )
    errors = "".join(
        f'<section class="product"><h2 style="color:#c00">✗ {html_mod.escape(p["url"])}</h2><pre>{html_mod.escape(p["error"])}</pre></section>'
        for p in products if "error" in p
    )
    body = "".join(render_product(p, i) for i, p in enumerate(products) if "error" not in p)
    return (
        HTML_HEAD + toc + '</nav><div class="container">' + errors + body + '</div></body></html>'
    )


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main() -> int:
    urls = sys.argv[1:] or SAMPLE_URLS
    results = []
    for url in urls:
        try:
            results.append(inspect_and_download(url))
        except Exception as e:
            print(f"   ✗ ERROR: {e}")
            results.append({"url": url, "error": str(e)})

    # Dump JSON
    (OUT_DIR / "data.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Render HTML
    html_path = OUT_DIR / "preview.html"
    html_path.write_text(render_html(results), encoding="utf-8")

    print(f"\n✅ {len([r for r in results if 'error' not in r])}/{len(results)} produits extraits")
    print(f"   📄 HTML preview : {html_path}")
    print(f"   🖼  Images      : {IMG_DIR}")
    print(f"\n   Ouvre avec :  open {html_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

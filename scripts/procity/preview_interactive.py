#!/usr/bin/env python3
"""
Preview interactive — simule la fiche produit finale SAPAL.

Pour chaque URL Procity de l'échantillon :
  1. Scrape la page
  2. Joint les données Excel (prix, délai, poids, stock) par ref variant
  3. Télécharge les images
  4. Génère un HTML avec sélecteurs interactifs fidèles au site SAPAL final
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

from excel_index import build_index, get_variant_data

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
    "https://procity.eu/fr/barriere-main-courante-lisbonne.html",
]

OUT_DIR = Path(__file__).parent / "output_preview"
IMG_DIR = OUT_DIR / "images"
OUT_DIR.mkdir(exist_ok=True)
IMG_DIR.mkdir(exist_ok=True)

RAL_COLORS = {
    "gris procity": "#8c8c8c", "gris procity®": "#8c8c8c",
    "9010": "#f4f4f4", "blanc": "#f4f4f4",
    "9005": "#0a0a0a", "9017": "#1e1e1e", "noir": "#0a0a0a",
    "3000": "#ab2524", "3004": "#8b1a1a", "3005": "#5e2028", "3020": "#cc2222",
    "2009": "#e25303",
    "1016": "#ead028", "1021": "#f3b800", "1023": "#f9b200", "1028": "#f5a623", "1034": "#efa94a",
    "5010": "#1a5fa8", "5013": "#193153", "5015": "#3b83bd", "5018": "#0e7c8b", "5024": "#5b7e96",
    "4005": "#6c4675", "4008": "#844c82",
    "6005": "#2b5c33", "6018": "#57a639", "6024": "#308446",
    "7001": "#8c9ca5", "7016": "#383e42", "7035": "#cdd1c4", "7039": "#6b6b60",
    "7040": "#9da3a5", "7044": "#b3b0a7", "9006": "#a5a9ad",
    "8017": "#4d2c1a", "8023": "#a65e2f",
    "aspect corten": "#a0522d", "corten": "#a0522d",
    "galva": "#c0c0c0", "galvanisé": "#c0c0c0",
    "anodisé": "#b8b8c8", "inox": "#d4d4d4", "brut": "#c8b89a",
    "standard": "#8c8c8c",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
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
# Scraping
# -----------------------------------------------------------------------------


def normalize_key(k: str) -> str:
    s = unicodedata.normalize("NFD", k)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def extract_js_globals(html_text: str) -> dict[str, Any]:
    out = {}
    for key, pattern in JS_VAR_RE.items():
        m = pattern.search(html_text)
        if not m:
            out[key] = None
            continue
        raw = m.group(1)
        out[key] = int(raw) if key == "PRODUCT_ID" else json.loads(raw)
    return out


def extract_sections(soup: BeautifulSoup) -> dict[str, Any]:
    sections = {}
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
            pairs = []
            for item in grid.find_all(recursive=False):
                kids = item.find_all(recursive=False)
                if len(kids) >= 2:
                    pairs.append({
                        "k": kids[0].get_text(" ", strip=True),
                        "v": re.sub(r"\s+", " ", kids[1].get_text(" ", strip=True)),
                    })
            sections[title] = {"pairs": pairs}
        else:
            sections[title] = {"text": re.sub(r"\s+", " ", content.get_text(" ", strip=True))}
    return sections


def fetch_variant_images(variant_id: int) -> list[str]:
    try:
        r = session.get(f"https://www.procity.eu/fr/open_api/product/image/{variant_id}", timeout=15)
        r.raise_for_status()
        return [it["image_url"] for it in r.json() if "image_url" in it]
    except Exception:
        return []


def find_main_image(soup: BeautifulSoup) -> str | None:
    for img in soup.select("img"):
        src = img.get("src") or ""
        if "/cache/images/product/" in src.lower():
            return src
    return None


def download_image(url: str) -> str | None:
    try:
        ext = Path(urlparse(url).path).suffix or ".jpg"
        h = hashlib.md5(url.encode()).hexdigest()[:16]
        path = IMG_DIR / f"{h}{ext}"
        if not path.exists():
            r = session.get(url, timeout=20)
            r.raise_for_status()
            path.write_bytes(r.content)
        return f"images/{h}{ext}"
    except Exception:
        return None


def get_color_hex(label: str) -> str | None:
    key = label.lower().strip()
    if key in RAL_COLORS:
        return RAL_COLORS[key]
    m = re.search(r"\d{4}", key)
    if m and m.group(0) in RAL_COLORS:
        return RAL_COLORS[m.group(0)]
    return None


def extract_product(url: str, excel_idx: dict) -> dict[str, Any]:
    print(f"\n→ {url}")
    t0 = time.time()
    r = session.get(url, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    name = soup.select_one("h1").get_text(strip=True) if soup.select_one("h1") else url
    js = extract_js_globals(r.text)
    sections = extract_sections(soup)
    attrs = js.get("ATTRIBUTES") or []
    pses = js.get("PSES") or []

    attr_labels = {a["id"]: {v["id"]: v["label"] for v in a["values"]} for a in attrs if a.get("values")}
    attr_titles = {a["id"]: a["title"] for a in attrs}
    active_attrs = [{"id": a["id"], "title": a["title"],
                     "values": [re.sub(r"\s+", " ", v["label"]).strip() for v in a["values"]]}
                    for a in attrs if a.get("values")]

    variants = []
    for pse in pses:
        combo = {}
        for attr_id, val_id in pse.get("combination", {}).items():
            aid = int(attr_id)
            title = attr_titles.get(aid, f"attr_{aid}")
            combo[title] = re.sub(r"\s+", " ", attr_labels.get(aid, {}).get(val_id, "")).strip()

        ref = pse["ref"]
        excel_data = get_variant_data(excel_idx, ref) or {}
        img_urls = fetch_variant_images(pse["id"])

        variants.append({
            "id": pse["id"], "ref": ref, "combination": combo,
            "isDefault": pse.get("isDefault", False),
            "image_urls": img_urls,
            "prix_public": excel_data.get("prix_public"),
            "prix_net": excel_data.get("prix_net"),
            "poids_excel": excel_data.get("poids"),
            "dim_excel": excel_data.get("dimensions"),
            "delai": excel_data.get("delai_resolved"),
            "is_in_stock": excel_data.get("is_in_stock", False),
            "excel_found": bool(excel_data),
        })

    all_urls = set()
    main_img = find_main_image(soup)
    if main_img:
        all_urls.add(main_img)
    for v in variants:
        all_urls.update(v["image_urls"])

    print(f"   ↳ {len(variants)} variants, {len(all_urls)} images")
    local_map = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(download_image, u): u for u in all_urls}
        for fut in as_completed(futures):
            local_map[futures[fut]] = fut.result()

    description = ""
    specs = {}
    for sec_name, sec in sections.items():
        if "description" in sec_name.lower():
            description = sec.get("text") or " ".join(f"{p['k']}: {p['v']}" for p in sec.get("pairs", []))
        elif "caractéristiques" in sec_name.lower() or "technique" in sec_name.lower():
            for p in sec.get("pairs", []):
                specs[normalize_key(p["k"])] = p["v"]

    for v in variants:
        v["image_locals"] = [local_map.get(u) for u in v["image_urls"] if local_map.get(u)]
        if not v["image_locals"] and main_img and local_map.get(main_img):
            v["image_fallback"] = local_map[main_img]

    matched = sum(1 for v in variants if v["excel_found"])
    print(f"   ✓ {name!r} — {len(variants)} variants — {matched}/{len(variants)} matchés Excel — {round(time.time()-t0,2)}s")

    return {
        "url": url, "name": name,
        "product_id": js.get("PRODUCT_ID"),
        "main_image_local": local_map.get(main_img) if main_img else None,
        "description": description, "specifications": specs,
        "attributes": active_attrs, "variants": variants,
    }


# -----------------------------------------------------------------------------
# HTML rendering (JS uses textContent + safe DOM)
# -----------------------------------------------------------------------------

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Simulation fiche produit SAPAL — Preview Procity</title>
<style>
  :root {
    --bleu: #0a2540; --bleu-clair: #1a4068; --orange: #ed6b2a;
    --vert: #059669; --rouge: #c0392b; --gris: #f4f5f7;
    --gris-bord: #e1e4e8; --txt: #24292f; --muet: #57606a;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 0; background: var(--gris); color: var(--txt); }
  header { background: var(--bleu); color: white; padding: 18px 32px; position: sticky; top: 0; z-index: 20; }
  header h1 { margin: 0; font-size: 20px; }
  header .sub { opacity: .8; font-size: 13px; margin-top: 4px; }
  nav.toc { background: white; padding: 12px 32px; border-bottom: 1px solid var(--gris-bord); display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px; position: sticky; top: 64px; z-index: 19; }
  nav.toc a { color: var(--bleu); text-decoration: none; padding: 4px 10px; border: 1px solid var(--gris-bord); border-radius: 4px; white-space: nowrap; }
  nav.toc a:hover { background: var(--orange); color: white; border-color: var(--orange); }
  .container { max-width: 1280px; margin: 0 auto; padding: 24px; }
  .product { background: white; border-radius: 10px; padding: 28px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .product > h2 { margin: 0 0 6px 0; color: var(--bleu); font-size: 26px; }
  .product > .url { font-size: 12px; color: var(--muet); margin-bottom: 20px; }
  .product > .url a { color: var(--muet); }

  .fiche { display: grid; grid-template-columns: 480px 1fr; gap: 32px; }
  .gallery img { width: 100%; border-radius: 8px; border: 1px solid var(--gris-bord); background: var(--gris); display: block; min-height: 300px; }
  .info h3 { color: var(--bleu); margin: 0 0 8px 0; font-size: 22px; }
  .info .ref { font-family: monospace; color: var(--muet); font-size: 13px; margin-bottom: 16px; }
  .price-block { display: flex; align-items: baseline; gap: 14px; margin-bottom: 8px; }
  .price { font-size: 30px; font-weight: 700; color: var(--bleu); }
  .price-pub { color: var(--muet); font-size: 15px; text-decoration: line-through; }
  .price-ht { color: var(--muet); font-size: 13px; margin-bottom: 16px; }
  .delai { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; margin-bottom: 16px; }
  .delai.stock { background: #d1fae5; color: var(--vert); }
  .delai.standard { background: #fef3c7; color: #92400e; }
  .delai.unknown { background: var(--gris); color: var(--muet); }
  .meta { display: flex; gap: 16px; margin-bottom: 20px; font-size: 13px; color: var(--muet); flex-wrap: wrap; }
  .meta span strong { color: var(--txt); font-weight: 500; }

  .selector-group { margin-bottom: 16px; }
  .selector-group label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--muet); margin-bottom: 8px; font-weight: 600; }
  .swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatch { width: 36px; height: 36px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; position: relative; transition: all .15s; }
  .swatch.selected { border-color: var(--bleu); transform: scale(1.1); box-shadow: 0 0 0 2px white, 0 0 0 4px var(--bleu); }
  .swatch.disabled { opacity: .25; cursor: not-allowed; }
  .swatch:hover:not(.disabled) { transform: scale(1.08); }
  .swatch[data-hex="#f4f4f4"], .swatch[data-hex="#cdd1c4"] { border: 2px solid var(--gris-bord); }
  .swatch[data-hex="#f4f4f4"].selected, .swatch[data-hex="#cdd1c4"].selected { border-color: var(--bleu); }
  .swatch.text-only { border-radius: 4px; width: auto; height: auto; padding: 6px 12px; font-size: 12px; background: white; border: 1px solid var(--gris-bord); color: var(--txt); }
  .swatch.text-only.selected { background: var(--bleu); color: white; border-color: var(--bleu); }

  .addcart { margin-top: 20px; padding: 14px 24px; background: var(--orange); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; }
  .addcart:hover { background: #d55a20; }

  .sections { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--gris-bord); }
  .sections h3 { color: var(--bleu); font-size: 14px; text-transform: uppercase; letter-spacing: .5px; margin: 24px 0 10px 0; }
  .sections table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .sections table td { padding: 8px 12px; border-bottom: 1px solid var(--gris-bord); vertical-align: top; }
  .sections table td:first-child { font-weight: 600; width: 35%; color: var(--muet); text-transform: capitalize; }
  .sections p { line-height: 1.6; color: var(--txt); margin: 8px 0; }

  .warn { background: #fef2f2; border-left: 3px solid var(--rouge); padding: 10px 14px; font-size: 13px; color: var(--rouge); margin-bottom: 16px; border-radius: 4px; }

  @media (max-width: 800px) { .fiche { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>🛒 Simulation fiche produit SAPAL</h1>
  <div class="sub">Pré-visualisation du rendu final (scraper Procity + Excel tarif)</div>
</header>
<nav class="toc">
__TOC__
</nav>
<div class="container">
__PRODUCTS__
</div>
<script>
function formatEuro(n) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

document.querySelectorAll('.product').forEach(function(productEl) {
  var variants = JSON.parse(productEl.dataset.variants);
  var axes = JSON.parse(productEl.dataset.axes);

  var selection = {};
  var defaultVariant = variants.find(function(v) { return v.isDefault; }) || variants[0];
  if (defaultVariant) {
    Object.keys(defaultVariant.combination).forEach(function(k) {
      selection[k] = defaultVariant.combination[k];
    });
  }

  function findBestImage(v) {
    if (v.image_locals && v.image_locals.length) return v.image_locals[0];
    if (v.image_fallback) return v.image_fallback;
    return null;
  }

  function updateUI() {
    var exact = variants.find(function(v) {
      return axes.every(function(a) { return v.combination[a.title] === selection[a.title]; });
    });
    var partial = exact || variants.find(function(v) {
      return axes.every(function(a) { return !selection[a.title] || v.combination[a.title] === selection[a.title]; });
    });
    if (!partial) return;

    var galleryImg = productEl.querySelector('.gallery img');
    var imgPath = findBestImage(partial);
    if (galleryImg && imgPath) {
      galleryImg.setAttribute('src', imgPath);
      galleryImg.setAttribute('alt', partial.ref);
    }

    var refEl = productEl.querySelector('.ref');
    if (refEl) refEl.textContent = 'Réf. ' + partial.ref;

    var priceEl = productEl.querySelector('.price');
    var pricePubEl = productEl.querySelector('.price-pub');
    if (partial.prix_net != null) {
      priceEl.textContent = formatEuro(partial.prix_net);
      if (partial.prix_public && partial.prix_public !== partial.prix_net) {
        pricePubEl.textContent = formatEuro(partial.prix_public);
        pricePubEl.style.display = '';
      } else {
        pricePubEl.style.display = 'none';
      }
    } else {
      priceEl.textContent = '— prix non trouvé —';
      pricePubEl.style.display = 'none';
    }

    var delaiEl = productEl.querySelector('.delai');
    if (partial.delai) {
      delaiEl.textContent = partial.delai;
      delaiEl.className = 'delai ' + (partial.is_in_stock ? 'stock' : 'standard');
    } else {
      delaiEl.textContent = 'Délai non renseigné';
      delaiEl.className = 'delai unknown';
    }

    // Poids / dim avec textContent (sécurisé)
    var poidsEl = productEl.querySelector('.meta-poids');
    if (poidsEl) {
      poidsEl.textContent = '';
      poidsEl.appendChild(document.createTextNode('Poids: '));
      var strong1 = document.createElement('strong');
      strong1.textContent = partial.poids_excel || '—';
      poidsEl.appendChild(strong1);
    }
    var dimEl = productEl.querySelector('.meta-dim');
    if (dimEl) {
      dimEl.textContent = '';
      dimEl.appendChild(document.createTextNode('Dimensions: '));
      var strong2 = document.createElement('strong');
      strong2.textContent = partial.dim_excel || '—';
      dimEl.appendChild(strong2);
    }

    var warnEl = productEl.querySelector('.warn');
    if (!exact && partial) {
      if (warnEl) {
        warnEl.textContent = '⚠ Combinaison non disponible — affichage du variant approchant ' + partial.ref;
        warnEl.style.display = '';
      }
    } else if (warnEl) {
      warnEl.style.display = 'none';
    }

    axes.forEach(function(axis) {
      var group = productEl.querySelector('[data-axis="' + CSS.escape(axis.title) + '"]');
      if (!group) return;
      group.querySelectorAll('[data-value]').forEach(function(swatch) {
        var value = swatch.dataset.value;
        swatch.classList.toggle('selected', selection[axis.title] === value);
        var testSel = Object.assign({}, selection);
        testSel[axis.title] = value;
        var possible = variants.some(function(v) {
          return axes.every(function(a) { return v.combination[a.title] === testSel[a.title]; });
        });
        swatch.classList.toggle('disabled', !possible);
      });
    });
  }

  productEl.querySelectorAll('[data-axis]').forEach(function(group) {
    var axisTitle = group.dataset.axis;
    group.querySelectorAll('[data-value]').forEach(function(el) {
      el.addEventListener('click', function() {
        if (el.classList.contains('disabled')) return;
        selection[axisTitle] = el.dataset.value;
        updateUI();
      });
    });
  });

  updateUI();
});
</script>
</body>
</html>
"""


def render_axis_selector(axis: dict) -> str:
    title = axis["title"]
    values = axis["values"]
    is_color = "couleur" in title.lower() or "coloris" in title.lower()
    items = []
    for v in values:
        v_esc = html_mod.escape(v)
        if is_color:
            hex_col = get_color_hex(v)
            if hex_col:
                items.append(
                    f'<div class="swatch" data-value="{v_esc}" data-hex="{hex_col}" '
                    f'style="background: {hex_col}" title="{v_esc}"></div>'
                )
            else:
                items.append(f'<div class="swatch text-only" data-value="{v_esc}" title="{v_esc}">{v_esc}</div>')
        else:
            items.append(f'<div class="swatch text-only" data-value="{v_esc}">{v_esc}</div>')
    return (
        f'<div class="selector-group" data-axis="{html_mod.escape(title)}">'
        f'<label>{html_mod.escape(title)}</label>'
        f'<div class="swatches">{"".join(items)}</div>'
        f'</div>'
    )


def render_product(p: dict, idx: int) -> str:
    pid = f"p{idx}"
    name = html_mod.escape(p["name"])
    url = html_mod.escape(p["url"])
    default_variant = next((v for v in p["variants"] if v.get("isDefault")), None) or (p["variants"][0] if p["variants"] else None)

    initial_img = ""
    if default_variant:
        if default_variant.get("image_locals"):
            initial_img = default_variant["image_locals"][0]
        elif default_variant.get("image_fallback"):
            initial_img = default_variant["image_fallback"]
    if not initial_img:
        initial_img = p.get("main_image_local") or ""

    selectors_html = "".join(render_axis_selector(a) for a in p["attributes"])

    specs = p.get("specifications") or {}
    if specs:
        specs_rows = "".join(
            f'<tr><td>{html_mod.escape(k.replace("_", " "))}</td><td>{html_mod.escape(v)}</td></tr>'
            for k, v in specs.items()
        )
        specs_html = f'<h3>Caractéristiques techniques</h3><table>{specs_rows}</table>'
    else:
        specs_html = '<h3>Caractéristiques techniques</h3><p style="color:var(--muet);font-style:italic;">Aucune spec extraite.</p>'

    desc = p.get("description") or ""
    desc_html = f'<h3>Description</h3><p>{html_mod.escape(desc)}</p>' if desc else ""

    variants_json = json.dumps([
        {
            "ref": v["ref"], "isDefault": v.get("isDefault", False),
            "combination": v["combination"],
            "image_locals": v.get("image_locals", []),
            "image_fallback": v.get("image_fallback"),
            "prix_net": v.get("prix_net"),
            "prix_public": v.get("prix_public"),
            "delai": v.get("delai"),
            "is_in_stock": v.get("is_in_stock", False),
            "poids_excel": v.get("poids_excel"),
            "dim_excel": v.get("dim_excel"),
        }
        for v in p["variants"]
    ], ensure_ascii=False)
    axes_json = json.dumps(p["attributes"], ensure_ascii=False)

    nb_matched = sum(1 for v in p["variants"] if v.get("excel_found"))
    stats_html = (
        f'<div style="font-size:12px;color:var(--muet);margin-bottom:12px;">'
        f'PRODUCT_ID Procity: <strong>{p.get("product_id") or "—"}</strong> · '
        f'{len(p["variants"])} variants · '
        f'{nb_matched}/{len(p["variants"])} joints à l\'Excel · '
        f'{len(specs)} specs extraites'
        f'</div>'
    )

    return f"""
<section id="{pid}" class="product" data-variants='{html_mod.escape(variants_json)}' data-axes='{html_mod.escape(axes_json)}'>
  <h2>{name}</h2>
  <div class="url"><a href="{url}" target="_blank" rel="noopener">{url}</a></div>
  {stats_html}
  <div class="warn" style="display:none"></div>
  <div class="fiche">
    <div class="gallery"><img src="{initial_img}" alt="{name}"></div>
    <div class="info">
      <h3>{name}</h3>
      <div class="ref">Réf. —</div>
      <div class="price-block">
        <span class="price">—</span>
        <span class="price-pub"></span>
      </div>
      <div class="price-ht">Prix HT départ usine, hors transport</div>
      <div class="delai unknown">—</div>
      <div class="meta">
        <span class="meta-poids">Poids: —</span>
        <span class="meta-dim">Dimensions: —</span>
      </div>
      {selectors_html}
      <button class="addcart">Ajouter au devis</button>
    </div>
  </div>
  <div class="sections">
    {specs_html}
    {desc_html}
  </div>
</section>
"""


def render_html(products: list[dict]) -> str:
    toc = "".join(
        f'<a href="#p{i}">{html_mod.escape(p["name"])}</a>'
        for i, p in enumerate(products)
    )
    body = "".join(render_product(p, i) for i, p in enumerate(products))
    return HTML_TEMPLATE.replace("__TOC__", toc).replace("__PRODUCTS__", body)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main() -> int:
    urls = sys.argv[1:] or SAMPLE_URLS
    print("📥 Indexation Excel…")
    excel_idx = build_index()
    print(f"   ✓ {len(excel_idx)} refs parent indexées")

    results = []
    for url in urls:
        try:
            results.append(extract_product(url, excel_idx))
        except Exception as e:
            import traceback; traceback.print_exc()
            print(f"   ✗ ERROR: {e}")

    (OUT_DIR / "data_interactive.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )
    html_path = OUT_DIR / "preview_interactive.html"
    html_path.write_text(render_html(results), encoding="utf-8")

    print(f"\n✅ {len(results)}/{len(urls)} produits extraits")
    print(f"   📄 {html_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

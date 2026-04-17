#!/usr/bin/env python3
"""
Résout les URLs Procity cassées (404/500) en cherchant sur leur moteur interne.

Pour chaque URL cassée :
  1. Extrait le "slug" du produit (derniers segments significatifs)
  2. Utilise /fr/search?q=... pour trouver l'URL correcte
  3. Retourne un mapping { url_cassée -> url_corrigée } dans un JSON

Usage :
    python3 find_broken_urls.py
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
http = requests.Session()
http.headers.update(HEADERS)

BROKEN_FILE = Path(__file__).parent / "broken_procity_urls.txt"
OUTPUT_FILE = Path(__file__).parent / "broken_urls_resolved.json"


def extract_keywords_from_url(url: str) -> list[str]:
    """
    https://procity.eu/fr/corbeille-lofoten-tri-sélectif.html
    → ["corbeille", "lofoten", "tri", "sélectif"]
    """
    m = re.search(r"/fr/([^/]+?)(?:\.html)?/?$", url)
    if not m:
        return []
    slug = m.group(1).replace("%C3%A9", "é").replace("%C3%A0", "à").replace("%C3%B8", "ø").replace("%20", " ")
    parts = re.split(r"[-_]", slug)
    # Filtrer mots courts / vides
    return [p for p in parts if len(p) >= 2]


def search_procity(query: str) -> list[dict]:
    """Utilise le moteur de recherche interne Procity."""
    try:
        url = f"https://www.procity.eu/fr/search?q={quote(query)}"
        r = http.get(url, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        # Les résultats sont des <a> vers des pages produit
        results = []
        seen = set()
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            if href.startswith("/fr/") and href.endswith(".html") and "/search" not in href:
                full = f"https://www.procity.eu{href}" if href.startswith("/") else href
                if full in seen:
                    continue
                seen.add(full)
                # Texte du lien ou titre
                title = a.get_text(strip=True)[:80] or a.get("title", "")[:80]
                results.append({"url": full, "title": title})
        return results[:15]
    except Exception as e:
        print(f"   ✗ search error '{query}': {e}")
        return []


def score_candidate(candidate_url: str, broken_keywords: list[str]) -> int:
    """Score la correspondance entre l'URL candidate et les mots-clés."""
    slug = candidate_url.lower()
    score = 0
    for kw in broken_keywords:
        kw_clean = kw.lower()
        if kw_clean in slug:
            score += 10
        # Version sans accents pour matcher "lofoten" dans "lofoten" ou "sélectif" dans "selectif"
        elif kw_clean.replace("é", "e").replace("è", "e").replace("ê", "e").replace("à", "a").replace("ø", "o") in slug:
            score += 8
    return score


def resolve_url(broken_url: str) -> dict:
    """Tente de trouver l'URL de remplacement."""
    kws = extract_keywords_from_url(broken_url)
    if not kws:
        return {"found": False, "reason": "no keywords"}

    # Essai 1 : recherche avec les 2 mots les plus distinctifs (souvent nom produit + variante)
    primary_query = " ".join(kws[:3])
    candidates = search_procity(primary_query)

    if not candidates:
        # Essai 2 : juste le premier mot (type produit)
        candidates = search_procity(kws[0])

    if not candidates:
        return {"found": False, "keywords": kws, "reason": "no search results"}

    # Scorer les candidats
    scored = [(score_candidate(c["url"], kws), c) for c in candidates]
    scored.sort(key=lambda x: -x[0])
    best_score, best = scored[0]

    # Vérifier que l'URL fonctionne (200)
    if best_score > 0:
        try:
            r = http.head(best["url"], timeout=10, allow_redirects=True)
            if r.status_code == 200:
                return {
                    "found": True,
                    "keywords": kws,
                    "url": best["url"],
                    "title": best.get("title", ""),
                    "score": best_score,
                    "other_candidates": [{"url": c["url"], "score": s} for s, c in scored[1:4]],
                }
        except Exception:
            pass

    return {
        "found": False,
        "keywords": kws,
        "reason": f"best candidate unreachable or low score ({best_score})",
        "candidates": [{"url": c["url"], "score": s} for s, c in scored[:5]],
    }


def main() -> int:
    if not BROKEN_FILE.exists():
        print(f"✗ Fichier introuvable : {BROKEN_FILE}")
        return 1

    urls = [u.strip() for u in BROKEN_FILE.read_text().splitlines() if u.strip()]
    print(f"🔍 Résolution de {len(urls)} URLs cassées…\n")

    results = {}
    for url in urls:
        print(f"→ {url}")
        resolution = resolve_url(url)
        results[url] = resolution
        if resolution["found"]:
            print(f"   ✓ → {resolution['url']}  (score={resolution['score']})")
        else:
            print(f"   ✗ {resolution.get('reason', 'unknown')}")
            if resolution.get("candidates"):
                for c in resolution["candidates"][:3]:
                    print(f"     candidat: {c['url']} (score={c['score']})")
        time.sleep(0.5)  # Courtoisie

    OUTPUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    resolved = sum(1 for r in results.values() if r["found"])
    print(f"\n✅ Résolu : {resolved}/{len(urls)}")
    print(f"   → {OUTPUT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Traite les variants orphelins : refs Supabase sans suffixe coloris dont Procity
a maintenant des refs avec suffixes. On prend l'image du variant "isDefault"
de la page Procity et on l'attribue au variant Supabase.

Usage :
    python3 sync_orphan_refs.py --dry-run
    python3 sync_orphan_refs.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from supabase import create_client

from excel_index import build_index, get_variant_data
from sync_variant_images import (
    upload_to_storage, download_image_bytes, extension_from_url,
    fetch_variant_image_url, get_procity_variants_map, URL_OVERRIDES,
)

ROOT = Path(__file__).parent.parent.parent
load_dotenv(ROOT / ".env.local")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("📥 Indexation Excel…")
    excel_idx = build_index()

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    # Récupérer tous les variants sans images dont la ref N'A PAS de suffixe (."XXXX")
    print("🔍 Variants sans suffixe coloris et sans images…")
    all_v = []
    offset = 0
    while True:
        b = sb.table("product_variants").select("id, reference, product_id").eq("images", "[]").range(offset, offset + 999).execute()
        if not b.data:
            break
        all_v.extend(b.data)
        if len(b.data) < 1000:
            break
        offset += 1000

    # Candidats = ref purement numérique (pas de dot)
    candidates = [v for v in all_v if "." not in v["reference"] and re.match(r"^\d+$", v["reference"])]
    print(f"   ✓ {len(candidates)} candidats")

    processed = 0
    uploaded = 0
    skipped = 0

    for v in candidates:
        ref = v["reference"]
        excel = excel_idx.get(ref)
        if not excel or not excel.get("url"):
            skipped += 1
            continue

        url = URL_OVERRIDES.get(excel["url"], excel["url"])
        pses_map = get_procity_variants_map(url)
        if not pses_map:
            skipped += 1
            continue

        # Chercher une ref Procity qui commence par `{ref}.` (variant Procity avec suffixe)
        matching = [(r, pid) for r, pid in pses_map.items() if r.startswith(f"{ref}.")]
        if not matching:
            skipped += 1
            continue

        # Prendre le premier (correspond souvent au variant "isDefault")
        target_ref, procity_id = matching[0]
        img_url = fetch_variant_image_url(procity_id)
        if not img_url:
            skipped += 1
            continue

        processed += 1
        if args.dry_run:
            print(f"   [DRY] {ref} (Supabase) ← image du variant {target_ref} (Procity id={procity_id})")
            continue

        dl = download_image_bytes(img_url)
        if not dl:
            skipped += 1
            continue

        data, ct = dl
        ext = extension_from_url(img_url, ct)
        try:
            public_url = upload_to_storage(sb, v["product_id"], ref, data, ext)
            sb.table("product_variants").update({"images": [public_url]}).eq("id", v["id"]).execute()
            uploaded += 1
            print(f"   ✓ {ref} ← {target_ref}")
        except Exception as e:
            print(f"   ✗ {ref}: {e}")
            skipped += 1

        time.sleep(0.1)

    print(f"\n{'='*60}")
    if args.dry_run:
        print(f"  Traitables: {processed} / Skip: {skipped}")
    else:
        print(f"  Uploadés: {uploaded} / Skip: {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

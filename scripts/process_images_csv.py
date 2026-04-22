#!/usr/bin/env python3
"""
Process Procity images CSV: download images, upload to Supabase Storage,
and update product_variants.images in the database.
"""

import csv
import os
import re
import sys
import time
import unicodedata
import requests
from pathlib import Path
from urllib.parse import quote as url_quote

# --- Config ---
PROJECT_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = Path("/Users/pierrelaurent/Downloads/URL images ProCity - procity_images_template.csv")

# Load env from .env.local
env_path = PROJECT_DIR / ".env.local"
env_vars = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            env_vars[key.strip()] = val.strip()

SUPABASE_URL = env_vars["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_ROLE_KEY = env_vars["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "products"


def slugify(text: str) -> str:
    """Convert text to slug: lowercase, no accents, spaces to dashes."""
    if not text:
        return "default"
    # Normalize unicode and remove accents
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def download_image(url: str) -> bytes | None:
    """Download image from URL, return bytes or None on failure."""
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"  [DOWNLOAD ERROR] {url}: {e}")
        return None


def upload_to_storage(storage_path: str, image_data: bytes) -> bool:
    """Upload image to Supabase Storage with upsert."""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }
    try:
        resp = requests.post(url, headers=headers, data=image_data, timeout=30)
        if resp.status_code in (200, 201):
            return True
        else:
            print(f"  [UPLOAD ERROR] {storage_path}: {resp.status_code} {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  [UPLOAD ERROR] {storage_path}: {e}")
        return False


def update_variant_images(product_id: str, coloris: str, finition: str, public_url: str) -> bool:
    """Update product_variants.images via Supabase REST API."""
    base_url = f"{SUPABASE_URL}/rest/v1/product_variants"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    body = {"images": [public_url]}

    finition_stripped = finition.strip() if finition else ""

    if finition_stripped:
        # Finition has a value
        params = {
            "product_id": f"eq.{product_id}",
            "coloris": f"eq.{coloris}",
            "finition": f"eq.{finition_stripped}",
        }
        try:
            resp = requests.patch(base_url, headers=headers, params=params, json=body, timeout=15)
            if resp.status_code in (200, 204):
                return True
            else:
                print(f"  [DB ERROR] {product_id}/{coloris}/{finition}: {resp.status_code} {resp.text[:200]}")
                return False
        except Exception as e:
            print(f"  [DB ERROR] {product_id}/{coloris}/{finition}: {e}")
            return False
    else:
        # Finition is empty -> try both NULL and empty string
        success = False

        # Try finition IS NULL
        params_null = {
            "product_id": f"eq.{product_id}",
            "coloris": f"eq.{coloris}",
            "finition": "is.null",
        }
        try:
            resp = requests.patch(base_url, headers=headers, params=params_null, json=body, timeout=15)
            if resp.status_code in (200, 204):
                success = True
        except Exception as e:
            print(f"  [DB ERROR null] {product_id}/{coloris}: {e}")

        # Try finition = ''
        params_empty = {
            "product_id": f"eq.{product_id}",
            "coloris": f"eq.{coloris}",
            "finition": "eq.",
        }
        try:
            resp = requests.patch(base_url, headers=headers, params=params_empty, json=body, timeout=15)
            if resp.status_code in (200, 204):
                success = True
        except Exception as e:
            print(f"  [DB ERROR empty] {product_id}/{coloris}: {e}")

        if not success:
            print(f"  [DB ERROR] No variant matched for {product_id}/{coloris} (finition NULL or empty)")
        return success


def main():
    print(f"Reading CSV: {CSV_PATH}")
    rows = []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("image_url", "").strip():
                rows.append(row)

    total = len(rows)
    print(f"Found {total} rows with image URLs to process.\n")

    success_count = 0
    error_count = 0
    errors = []

    for i, row in enumerate(rows, 1):
        product_id = row["product_id"].strip()
        product_name = row["product_name"].strip()
        coloris = row["coloris"].strip()
        finition = row["finition"].strip()
        image_url = row["image_url"].strip()

        finition_slug = slugify(finition) if finition else "default"
        coloris_slug = slugify(coloris)
        storage_path = f"procity/{product_id}/{finition_slug}/{coloris_slug}.jpg"
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"

        if i % 50 == 0 or i == 1 or i == total:
            print(f"[{i}/{total}] Processing {product_name} | coloris={coloris} | finition={finition or '(none)'}")

        # 1. Download
        image_data = download_image(image_url)
        if not image_data:
            error_count += 1
            errors.append(f"{product_id}/{coloris}/{finition}: download failed")
            continue

        # 2. Upload to Storage
        uploaded = upload_to_storage(storage_path, image_data)
        if not uploaded:
            error_count += 1
            errors.append(f"{product_id}/{coloris}/{finition}: upload failed")
            continue

        # 3. Update DB
        updated = update_variant_images(product_id, coloris, finition, public_url)
        if not updated:
            error_count += 1
            errors.append(f"{product_id}/{coloris}/{finition}: DB update failed")
            continue

        success_count += 1

    # Summary
    print("\n" + "=" * 60)
    print(f"DONE. Total: {total} | Success: {success_count} | Errors: {error_count}")
    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  - {e}")
    print("=" * 60)


if __name__ == "__main__":
    main()

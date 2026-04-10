# Product Images — Source Directory

Drop product images here before running the upload script.

## Naming convention

Name each file after the product **reference** (case-insensitive):

```
SAP-PANN-001.jpg
SIGN-042.png
SAP-CORB-007.jpeg
```

The script matches the filename (without extension) against the `reference` column
in the database. If no reference match is found, it falls back to matching the
`slug` column (filename slugified, e.g. `my-product.jpg` → slug `my-product`).

## Supported formats

`jpg`, `jpeg`, `png`, `gif`, `webp`

Maximum source file size: **10 MB**

## What the script does

1. Converts each image to **WebP** (quality 80, max width 800 px)
2. Uploads to Supabase Storage at path: `products/{category_slug}/{product_slug}.webp`
3. Updates the `image_url` column in the `products` table

## Usage

```bash
# Preview without making changes
npx tsx scripts/upload-product-images.ts ./scripts/images/ --dry-run

# Upload for real
npx tsx scripts/upload-product-images.ts ./scripts/images/
```

## Notes

- This directory is gitignored — do not commit images here
- Existing storage objects are overwritten (upsert)
- Images that don't match any product are skipped with a warning

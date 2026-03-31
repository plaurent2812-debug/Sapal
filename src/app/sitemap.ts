import type { MetadataRoute } from "next";
import { getCategories, getAllProducts } from "@/lib/data";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.sapal-signaletique.fr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    getCategories(),
    getAllProducts(),
  ]);

  // Build category slug lookup for product URLs
  const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/catalogue`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/devis`, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${SITE_URL}/qui-sommes-nous`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/realisations`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    { url: `${SITE_URL}/cgv`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${SITE_URL}/catalogue/${cat.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productPages: MetadataRoute.Sitemap = products
    .map((p) => {
      const catSlug = categorySlugById.get(p.categoryId);
      if (!catSlug) return null;
      return {
        url: `${SITE_URL}/catalogue/${catSlug}/${p.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return [...staticPages, ...categoryPages, ...productPages];
}

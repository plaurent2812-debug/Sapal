import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Quota Vercel Image Optimization plafonné — désactivé pour servir les images statiques directement.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'www.procity.eu' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/catalogue/panneaux-age/panneau-animal-814011',
        destination: '/catalogue/panneaux-age/panneau-animal',
        permanent: true,
      },
      {
        source: '/catalogue/panneaux-age/panneau-animal-814012',
        destination: '/catalogue/panneaux-age/panneau-animal',
        permanent: true,
      },
      {
        source: '/catalogue/jeux-a-grimper/jeux-a-grimper-pago-pago-804000',
        destination: '/catalogue/jeux-a-grimper/jeux-a-grimper-pago-pago',
        permanent: true,
      },
      {
        source: '/catalogue/fournisseurs/procity/jeux-a-grimper/jeux-a-grimper-pago-pago-804000',
        destination: '/catalogue/fournisseurs/procity/jeux-a-grimper/jeux-a-grimper-pago-pago',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;

// Old Shopify product URLs (still referenced by live ads) mapped to this
// site's product pages. These are rewrites, not redirects — the browser URL
// bar keeps showing the old /products/... path, no 3xx response, so ad
// destination URLs never need to change. Add more entries here as old slugs
// are confirmed (see lib/products.js for current product ids).
const OLD_PRODUCT_URL_REWRITES = [
  { source: '/products/veil-original-scented-puff-powder', destination: '/product/original' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return OLD_PRODUCT_URL_REWRITES;
  },
};

module.exports = nextConfig;

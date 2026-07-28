import { PRODUCTS } from '../lib/products';
import { SITE_URL } from '../components/Seo';

// Ad landing pages (/offer, /offer2, /offer3) and transactional pages
// (/checkout*, /success, /admin) are deliberately left out — they're either
// single-purpose ad destinations that would read as duplicate content next
// to the real product pages, or not meant to be publicly indexed at all
// (also blocked in public/robots.txt).
const STATIC_PATHS = ['/', '/shop', '/terms', '/privacy', '/returns', '/shipping'];

function buildSitemap() {
  const urls = [
    ...STATIC_PATHS,
    ...PRODUCTS.map((p) => `/product/${p.id}`),
  ];

  const body = urls
    .map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'application/xml');
  res.write(buildSitemap());
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}

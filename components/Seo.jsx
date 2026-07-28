import Head from 'next/head';

// Central place for what Google/social platforms pull for a preview: page
// title, meta description, canonical URL, and og:image/twitter:image (the
// "preset image" search results and link previews show). Per-page usage
// (see pages/product/[id].jsx for the richest example) overrides the
// defaults below rather than duplicating this boilerplate on every page.
export const SITE_URL = 'https://veilpuff.com';
export const SITE_NAME = 'VEIL';
const DEFAULT_DESCRIPTION = 'A featherlight perfume powder that melts into skin and lingers all day — noticed only by those who lean in close.';
const DEFAULT_IMAGE = '/images/veil-model-powder-puff.png';

export default function Seo({ title, description = DEFAULT_DESCRIPTION, image = DEFAULT_IMAGE, path = '/', noindex = false }) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Poudre de Corps Parfumée`;
  const url = `${SITE_URL}${path}`;
  const absoluteImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />
    </Head>
  );
}

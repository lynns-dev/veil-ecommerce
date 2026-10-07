import Head from 'next/head';

// Admin-only typeface: Inter, a plain screen sans with same-width digits,
// so tables and numbers line up and read easily. The storefront keeps its
// brand fonts — this is rendered by pages/_app.jsx only on /admin routes.
// !important because admin screens set fontFamily inline from lib/theme.js.
export default function AdminFonts() {
  return (
    <>
      <Head>
        <link
          key="admin-font"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </Head>
      <style jsx global>{`
        body, body *:not(svg):not(svg *) {
          font-family: 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-style: normal !important;
          font-variant-numeric: tabular-nums;
        }
        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
    </>
  );
}

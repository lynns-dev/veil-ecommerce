import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/images/veil-favicon.png" type="image/png" />
        {/* Without this, a phone/browser set to dark mode auto-styles
            native, unstyled form controls (the checkout state <select>,
            checkboxes) with dark backgrounds and light text — independent
            of the page's own explicitly light-themed CSS — since nothing
            here otherwise tells the browser this page only supports a
            light color scheme. */}
        <meta name="color-scheme" content="light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=Hanken+Grotesk:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          *{margin:0;padding:0;box-sizing:border-box}
          html{scroll-behavior:smooth;color-scheme:light}
          body{background:#FCFBF7;color:#16140F;font-family:'Hanken Grotesk',sans-serif;font-weight:400;line-height:1.7;-webkit-font-smoothing:antialiased;overflow-x:hidden}
          a{color:inherit;text-decoration:none}
          img{display:block;max-width:100%}
          ::selection{background:#16140F;color:#FCFBF7}
        `,
          }}
        />
        {/* Microsoft Clarity session recording/heatmaps. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "xupjhi6xju");
        `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=Hanken+Grotesk:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        <style>{`
          *{margin:0;padding:0;box-sizing:border-box}
          html{scroll-behavior:smooth}
          body{background:#FCFBF7;color:#16140F;font-family:'Hanken Grotesk',sans-serif;font-weight:400;line-height:1.7;-webkit-font-smoothing:antialiased;overflow-x:hidden}
          a{color:inherit;text-decoration:none}
          img{display:block;max-width:100%}
          ::selection{background:#16140F;color:#FCFBF7}
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

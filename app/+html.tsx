import { Head, Html, Main, NextScript } from 'expo-router/html';

export default function HTML() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Preload the font to eliminate "empty boxes" on first load [cite: 11] */}
        <link rel="preload" href="/fonts/Ionicons.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'ionicons'; 
                src: url('/fonts/Ionicons.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: block;
              }
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
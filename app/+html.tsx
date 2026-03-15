import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        
        {/* --- BRANDING & SEO --- */}
        <title>V-Stream | Movies & TV</title>
        <meta name="description" content="Stream your favorite movies, TV shows, and original content." />
        <link rel="icon" type="image/png" href="/favicon.png" />
        
        {/* Social Media Link Previews */}
        <meta property="og:title" content="V-Stream | Movies & TV" />
        <meta property="og:description" content="Stream your favorite movies, TV shows, and original content." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/icon.png" />
        
        {/* Force prioritize the font download  */}
        <link
          rel="preload"
          href="/fonts/Ionicons.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous" 
        />
        
        {/* Map BOTH names to cover all bases */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'ionicons'; /* The name Expo expects */
            src: url('/fonts/Ionicons.ttf') format('truetype');
            font-display: block;
          }
          @font-face {
            font-family: 'Ionicons';
            src: url('/fonts/Ionicons.ttf') format('truetype');
            font-display: block;
          }
        `}} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
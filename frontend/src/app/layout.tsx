import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SamaStat",
  description:
    "Posez une question en français ou en wolof sur les statistiques officielles du Sénégal et obtenez la valeur exacte publiée par l'ANSD, avec sa source.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0d0e",
};

/** Applique le thème choisi avant le premier rendu pour éviter un éclair de thème. */
const themeScript = `(function(){try{var q=new URLSearchParams(location.search).get('theme');var t=(q==='dark'||q==='light')?q:localStorage.getItem('samastat.theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);if(q)localStorage.setItem('samastat.theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

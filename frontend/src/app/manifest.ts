import type { MetadataRoute } from "next";

/** Application web installable (PWA) : icône et couleurs du système de design. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SamaStat — statistiques officielles du Sénégal",
    short_name: "SamaStat",
    description: "Posez une question, obtenez le chiffre officiel de l'ANSD et sa source.",
    start_url: "/",
    display: "standalone",
    lang: "fr",
    background_color: "#faf9f6",
    theme_color: "#0f6b3f",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}

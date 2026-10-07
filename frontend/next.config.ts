import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome pour l'image Docker (frontend/Dockerfile).
  output: "standalone",
};

export default nextConfig;

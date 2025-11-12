import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IWE - Sistema de Gestão de Matrículas",
    short_name: "IWE",
    description:
      "Plataforma multi-tenant de gestão educacional com integração Mercado Pago, WhatsApp e Moodle",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0ea5e9",
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
      { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}


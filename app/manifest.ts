import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rota Lucro",
    short_name: "Rota Lucro",
    description: "Controle de ganhos e combustível para motoristas.",
    start_url: "/",
    display: "standalone",
    background_color: "#101312",
    theme_color: "#c8f135",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

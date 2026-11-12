import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sala do Curso",
    short_name: "Sala do Curso",
    description: "Acompanhe as aulas, os materiais e as atividades do seu cursinho.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#173e33",
    icons: [
      { src: "/icons/sala-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/sala-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/sala-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

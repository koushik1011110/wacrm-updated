import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KK WABA — WhatsApp API CRM",
    short_name: "KK WABA",
    description: "Manage WhatsApp conversations, customers, campaigns, and automations from one focused workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcfb",
    theme_color: "#059669",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

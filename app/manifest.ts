import type { MetadataRoute } from "next"

// Lets phones install the site to the home screen with the Founder Compass icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Founder Compass",
    short_name: "Compass",
    description: "Every USC entrepreneurship program in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#990000",
    theme_color: "#990000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}

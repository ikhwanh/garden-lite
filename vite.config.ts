import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

// Served from the repo subpath on GitHub Pages (ikhwanh.github.io/garden-lite/).
// An absolute base (not "./") keeps asset URLs correct for deep client-side
// routes like /garden-lite/timeline. Vite exposes this as import.meta.env.BASE_URL.
const base = "/garden-lite/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Auto-inject the service-worker registration into index.html.
      injectRegister: "auto",
      includeAssets: ["apple-touch-icon.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        // The SPA fallback (see gh-pages-spa-fallback) serves index.html for
        // client routes; let the SW do the same when offline.
        navigateFallback: `${base}index.html`,
      },
      manifest: {
        name: "Garden Lite",
        short_name: "Garden Lite",
        description: "Local-first garden manager with planting schedules and calendar export.",
        theme_color: "#2f7d4f",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
    {
      // GitHub Pages has no server-side rewrites, so a hard refresh or deep link
      // to a client route would 404. Serving a copy of index.html as 404.html
      // lets the SPA boot and hand the URL to the router.
      name: "gh-pages-spa-fallback",
      closeBundle() {
        const dir = resolve("dist");
        copyFileSync(resolve(dir, "index.html"), resolve(dir, "404.html"));
      },
    },
  ],
  build: {
    target: "es2022",
    outDir: "dist",
  },
  server: {
    port: 5173,
    host: true,
  },
});

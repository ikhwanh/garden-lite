import { defineConfig } from "vite";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

// Served from the repo subpath on GitHub Pages (ikhwanh.github.io/garden-lite/).
// An absolute base (not "./") keeps asset URLs correct for deep client-side
// routes like /garden-lite/timeline. Vite exposes this as import.meta.env.BASE_URL.
const base = "/garden-lite/";

export default defineConfig({
  base,
  plugins: [
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

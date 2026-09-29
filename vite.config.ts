import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

// Served at the domain root by default; BASE_PATH=/sba/ for https://kopexa-grc.github.io/sba/.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Kopexa Schutzbedarfsanalyse",
        short_name: "Kopexa SBA",
        description:
          "Schutzbedarfsanalyse nach BSI IT-Grundschutz 200-2 und ISO/IEC 27001 – lokal im Browser, revisionssicher versioniert.",
        lang: "de",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f6f7f9",
        theme_color: "#10263e",
        // Installed app opens .sba files (Chromium File Handling API).
        file_handlers: [{ action: base, accept: { "application/vnd.kopexa.sba": [".sba"] } }],
        launch_handler: { client_mode: "focus-existing" },
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // The PDF renderer and ExcelJS chunks are large but must work offline.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: "node",
  },
});

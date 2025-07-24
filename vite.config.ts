import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      injectManifest: {
        swSrc: 'public/service-worker.js', // Your actual SW
        swDest: 'sw.js', // Output name in dist folder
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,json,webmanifest}',
        ],
      },
      manifest: {
        name: 'MCM Alerts',
        short_name: 'MCM Alerts',
        description: 'MCM Alerts Application',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'mcm-logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'mcm-logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      devOptions: {
        enabled: mode === 'development',
        type: 'module',
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

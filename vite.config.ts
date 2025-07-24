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
        swSrc: './src/service-worker.js',
        swDest: './service-worker.js',
        globDirectory: './dist',
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,json,webmanifest}',
        ],
        maximumFileSizeToCacheInBytes: 5000000, // 5MB
      },
      manifest: {
        name: 'MCM Alerts',
        short_name: 'MCM Alerts',
        description: 'MCM Alerts Application',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
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
  // Build configuration to handle the PWA properly
  build: {
    rollupOptions: {
      // Handle large chunks warning
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-switch'],
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000
  }
}));

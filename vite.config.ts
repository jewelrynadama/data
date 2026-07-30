import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';


function localMediaPlugin() {
  return {
    name: 'local-media-plugin',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/local-media/')) {
          const fileName = decodeURIComponent(req.url.replace('/local-media/', ''));
          const filePath = path.join('C:\\Users\\T470\\Downloads', fileName);
          if (fs.existsSync(filePath)) {
            res.statusCode = 200;
            const ext = path.extname(filePath).toLowerCase();
            let contentType = 'image/jpeg';
            if (ext === '.png') contentType = 'image/png';
            else if (ext === '.gif') contentType = 'image/gif';
            else if (ext === '.webp') contentType = 'image/webp';
            res.setHeader('Content-Type', contentType);
            fs.createReadStream(filePath).pipe(res);
            return;
          } else {
            res.statusCode = 404;
            res.end('Foto tidak ditemukan di komputer Anda (Folder Downloads).');
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    localMediaPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'PearlCRM — Customer Intelligence',
        short_name: 'PearlCRM',
        description: 'Premium Customer Intelligence Dashboard untuk bisnis perhiasan mutiara',
        theme_color: '#7c3aed',
        background_color: '#0f0f1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💎</text></svg>',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache JS/CSS/HTML build artifacts (cache-first, they have hash in filename)
        globPatterns: ['**/*.{js,css,html}'],
        // Runtime caching strategies
        runtimeCaching: [
          {
            // Google Sheets CSV — stale-while-revalidate 5 min
            urlPattern: /^https:\/\/docs\.google\.com\/spreadsheets\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'sheets-data',
              expiration: { maxAgeSeconds: 5 * 60, maxEntries: 5 },
            },
          },
          {
            // Firebase Firestore API — network-first for real-time data accuracy
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-api',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60, maxEntries: 50 },
            },
          },
          {
            // Google Fonts — cache-first (fonts don't change)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30, maxEntries: 20 },
            },
          },
        ],
      },
    }),
  ],
  base: './', // Use relative paths for assets so it works on any subpath (Netlify drag & drop)
  build: {
    target: 'es2015', // Transpile modern syntax to support older mobile browsers (fixes blank white screen on mobile)
    chunkSizeWarningLimit: 2000, // suppress warning
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor';
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) return 'charts';
          if (id.includes('node_modules/@google/generative-ai')) return 'genai';
        }
      }
    }
  }
});

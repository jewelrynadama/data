import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for assets so it works on any subpath (Netlify drag & drop)
  build: {
    target: 'es2015', // Transpile modern syntax to support older mobile browsers (fixes blank white screen on mobile)
    chunkSizeWarningLimit: 2000, // suppress warning
  }
});

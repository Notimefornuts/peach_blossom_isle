import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    // The island is a static, offline-capable page; allow the preview proxy and
    // any local network address to reach the dev server.
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0
  }
});

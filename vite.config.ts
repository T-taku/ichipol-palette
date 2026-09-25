import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./src/settings', import.meta.url));

export default defineConfig({
  plugins: [react()],
  root,
  publicDir: false,
  base: './',
  server: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        settings: fileURLToPath(new URL('./src/settings/index.html', import.meta.url)),
      },
    },
  },
});

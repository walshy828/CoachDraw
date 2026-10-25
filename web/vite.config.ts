import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  build: { outDir: path.resolve(__dirname, '../dist/web'), emptyOutDir: true },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: { '/api': 'http://localhost:3000' },
  },
});

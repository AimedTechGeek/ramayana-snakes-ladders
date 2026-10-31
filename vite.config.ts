import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // multi-page: the game, the D3 Blender-GLB spike page and the hero preview
      input: {
        main: 'index.html',
        spike: 'spike.html',
        hero: 'hero.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

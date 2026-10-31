import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // multi-page: the game plus the D3 Blender-GLB spike page
      input: {
        main: 'index.html',
        spike: 'spike.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

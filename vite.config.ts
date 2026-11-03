import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/** Hero ids with a GLB in public/models/heroes; Pieces.tsx draws the others as pegs and never requests them. */
const heroModels = readdirSync('public/models/heroes')
  .filter((file) => file.endsWith('.glb'))
  .map((file) => file.slice(0, -'.glb'.length));

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __HERO_MODELS__: JSON.stringify(heroModels),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // multi-page: the game and the hero preview page
      input: {
        main: 'index.html',
        hero: 'hero.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'scripts/art/anatomy', 'src/game/iso/isoKit.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // jumps.ts is the numeric twin of jumps.mjs and opts out of noUncheckedIndexedAccess with @ts-nocheck.
    files: ['src/game/iso/jumps.ts'],
    rules: { '@typescript-eslint/ban-ts-comment': 'off' },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
);

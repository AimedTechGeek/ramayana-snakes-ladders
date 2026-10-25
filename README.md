# Ramayana Snakes & Ladders

A Snakes & Ladders board game themed on the Ramayana, built with Phaser 3 and TypeScript.

## Getting started

```sh
npm install
npm run dev
```

## Scripts

- `npm test` - run unit tests (Vitest)
- `npm run build` - type-check and build for production into `dist/`

## License

MIT

## Deploying

The game is deployed to GitHub Pages by `.github/workflows/deploy.yml`.

1. In the GitHub repo, go to Settings → Pages and set Source to "GitHub Actions".
2. Every push to `main` runs lint, test, sim and build, then deploys to https://aimedtechgeek.github.io/ramayana-snakes-ladders/ . Pull requests run the same checks but do not deploy.
3. The build uses `base: './'` (see `vite.config.ts`), so it works under the repo sub-path.

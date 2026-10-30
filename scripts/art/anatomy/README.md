# Anatomy kit (vendored)

Source: the `anatomy` skill kit (`kit/`), MIT licensed, see `LICENSE` in this folder.
`iso-kit.mjs`, `lathe.mjs`, `tube.mjs`, `audit.mjs` and `iso.css` are vendored unchanged.
They are excluded from ESLint and Prettier. The runtime TypeScript copy is `src/game/iso/isoKit.ts`.

`line-ends.mjs` is the skill's `scripts/line-ends.mjs` (the in-page line-end check behind `lines.mjs`), also unchanged.
`scripts/art/iso/check.mjs` evaluates it in Edge.

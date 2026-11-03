// The node:fs calls the GLB tests and vite.config.ts need (the project does not depend on @types/node).
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function statSync(path: string): { size: number };
  export function readdirSync(path: string): string[];
}

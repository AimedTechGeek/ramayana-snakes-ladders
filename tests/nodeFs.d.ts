// The two node:fs calls the GLB test needs (the project does not depend on @types/node).
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function statSync(path: string): { size: number };
}

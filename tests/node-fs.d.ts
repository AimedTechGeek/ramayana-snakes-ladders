// The repo has no @types/node; this is the one Node call the die test needs (reading die.glb from disk).
declare module 'node:fs' {
  export function readFileSync(path: URL): { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
}

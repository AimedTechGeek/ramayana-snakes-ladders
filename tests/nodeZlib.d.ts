// The one zlib call the snake GLB test needs (the project does not depend on @types/node).
declare module 'node:zlib' {
  export function brotliCompressSync(data: Uint8Array): Uint8Array;
}

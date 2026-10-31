export interface CoilVolume {
  name: string;
  c: [number, number];
  r: number;
  z0: number;
  z1: number;
}
export interface Coil {
  id: string;
  R: number;
  square: number;
  centre: [number, number];
  outer: number;
  top: number;
  volumes: CoilVolume[];
}
export function coilEnvelope(R: number): { outer: number; head: number; stack: number };
export function coilVolumes(id: string, square: number): Coil;
export function allCoils(): Coil[];

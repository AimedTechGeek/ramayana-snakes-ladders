// Pieces on the board: the rigged clay heroes (all six; Bharata and Shatrughna once their GLBs land), clay peg figures for the heroes whose models are still to come,
// placeholder bridges and snakes that rise when revealed, bounce puffs, and the head anchors of the speech bubbles.

import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useMemo, useRef, useSyncExternalStore } from 'react';
import { Group, Mesh, MeshBasicMaterial, Vector2, Vector3 } from 'three';
import type { Hero } from '../../core/types';
import { HEROES } from '../../game/heroes';
import { toThree } from './coords';
import type { DioramaView } from './DioramaView';
import { Hero as HeroFigure, blob, useHeroActor, type HeroHandle, type HeroId } from './Hero';
import { angleDelta } from './heroClips';
import { Bridges } from './Bridge';
import { HERO_SCALE } from './figureScale';

export function Jumps({ view }: { view: DioramaView }) {
  useSyncExternalStore(view.subscribe, view.getVersion);
  const board = view.setup?.board;
  if (!board) return null;
  return (
    <group>
      <Bridges view={view} />
    </group>
  );
}

/** Places a token's group at its feet each frame; the figure inside faces, poses and lights itself. */
function useTokenPlacement(view: DioramaView, player: number) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const node = group.current;
    const token = view.tokens[player];
    const at = view.tokenPosition(player);
    if (!node || !token || !at) return;
    node.position.set(at[0], at[1], at[2]);
    node.scale.setScalar(Math.max(0.001, token.scale) * HERO_SCALE); // the ring, blob and figure inside scale with it
    node.visible = !token.hidden;
  });
  return group;
}

/** Heroes with a rigged clay GLB (the others are pegs until their models land). */
const RIGGED: readonly Hero[] = ['hanuman', 'rama', 'lakshmana', 'sita', 'bharata', 'shatrughna'];
/**
 * The hero GLBs actually in `public/models/heroes`, listed by vite.config.ts at build time. A rigged hero whose GLB
 * has not landed yet stays a peg and is never requested, so a missing model makes no 404 and no loader error.
 */
declare const __HERO_MODELS__: readonly string[];
const SHIPPED_MODELS: readonly string[] = __HERO_MODELS__;
const isRigged = (hero: Hero): hero is HeroId => RIGGED.includes(hero) && SHIPPED_MODELS.includes(hero);

/** A rigged clay hero, driven by the view through heroDirector (useHeroActor). */
function RiggedToken({
  view,
  player,
  hero: heroId,
  reducedMotion,
}: {
  view: DioramaView;
  player: number;
  hero: HeroId;
  reducedMotion: boolean;
}) {
  const group = useTokenPlacement(view, player);
  const hero = useRef<HeroHandle>(null);
  useHeroActor(hero, view, player, { reducedMotion });
  return (
    <group ref={group}>
      <HeroFigure ref={hero} hero={heroId} reducedMotion={reducedMotion} />
    </group>
  );
}

// ---- placeholder peg figures (Rama and Sita until their GLBs land in T44.9-10)

const PEG_SKIN: Record<Hero, string> = {
  rama: '#E8B58C',
  sita: '#F2C29B',
  lakshmana: '#F0B57C',
  bharata: '#E6B088',
  shatrughna: '#EEB680',
  hanuman: '#F0A96B',
};
/**
 * The circlet each hero wears: Rama's gold crown band, Sita's thin tiara, Lakshmana's saffron headband, Bharata's
 * gold regent's band, Shatrughna's gold headband.
 */
const PEG_BAND: Record<Hero, { color: string; tube: number }> = {
  rama: { color: '#E9C12F', tube: 0.035 },
  sita: { color: '#E9C12F', tube: 0.016 },
  lakshmana: { color: '#F39C2B', tube: 0.028 },
  bharata: { color: '#E9C12F', tube: 0.032 },
  shatrughna: { color: '#E9C12F', tube: 0.024 },
  hanuman: { color: '#E9C12F', tube: 0.03 },
};
const PEG_HEAD_Y = 0.98;
const PEG_HEAD_R = 0.155;
/** Viewport anchor for a figure's speech bubble: just above its crown at full size; the board uses `HEAD_TOP * HERO_SCALE`. */
export const HEAD_TOP = 1.4;
const RING_RADIUS = 0.26;
const PULSE_MS = 1200;

/** A turned clay pawn: wide foot, waist, shoulders, neck (lathe profile, u). */
const PEG_PROFILE: [number, number][] = [
  [0, 0],
  [0.19, 0],
  [0.2, 0.04],
  [0.17, 0.1],
  [0.13, 0.32],
  [0.12, 0.5],
  [0.15, 0.66],
  [0.14, 0.76],
  [0.08, 0.83],
  [0.06, 0.86],
  [0, 0.86],
];

function PegToken({
  view,
  player,
  hero,
  reducedMotion,
}: {
  view: DioramaView;
  player: number;
  hero: Hero;
  reducedMotion: boolean;
}) {
  const group = useTokenPlacement(view, player);
  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);
  const profile = useMemo(() => PEG_PROFILE.map(([r, y]) => new Vector2(r, y)), []);
  const band = PEG_BAND[hero];
  const yaw = useRef(0);
  useFrame((state, delta) => {
    const node = body.current;
    const token = view.tokens[player];
    if (!node || !token) return;
    const now = performance.now();
    // eased facing (120 ms), snapped under reduced motion
    const target = token.heading;
    yaw.current = reducedMotion
      ? target
      : yaw.current + angleDelta(yaw.current, target) * (1 - Math.exp(-(delta * 1000) / 120));
    node.rotation.y = yaw.current;
    // a soft gesture per mood: a little bounce when glad, a lean back when scared, a droop when sad
    const emotion = view.moods[player]?.emotion ?? (view.ranking?.[0] === player ? 'excited' : 'idle');
    const t = state.clock.elapsedTime;
    let lean = 0;
    let hop = 0;
    if (!reducedMotion) {
      if (emotion === 'happy' || emotion === 'excited') hop = Math.abs(Math.sin(t * 7)) * 0.05;
      else if (emotion === 'scared') lean = -0.14;
      else if (emotion === 'sad') lean = 0.16;
    }
    node.position.y = hop;
    node.rotation.x = lean;
    // the walk bob rocks the pawn side to side like a toy being walked
    const walking = !reducedMotion && !token.gliding && token.lift > 0.005 && token.lift < 0.1;
    node.rotation.z = walking ? Math.sin(t * 18) * 0.07 : 0;
    const lit = view.current === player && token.override === null;
    if (ring.current) ring.current.visible = lit;
    if (ringMaterial.current)
      ringMaterial.current.opacity = reducedMotion
        ? 0.8
        : 0.7 + 0.3 * Math.sin((now / PULSE_MS) * Math.PI * 2);
  });
  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} renderOrder={1}>
        <planeGeometry args={[0.75, 0.75]} />
        <meshBasicMaterial map={blob()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh
        ref={ring}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.008, 0]}
        renderOrder={2}
        visible={false}
      >
        <ringGeometry args={[RING_RADIUS - 0.03, RING_RADIUS, 48]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color="#F39C2B"
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={body}>
        <mesh castShadow>
          <latheGeometry args={[profile, 28]} />
          <meshStandardMaterial color={HEROES[hero].cssColor} roughness={0.85} />
        </mesh>
        {/* sash */}
        <mesh position={[0, 0.46, 0]} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
          <torusGeometry args={[0.122, 0.022, 8, 28]} />
          <meshStandardMaterial color="#E9C12F" roughness={0.45} metalness={0.4} />
        </mesh>
        <mesh position={[0, PEG_HEAD_Y, 0]} castShadow>
          <sphereGeometry args={[PEG_HEAD_R, 28, 20]} />
          <meshStandardMaterial color={PEG_SKIN[hero]} roughness={0.8} />
        </mesh>
        {/* hair cap and top-knot */}
        <mesh position={[0, PEG_HEAD_Y + 0.02, -0.012]} scale={[1.04, 0.92, 1.04]}>
          <sphereGeometry args={[PEG_HEAD_R, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          <meshStandardMaterial color="#2E2433" roughness={0.9} />
        </mesh>
        <mesh position={[0, PEG_HEAD_Y + PEG_HEAD_R + 0.04, -0.02]}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshStandardMaterial color="#2E2433" roughness={0.9} />
        </mesh>
        <mesh position={[0, PEG_HEAD_Y + 0.07, -0.004]} rotation={[Math.PI / 2 + 0.1, 0, 0]}>
          <torusGeometry args={[PEG_HEAD_R * 0.98, band.tube, 8, 28]} />
          <meshStandardMaterial color={band.color} roughness={0.4} metalness={0.5} />
        </mesh>
        {/* eyes, so the heading reads */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.055, PEG_HEAD_Y + 0.01, PEG_HEAD_R * 0.93]}>
            <sphereGeometry args={[0.018, 10, 8]} />
            <meshBasicMaterial color="#2B2F5C" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function Tokens({ view, reducedMotion }: { view: DioramaView; reducedMotion: boolean }) {
  useSyncExternalStore(view.subscribe, view.getVersion);
  const players = view.setup?.state.players ?? [];
  return (
    <group>
      {players.map((player, i) =>
        isRigged(player.hero) ? (
          <Suspense
            key={i}
            fallback={<PegToken view={view} player={i} hero={player.hero} reducedMotion={reducedMotion} />}
          >
            <RiggedToken view={view} player={i} hero={player.hero} reducedMotion={reducedMotion} />
          </Suspense>
        ) : (
          <PegToken key={i} view={view} player={i} hero={player.hero} reducedMotion={reducedMotion} />
        ),
      )}
    </group>
  );
}

/** Each token's head projected to viewport pixels, ~10 times a second while a speech bubble shows. */
export function BubbleAnchors({ view }: { view: DioramaView }) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const last = useRef(0);
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const now = performance.now();
    if (now - last.current < 100) return;
    last.current = now;
    const speaking = view.bubbles.some((bubble) => bubble !== null);
    if (!speaking) {
      if (view.anchors.length > 0) view.setAnchors([]);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    view.setAnchors(
      view.tokens.map((_, player) => {
        const at = view.tokenPosition(player);
        if (!at || view.tokens[player]!.square === 0) return null;
        point.set(at[0], at[1] + HEAD_TOP * HERO_SCALE, at[2]).project(camera);
        if (point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return null;
        return {
          x: rect.left + ((point.x + 1) / 2) * rect.width,
          y: rect.top + ((1 - point.y) / 2) * rect.height,
        };
      }),
    );
  });
  return null;
}

/** Rings drawn at once: a token's bounce, or a long bridge's dust (two abutments and up to three piers). */
const PUFF_RINGS = 6;

/** Rings that grow and fade: where a token turned round at 144, and at a bridge's feet when it lands (T44.14). */
export function Puffs({ view }: { view: DioramaView }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const now = performance.now();
    view.puffs = view.puffs.filter((puff) => now - puff.start < puff.ms);
    meshes.current.forEach((node, i) => {
      if (!node) return;
      const puff = view.puffs[i];
      node.visible = puff !== undefined;
      if (!puff) return;
      const u = (now - puff.start) / puff.ms;
      node.position.set(...toThree(puff.at, 0.02));
      node.scale.setScalar((0.4 + u * 1.2) * puff.size);
      (node.material as MeshBasicMaterial).opacity = 1 - u;
    });
  });
  return (
    <>
      {Array.from({ length: PUFF_RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            meshes.current[i] = node;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.2, 0.32, 32]} />
          <meshBasicMaterial color="#fff6dc" transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// Placeholder pieces on the board: bridges and snakes that rise when revealed, capsule tokens, bounce puffs.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Group, Mesh, MeshBasicMaterial, TubeGeometry } from 'three';
import type { Jump } from '../../core/types';
import { HEROES } from '../../game/heroes';
import type { Hero } from '../../core/types';
import { toThree } from './coords';
import type { DioramaView } from './DioramaView';
import { bridgeCurve, snakeCurve } from './jumpCurves';

const TOKEN_RADIUS = 0.17;
const TOKEN_LENGTH = 0.32;

function JumpPiece({ view, jump, kind }: { view: DioramaView; jump: Jump; kind: 'ladder' | 'snake' }) {
  const group = useRef<Group>(null);
  const geometry = useMemo(
    () =>
      kind === 'ladder'
        ? new TubeGeometry(bridgeCurve(jump), 48, 0.09, 8, false)
        : new TubeGeometry(snakeCurve(jump), 64, 0.08, 8, false),
    [jump, kind],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const head = useMemo(() => snakeCurve(jump).getPoint(0), [jump]);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const rise = view.jumpRise.get(jump.from) ?? 0;
    node.visible = rise > 0;
    node.scale.set(1, Math.max(0.001, rise), 1);
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color={kind === 'ladder' ? '#cdbb9a' : '#3d7a3a'}
          roughness={kind === 'ladder' ? 0.85 : 0.5}
        />
      </mesh>
      {kind === 'snake' && (
        <mesh position={head} castShadow>
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshStandardMaterial color="#2e5e2b" roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

export function Jumps({ view }: { view: DioramaView }) {
  useSyncExternalStore(view.subscribe, view.getVersion);
  const board = view.setup?.board;
  if (!board) return null;
  return (
    <group>
      {board.ladders.map((jump) => (
        <JumpPiece key={`l${jump.from}`} view={view} jump={jump} kind="ladder" />
      ))}
      {board.snakes.map((jump) => (
        <JumpPiece key={`s${jump.from}`} view={view} jump={jump} kind="snake" />
      ))}
    </group>
  );
}

function Token({ view, player, hero }: { view: DioramaView; player: number; hero: Hero }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  useFrame(() => {
    const node = group.current;
    const token = view.tokens[player];
    const at = view.tokenPosition(player);
    if (!node || !token || !at) return;
    node.position.set(at[0], at[1], at[2]);
    node.rotation.y = token.heading;
    node.scale.setScalar(Math.max(0.001, token.scale));
    if (ring.current) ring.current.visible = view.current === player && token.override === null;
  });
  return (
    <group ref={group}>
      <mesh position={[0, TOKEN_RADIUS + TOKEN_LENGTH / 2, 0]} castShadow>
        <capsuleGeometry args={[TOKEN_RADIUS, TOKEN_LENGTH, 6, 16]} />
        <meshStandardMaterial color={HEROES[hero].cssColor} roughness={0.4} />
      </mesh>
      {/* A nose, so the heading shows. */}
      <mesh position={[0, TOKEN_RADIUS + TOKEN_LENGTH * 0.8, TOKEN_RADIUS * 0.9]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#fff3d6" />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.22, 0.28, 32]} />
        <meshBasicMaterial color="#ffcc33" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Tokens({ view }: { view: DioramaView }) {
  useSyncExternalStore(view.subscribe, view.getVersion);
  const players = view.setup?.state.players ?? [];
  return (
    <group>
      {players.map((player, i) => (
        <Token key={i} view={view} player={i} hero={player.hero} />
      ))}
    </group>
  );
}

/** A ring that grows and fades where a token turned round at 144. */
export function Puffs({ view }: { view: DioramaView }) {
  const mesh = useRef<Mesh>(null);
  useFrame(() => {
    const node = mesh.current;
    if (!node) return;
    const now = performance.now();
    view.puffs = view.puffs.filter((puff) => now - puff.start < puff.ms);
    const puff = view.puffs[0];
    node.visible = puff !== undefined;
    if (!puff) return;
    const u = (now - puff.start) / puff.ms;
    node.position.set(...toThree(puff.at, 0.02));
    node.scale.setScalar(0.4 + u * 1.2);
    (node.material as MeshBasicMaterial).opacity = 1 - u;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.2, 0.32, 32]} />
      <meshBasicMaterial color="#fff6dc" transparent depthWrite={false} />
    </mesh>
  );
}

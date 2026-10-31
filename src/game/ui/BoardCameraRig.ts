import Phaser from 'phaser';
import {
  BOARD_VIEWPORT,
  BUTTON_ZOOM_STEP,
  EASE_MS,
  clampZoom,
  easeView,
  fitView,
  followTarget,
  isDrag,
  keepInView,
  panBy,
  pinchView,
  worldToView,
  zoomToward,
  type Point,
  type View,
} from '../boardCamera';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../hidpi';

/**
 * Which camera shows an object. `board` objects live in board world coordinates and are drawn by the zoomable board
 * camera (left 784x720 of the screen); `hud` objects live in 1280x720 screen coordinates and are drawn by the fixed HUD camera.
 */
export type Layer = 'board' | 'hud';

/** Wheel delta to zoom factor: one notch (100) is about 15 %. */
const WHEEL_ZOOM_PER_PIXEL = 0.0015;

/**
 * Two cameras for BoardScene (T42.A): the zoomable, pannable board camera (scene.cameras.main, viewport = the board
 * area) and a fixed HUD camera on top of it. Create the rig first in `create`, then build every object inside
 * `within('board' | 'hud', ...)`. Objects added outside a `within` are picked up on the next frame, logged and put on
 * the HUD, so a forgotten one is visible in the console instead of being drawn twice.
 */
export class BoardCameraRig {
  readonly board: Phaser.Cameras.Scene2D.Camera;
  readonly hud: Phaser.Cameras.Scene2D.Camera;
  /** The view the board camera shows now (user zoom 1 = whole board). */
  private shown: View = fitView();
  private goal: View = fitView();
  private followPaused = false;
  private followPoint: Point | null = null;
  private building: Layer | null = null;
  private built: Phaser.GameObjects.GameObject[] = [];
  private readonly stray = new Set<Phaser.GameObjects.GameObject>();
  private readonly reducedMotion: MediaQueryList | null =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  private drag: { id: number; grab: Point; start: View; moved: boolean } | null = null;
  private pinch: { start: View; mid: Point; distance: number } | null = null;
  private dragged = false;

  /** `isFast` tells whether Fast mode is on (follow pans are then instant). */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isFast: () => boolean,
  ) {
    this.board = scene.cameras.main;
    this.hud = scene.cameras.add(0, 0, LOGICAL_WIDTH * DPR, LOGICAL_HEIGHT * DPR);
    this.hud.setZoom(DPR).centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    this.board.setViewport(0, 0, BOARD_VIEWPORT.width * DPR, BOARD_VIEWPORT.height * DPR);
    this.apply();

    const list = scene.sys.displayList.events;
    list.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
    list.on(Phaser.Scenes.Events.REMOVED_FROM_SCENE, this.onRemoved, this);
    scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.preUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      list.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
      list.off(Phaser.Scenes.Events.REMOVED_FROM_SCENE, this.onRemoved, this);
      scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.preUpdate, this);
    });
    this.listenToPointer();
  }

  /** Runs `build`; every object it adds to the scene goes to `layer`. Returns what `build` returns. */
  within<T>(layer: Layer, build: () => T): T {
    return this.collect(layer, build).value;
  }

  /** Like `within`, and also returns the objects created, so they can be moved to the other layer later. */
  collect<T>(layer: Layer, build: () => T): { value: T; objects: Phaser.GameObjects.GameObject[] } {
    const outerLayer = this.building;
    const outerBuilt = this.built;
    this.building = layer;
    this.built = [];
    try {
      const value = build();
      return { value, objects: this.built };
    } finally {
      this.building = outerLayer;
      this.built = outerBuilt;
    }
  }

  /** Puts objects on a layer (again): hides them from the other camera and shows them to this layer's. */
  assign(layer: Layer, objects: readonly Phaser.GameObjects.GameObject[]): void {
    const show = layer === 'board' ? this.board : this.hud;
    const hide = layer === 'board' ? this.hud : this.board;
    for (const object of objects) {
      object.cameraFilter = (object.cameraFilter & ~show.id) | hide.id;
      this.stray.delete(object);
    }
  }

  /** Objects added to the scene outside any `within`, not yet put on a layer (for tests). */
  get strayCount(): number {
    return this.stray.size;
  }

  /** The view the board camera shows now. */
  get view(): Readonly<View> {
    return this.shown;
  }

  /** The view the camera is easing to. */
  get target(): Readonly<View> {
    return this.goal;
  }

  /** True when the last press-move-release on the board was a drag, so a tap handler can ignore it. */
  get lastGestureWasDrag(): boolean {
    return this.dragged;
  }

  /** Board world point to HUD screen point (logical px): where a board object appears, for HUD items anchored to it. */
  boardToHud(world: Point): Point {
    return worldToView(this.shown, world);
  }

  /** User zoom now (1 = fit). */
  get zoom(): number {
    return this.shown.zoom;
  }

  /** A turn starts: follow resumes and eases to the token's board point, or to the whole board when it is on its seat card. */
  startTurn(world: Point | null): void {
    this.followPaused = false;
    this.followPoint = world;
    this.goal = world ? followTarget(world) : fitView();
  }

  /** While a token moves: eases the camera to keep `world` centred at the follow zoom. No-op once the player took manual control. */
  follow(world: Point): void {
    if (this.followPaused) return;
    this.followPoint = world;
    this.goal = followTarget(world);
  }

  zoomIn(): void {
    this.zoomButton(BUTTON_ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomButton(1 / BUTTON_ZOOM_STEP);
  }

  /** Whole board in view; follow resumes (it applies again when a token next moves or a turn starts). */
  fit(): void {
    this.followPaused = false;
    this.followPoint = null;
    this.goal = fitView();
  }

  private zoomButton(factor: number): void {
    this.pauseFollow();
    const centre = { x: BOARD_VIEWPORT.width / 2, y: BOARD_VIEWPORT.height / 2 };
    this.goal = zoomToward(this.goal, clampZoom(this.goal.zoom * factor), centre);
  }

  private pauseFollow(): void {
    this.followPaused = true;
    this.followPoint = null;
  }

  /** Direct manipulation (wheel, drag, pinch): the camera is set at once, not eased. */
  private setNow(view: View): void {
    this.pauseFollow();
    this.shown = view;
    this.goal = view;
    this.apply();
  }

  private get easeMs(): number {
    return this.isFast() || this.reducedMotion?.matches ? 0 : EASE_MS;
  }

  private preUpdate(_time: number, delta: number): void {
    if (this.stray.size > 0) {
      console.warn(
        `BoardCameraRig: ${this.stray.size} object(s) added outside within(); put on the HUD layer`,
      );
      this.assign('hud', [...this.stray]);
    }
    let next = easeView(this.shown, this.goal, delta, this.easeMs);
    if (this.followPoint) next = keepInView(next, this.followPoint);
    if (next.zoom !== this.shown.zoom || next.cx !== this.shown.cx || next.cy !== this.shown.cy) {
      this.shown = next;
      this.apply();
    }
  }

  private apply(): void {
    this.board.setZoom(DPR * this.shown.zoom).centerOn(this.shown.cx, this.shown.cy);
  }

  private onAdded(object: Phaser.GameObjects.GameObject): void {
    if (this.building) {
      this.assign(this.building, [object]);
      this.built.push(object);
    } else {
      this.stray.add(object);
    }
  }

  private onRemoved(object: Phaser.GameObjects.GameObject): void {
    this.stray.delete(object);
  }

  // Pointer input: wheel zoom, drag pan and two-finger pinch on the board area.

  /** Pointer position in logical screen px. */
  private logical(pointer: Phaser.Input.Pointer): Point {
    return { x: pointer.x / DPR, y: pointer.y / DPR };
  }

  private overBoard(point: Point): boolean {
    return point.x >= 0 && point.x < BOARD_VIEWPORT.width && point.y >= 0 && point.y < BOARD_VIEWPORT.height;
  }

  private listenToPointer(): void {
    const input = this.scene.input;
    input.addPointer(1); // a second touch for pinch

    input.on('wheel', (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const at = this.logical(pointer);
      if (!this.overBoard(at)) return;
      const factor = Math.exp(-dy * WHEEL_ZOOM_PER_PIXEL);
      this.setNow(zoomToward(this.shown, clampZoom(this.shown.zoom * factor), at));
    });

    input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: unknown[]) => {
      const at = this.logical(pointer);
      if (!this.overBoard(at) || over.length > 0) return;
      if (this.drag && this.drag.id !== pointer.id) {
        this.startPinch();
        return;
      }
      this.dragged = false;
      this.drag = { id: pointer.id, grab: at, start: this.shown, moved: false };
    });

    input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pinch) {
        this.movePinch();
        return;
      }
      const drag = this.drag;
      if (!drag || drag.id !== pointer.id || !pointer.isDown) return;
      const at = this.logical(pointer);
      if (!drag.moved && !isDrag(drag.grab, at)) return;
      drag.moved = true;
      this.dragged = true;
      this.setNow(panBy(drag.start, drag.grab, at));
    });

    const release = (pointer: Phaser.Input.Pointer) => {
      if (this.pinch) {
        this.pinch = null;
        this.drag = null;
      } else if (this.drag?.id === pointer.id) {
        this.drag = null;
      }
    };
    input.on('pointerup', release);
    input.on('pointerupoutside', release);
  }

  private touches(): [Phaser.Input.Pointer, Phaser.Input.Pointer] | null {
    const { pointer1, pointer2 } = this.scene.input;
    return pointer1.isDown && pointer2.isDown ? [pointer1, pointer2] : null;
  }

  private pinchState(a: Phaser.Input.Pointer, b: Phaser.Input.Pointer): { mid: Point; distance: number } {
    const pa = this.logical(a);
    const pb = this.logical(b);
    return {
      mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 },
      distance: Math.hypot(pa.x - pb.x, pa.y - pb.y),
    };
  }

  private startPinch(): void {
    const fingers = this.touches();
    if (!fingers) return;
    this.dragged = true;
    this.pinch = { start: this.shown, ...this.pinchState(...fingers) };
  }

  private movePinch(): void {
    const fingers = this.touches();
    if (!fingers || !this.pinch) return;
    const now = this.pinchState(...fingers);
    this.setNow(pinchView(this.pinch.start, this.pinch.mid, this.pinch.distance, now.mid, now.distance));
  }
}

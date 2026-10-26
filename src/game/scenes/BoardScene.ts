import Phaser from 'phaser';
import { Character } from '../../characters/Character';
import { orderedDelay, pickSpeakers, reactionsFor, type Cue } from '../../characters/reactionMapper';
import { reactionFor, scaled, TIMING } from '../../characters/reactions';
import { speech, t } from '../../i18n/i18n';
import { boardFor, type StoryBoard } from '../../core/boards';
import { createRandomDice, type Dice } from '../../core/dice';
import type { GameEvent } from '../../core/events';
import { Game } from '../../core/game';
import type { GameConfig, GameState } from '../../core/types';
import { getAudio, type Audio } from '../audio';
import { BOARD_BACKGROUND_KEY, LADDER_LOOKS, SNAKE_LOOKS, snakeHeadKey, tokenKey } from '../assets';
import { HEROES, heroName } from '../heroes';
import { BOARD, PANEL, SEAT, fanOffset, seatTokenSpot, seatTop, squareCenter, type Point } from '../layout';
import { COLORS, CSS, BODY_FONT, TITLE_FONT } from '../palette';
import { bouncePuff, dustPuff, ensureFxTextures, goldBurst, ringPulse, shake, sparkleTrail } from '../fx';
import { clearSave, saveGame } from '../save';
import { tweenAsync } from '../tween';
import { DiceButton } from '../ui/DiceButton';
import { SpeechBubble } from '../ui/SpeechBubble';

interface Chip {
  setLabel(text: string): Chip;
  setActive(on: boolean): void;
}

export type BoardSceneData =
  { config: GameConfig; state?: undefined } | { config?: undefined; state: GameState };

// Timing from docs/design/reactions.json.
const STEP_MS = 120;
const FAST_STEP_MS = 40;
const BOT_DELAY_MS = 1000;
const FAST_BOT_DELAY_MS = 400;

export class BoardScene extends Phaser.Scene {
  private engine!: Game;
  private board!: StoryBoard;
  private dice: Dice = createRandomDice();
  private tokens: Phaser.GameObjects.Container[] = [];
  /** Square each token is drawn on; trails the engine while animations run. */
  private shownSquare: number[] = [];
  private seatPositionText: Phaser.GameObjects.Text[] = [];
  private seatFrames: Phaser.GameObjects.Rectangle[] = [];
  private characters: Character[] = [];
  private bubbles: SpeechBubble[] = [];
  /** Last line shown per speech key, so a bubble does not repeat itself. */
  private lastLines = new Map<string, string>();
  /** Scene time each seat's latest reaction starts; later events never start before it. */
  private seatStartAt: number[] = [];
  private dieButton!: DiceButton;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerDot!: Phaser.GameObjects.Arc;
  private hintText!: Phaser.GameObjects.Text;
  private fastChip!: Chip;
  private muteChip!: Chip;
  private busy = false;
  private audio!: Audio;

  constructor() {
    super('Board');
  }

  init(data: BoardSceneData): void {
    if (data.state) {
      this.board = boardFor(data.state.level);
      this.engine = Game.restore(data.state, this.board, this.dice);
    } else {
      this.board = boardFor(data.config.level);
      this.engine = Game.create(data.config, this.board, this.dice);
    }
    this.tokens = [];
    this.shownSquare = [];
    this.seatPositionText = [];
    this.seatFrames = [];
    this.characters = [];
    this.bubbles = [];
    this.lastLines = new Map();
    this.seatStartAt = [];
    this.busy = false;
  }

  create(): void {
    this.audio = getAudio(this.game.registry.get('muted') === true);
    ensureFxTextures(this);
    this.drawBoard();
    this.drawJumps();
    this.drawSeats();
    this.createTokens();
    this.createHud();

    const keys = this.input.keyboard;
    keys?.on('keydown-SPACE', () => void this.requestRoll());
    keys?.on('keydown-ENTER', () => void this.requestRoll());
    keys?.on('keydown-F', () => this.toggleFast());
    keys?.on('keydown-M', () => this.toggleMute());
    keys?.on('keydown-ESC', () => this.openMenu());
    const unlock = () => this.audio.unlock();
    this.input.once('pointerdown', unlock);
    keys?.once('keydown', unlock);
    this.events.once('shutdown', () => this.audio.drone(false));
    this.audio.drone(true);

    this.game.registry.set('board', this);
    this.game.registry.set('board-ready', true);
    saveGame(this.snapshot());
    this.busy = true;
    void this.play(this.engine.begin()).then(() => this.afterEvents());
  }

  /** The engine state for tests and saving. */
  snapshot(): GameState {
    return this.engine.snapshot();
  }

  get isBusy(): boolean {
    return this.busy;
  }

  get fastMode(): boolean {
    return this.game.registry.get('fast') === true;
  }

  set fastMode(on: boolean) {
    this.game.registry.set('fast', on);
    this.applyFast();
  }

  /** Rolls for the human whose turn it is. A no-op on bot turns, while busy, or after the game ends. */
  async requestRoll(): Promise<void> {
    this.audio.unlock();
    if (this.busy || this.engine.isOver || this.isBotTurn()) return;
    await this.takeTurn();
  }

  /** Play On: lets the remaining players continue after the first winner, then plays the events. */
  async continuePlay(): Promise<void> {
    if (this.busy || !this.engine.canContinue) return;
    this.busy = true;
    this.audio.drone(true);
    this.dieButton.setEnabled(false);
    this.setHint('');
    await this.play(this.engine.continuePlay());
    this.afterEvents();
  }

  private isBotTurn(): boolean {
    const state = this.snapshot();
    return state.players[state.current]?.controller === 'bot';
  }

  private async takeTurn(): Promise<void> {
    this.busy = true;
    this.dieButton.setEnabled(false);
    this.setHint('');
    await this.play(this.engine.roll());
    this.afterEvents();
  }

  /** Hands control back: a bot schedules its own roll (staying busy), a human gets the dice. */
  private afterEvents(): void {
    if (this.engine.isOver) {
      clearSave();
      this.busy = false;
      this.dieButton.setEnabled(false);
      this.scene.launch('Win', { state: this.snapshot(), canContinue: this.engine.canContinue });
      this.scene.pause();
      return;
    }
    saveGame(this.snapshot());
    if (this.isBotTurn()) {
      this.dieButton.setEnabled(false);
      this.setHint('');
      this.time.delayedCall(this.fastMode ? FAST_BOT_DELAY_MS : BOT_DELAY_MS, () => void this.takeTurn());
      return;
    }
    this.busy = false;
    this.dieButton.setEnabled(true);
    this.setHint(t('ui.rollHint'));
  }

  private async play(events: GameEvent[]): Promise<void> {
    for (const event of events) {
      this.events.emit('game-event', event, this.engine);
      const reactions = this.react(event);
      await this.animate(event);
      if (event.type === 'Won' || event.type === 'GameOver') await reactions;
    }
  }

  private async animate(event: GameEvent): Promise<void> {
    switch (event.type) {
      case 'TurnStarted':
        this.highlightSeat(event.player);
        this.setBanner(event.player);
        return;
      case 'Rolled':
        this.audio.dice();
        await this.dieButton.roll(event.value);
        if (event.value === 6) ringPulse(this, this.dieButton.x, this.dieButton.y, 56, this.fastMode);
        return;
      case 'Moved':
        for (const square of event.path) await this.stepTo(event.player, square);
        return;
      case 'Laddered':
        this.audio.ladder();
        await this.slideTo(event.player, event.jump.to, 'ladder');
        return;
      case 'Bitten':
        this.audio.snake();
        this.biteEffects(event.jump.from);
        await this.slideTo(event.player, event.jump.to, 'snake');
        return;
      case 'TripleSixVoid':
        this.audio.tripleSix();
        this.setHint(t('ui.tripleSix'));
        await this.slideTo(event.player, event.restoredTo, 'void'); // a penalty: plain slide, no celebration
        return;
      case 'Won':
        this.audio.win();
        this.setHint(t('ui.winner', { name: this.playerName(event.player) }));
        return;
      case 'Bounced':
        this.audio.bounce();
        this.bounceEffect();
        return;
      case 'GameOver':
        this.audio.drone(false);
        return;
      case 'ExtraRoll':
        return;
    }
  }

  /**
   * Starts every seated hero's reaction to an event without blocking movement (T05 section 1).
   * Resolves when the last reaction has finished, so Won and GameOver can wait for it.
   */
  private react(event: GameEvent): Promise<void> {
    const players = this.snapshot().players;
    const cues = reactionsFor(event, players);
    const speakers = pickSpeakers(cues);
    const fast = this.fastMode;
    const [minStagger, maxStagger] = TIMING.bystanderStaggerMs;
    const now = this.time.now;
    let latestDelay = 0;
    const runs = cues.map((cue) => {
      const stagger = cue.role === 'self' ? 0 : Phaser.Math.Between(minStagger, maxStagger);
      // Back-to-back events draw fresh staggers; keep each seat's reactions (and bubbles) in event order.
      const delay = orderedDelay(this.seatStartAt, cue.seat, stagger, now);
      latestDelay = Math.max(latestDelay, delay);
      const hero = players[cue.seat]?.hero;
      if (!hero) return Promise.resolve();
      const reaction = reactionFor(hero, cue.role, cue.event);
      const speaks = speakers.includes(cue);
      const start = () => {
        if (speaks) this.showLine(cue, hero, reaction.intensity, fast);
        return this.characterAt(cue.seat).feel(reaction, fast);
      };
      if (delay === 0) return start();
      return new Promise<void>((resolve) => this.time.delayedCall(delay, () => void start().then(resolve)));
    });
    // A reaction cut short by a newer one never resolves, so do not wait on it forever.
    const longest = Math.max(0, ...cues.map((cue) => this.maxDuration(cue, players)));
    const timeout = new Promise<void>((resolve) =>
      this.time.delayedCall(longest + latestDelay + 100, resolve),
    );
    return Promise.race([Promise.all(runs).then(() => undefined), timeout]);
  }

  private maxDuration(cue: Cue, players: GameState['players']): number {
    const hero = players[cue.seat]?.hero;
    return hero ? scaled(reactionFor(hero, cue.role, cue.event), this.fastMode).durationMs : 0;
  }

  private showLine(cue: Cue, hero: string, intensity: number, fast: boolean): void {
    const key = `${hero}.${cue.role}.${cue.event}`;
    let line = speech(hero, cue.role, cue.event);
    if (line !== null && line === this.lastLines.get(key)) line = speech(hero, cue.role, cue.event);
    if (line === null) return;
    this.lastLines.set(key, line);
    this.bubbles[cue.seat]?.say(line, intensity, fast);
  }

  private characterAt(seat: number): Character {
    const character = this.characters[seat];
    if (!character) throw new Error(`No character for seat ${seat}`);
    return character;
  }

  private playerName(player: number): string {
    return this.snapshot().players[player]?.name ?? '';
  }

  private setBanner(player: number): void {
    const hero = HEROES[this.snapshot().players[player]?.hero ?? 'rama'];
    this.bannerText.setText(t('ui.yourTurn', { name: this.playerName(player) }));
    this.bannerDot.setFillStyle(hero.color);
  }

  private setHint(text: string): void {
    this.hintText.setText(text).setVisible(text !== '');
  }

  private createHud(): void {
    this.dieButton = new DiceButton(this, PANEL.x + 64, 552 + 64).setDepth(10);
    this.dieButton.on('press', () => void this.requestRoll());

    this.bannerDot = this.add.circle(864 + 6, 548 + 16, 6, COLORS.parchment).setDepth(10);
    this.bannerText = this.add
      .text(864 + 24, 548, '', { fontFamily: TITLE_FONT, fontSize: '26px', color: CSS.parchment })
      .setDepth(10);
    this.hintText = this.add
      .text(864, 584, '', { fontFamily: BODY_FONT, fontSize: '16px', color: CSS.parchment })
      .setAlpha(0.7)
      .setDepth(10)
      .setVisible(false);

    this.fastChip = this.createChip(864, 624, 128, () => this.toggleFast());
    this.muteChip = this.createChip(1000, 624, 128, () => this.toggleMute());
    this.createChip(1136, 624, 120, () => this.openMenu()).setLabel(t('ui.menu'));
    this.applyFast();
    this.applyMute();
    this.setBanner(this.snapshot().current);
  }

  private createChip(x: number, y: number, width: number, onClick: () => void): Chip {
    const box = this.add
      .rectangle(x, y, width, 56, COLORS.parchment)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.ink)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x + width / 2, y + 28, '', { fontFamily: BODY_FONT, fontSize: '20px', color: CSS.ink })
      .setOrigin(0.5)
      .setDepth(11);
    box.on('pointerdown', onClick);
    const chip: Chip = {
      setLabel: (text) => {
        label.setText(text);
        return chip;
      },
      setActive: (on) => {
        box.setFillStyle(on ? COLORS.indigo : COLORS.parchment);
        label.setColor(on ? CSS.parchment : CSS.ink);
      },
    };
    return chip;
  }

  private toggleFast(): void {
    this.fastMode = !this.fastMode;
  }

  private applyFast(): void {
    this.fastChip?.setActive(this.fastMode);
    this.fastChip?.setLabel(this.fastMode ? `\u00bb\u00bb ${t('ui.fast')}` : `\u00bb ${t('ui.fast')}`);
  }

  private toggleMute(): void {
    this.game.registry.set('muted', this.game.registry.get('muted') !== true);
    this.applyMute();
  }

  private applyMute(): void {
    const muted = this.game.registry.get('muted') === true;
    this.audio.setMuted(muted);
    this.muteChip.setActive(muted);
    this.muteChip.setLabel(muted ? `\u2715 ${t('ui.muted')}` : `\u266a ${t('ui.mute')}`);
  }

  private openMenu(): void {
    this.scene.start('Boot');
  }

  private get stepMs(): number {
    return this.fastMode ? FAST_STEP_MS : STEP_MS;
  }

  /** Slide and settle durations are halved in fast mode. */
  private scaled(ms: number): number {
    return this.fastMode ? ms / 2 : ms;
  }

  private async stepTo(player: number, square: number): Promise<void> {
    this.audio.step();
    const token = this.tokenAt(player);
    this.shownSquare[player] = square;
    const target = this.restingPoint(player);
    await tweenAsync(this, {
      targets: token,
      x: target.x,
      y: target.y,
      duration: this.stepMs,
      ease: 'Sine.easeOut',
    });
    await this.relayout(player);
  }

  private async slideTo(player: number, square: number, kind: 'ladder' | 'snake' | 'void'): Promise<void> {
    const token = this.tokenAt(player);
    const start = new Phaser.Math.Vector2(token.x, token.y);
    this.shownSquare[player] = square;
    const rest = this.restingPoint(player);
    const end = new Phaser.Math.Vector2(rest.x, rest.y);
    const curve =
      kind === 'snake'
        ? new Phaser.Curves.QuadraticBezier(start, this.bend(start, end, 0.35), end)
        : new Phaser.Curves.Line(start, end);
    const progress = { t: 0 };
    const trail = kind === 'ladder' ? sparkleTrail(this, this.fastMode) : undefined;
    let lastSparkle = 0;
    await tweenAsync(this, {
      targets: progress,
      t: 1,
      duration: this.scaled(kind === 'snake' ? 700 : 500),
      ease: kind === 'snake' ? 'Quad.easeIn' : 'Sine.easeInOut',
      onUpdate: () => {
        const p = curve.getPoint(progress.t);
        token.setPosition(p.x, p.y);
        if (trail && progress.t - lastSparkle >= 0.04) {
          lastSparkle = progress.t;
          trail.emit(p.x, p.y);
        }
      },
    });
    trail?.stop();
    if (kind === 'ladder') goldBurst(this, end.x, end.y, this.fastMode);
    else dustPuff(this, end.x, end.y, this.fastMode);
    await this.relayout(player);
  }

  /** Dust at the snake's head and a brief camera shake when a token is bitten. */
  private biteEffects(headSquare: number): void {
    const head = squareCenter(headSquare);
    dustPuff(this, head.x, head.y, this.fastMode);
    shake(this, this.fastMode);
  }

  private bounceEffect(): void {
    const c = squareCenter(144);
    bouncePuff(this, c.x, c.y, this.fastMode);
  }

  /** Re-fan every token sharing the square the given player just reached. */
  private async relayout(player: number): Promise<void> {
    const square = this.shownSquare[player];
    const sharing = this.shownSquare.flatMap((s, i) => (s === square ? [i] : []));
    if (sharing.length < 2) return;
    await Promise.all(
      sharing.map((i) => {
        const p = this.restingPoint(i);
        return tweenAsync(this, { targets: this.tokenAt(i), x: p.x, y: p.y, duration: this.scaled(80) });
      }),
    );
  }

  private restingPoint(player: number): Point {
    const square = this.shownSquare[player] ?? 0;
    if (square === 0) return seatTokenSpot(player);
    const sharing = this.shownSquare.flatMap((s, i) => (s === square ? [i] : []));
    const centre = squareCenter(square);
    const offset = fanOffset(sharing.indexOf(player), sharing.length);
    return { x: centre.x + offset.x, y: centre.y + offset.y };
  }

  private bend(a: Phaser.Math.Vector2, b: Phaser.Math.Vector2, amount: number): Phaser.Math.Vector2 {
    const mid = a.clone().lerp(b, 0.5);
    const normal = new Phaser.Math.Vector2(-(b.y - a.y), b.x - a.x).scale(amount);
    return mid.add(normal);
  }

  private tokenAt(player: number): Phaser.GameObjects.Container {
    const token = this.tokens[player];
    if (!token) throw new Error(`No token for player ${player}`);
    return token;
  }

  private drawBoard(): void {
    this.add
      .image(BOARD.x, BOARD.y, BOARD_BACKGROUND_KEY)
      .setOrigin(0)
      .setDisplaySize(BOARD.size, BOARD.size);
    const g = this.add.graphics();
    for (let square = 1; square <= 144; square++) {
      const c = squareCenter(square);
      const left = c.x - BOARD.cell / 2 + 4;
      const top = c.y - BOARD.cell / 2 + 4;
      const chipWidth = square > 99 ? 30 : 22;
      g.fillStyle(COLORS.parchment, 0.55);
      g.fillRect(left, top, chipWidth, 16);
      this.add
        .text(left + chipWidth / 2, top + 8, String(square), {
          fontFamily: BODY_FONT,
          fontSize: '14px',
          fontStyle: 'bold',
          color: CSS.ink,
        })
        .setOrigin(0.5);
    }
    g.lineStyle(4, COLORS.gold, 1);
    g.strokeRect(BOARD.x - 2, BOARD.y - 2, BOARD.size + 4, BOARD.size + 4);
    g.lineStyle(2, COLORS.ink, 1);
    g.strokeRect(BOARD.x - 5, BOARD.y - 5, BOARD.size + 10, BOARD.size + 10);
  }

  private drawJumps(): void {
    const g = this.add.graphics().setDepth(2);
    for (const ladder of this.board.ladders)
      this.drawLadder(g, ladder.id, squareCenter(ladder.from), squareCenter(ladder.to));
    for (const snake of this.board.snakes)
      this.drawSnake(g, snake.id, squareCenter(snake.from), squareCenter(snake.to));
  }

  /** Points of a line from foot to top, bowed sideways by `bow` and shifted by `offset` plus a sine `wave`. */
  private ladderLine(foot: Point, top: Point, offset: number, bow = 0, wave = 0): Phaser.Math.Vector2[] {
    const a = new Phaser.Math.Vector2(foot.x, foot.y);
    const b = new Phaser.Math.Vector2(top.x, top.y);
    const length = a.distance(b);
    const side = new Phaser.Math.Vector2(-(b.y - a.y), b.x - a.x).normalize();
    const steps = Math.max(8, Math.ceil(length / 5));
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lateral = offset + bow * 4 * t * (1 - t) + wave * Math.sin((t * length) / 5);
      points.push(a.clone().lerp(b, t).add(side.clone().scale(lateral)));
    }
    return points;
  }

  /** A stroked polyline with an ink outline underneath. */
  private strokeLine(
    g: Phaser.GameObjects.Graphics,
    points: readonly Phaser.Math.Vector2[],
    width: number,
    color: number,
  ): void {
    for (const [w, c] of [
      [width + 3, COLORS.ink],
      [width, color],
    ] as const) {
      g.lineStyle(w, c, 1);
      g.beginPath();
      points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();
    }
  }

  private drawLadder(g: Phaser.GameObjects.Graphics, id: string, foot: Point, top: Point): void {
    const look = LADDER_LOOKS[id];
    if (!look) throw new Error(`No ladder look for ${id}`);
    const rail = Phaser.Display.Color.HexStringToColor(look.rail).color;
    const rung = Phaser.Display.Color.HexStringToColor(look.rung).color;
    const length = Phaser.Math.Distance.Between(foot.x, foot.y, top.x, top.y);
    const rungCount = Math.max(2, Math.floor(length / 22));
    const half = 9;

    /** Rungs span between two rails sampled at the same parameter. */
    const drawRungs = (left: readonly Phaser.Math.Vector2[], right: readonly Phaser.Math.Vector2[]): void => {
      for (let i = 1; i < rungCount; i++) {
        const k = Math.round((i / rungCount) * (left.length - 1));
        const p = left[k]!;
        const q = right[k]!;
        g.lineStyle(5, COLORS.ink, 1);
        g.lineBetween(p.x, p.y, q.x, q.y);
        g.lineStyle(3, rung, 1);
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    };

    switch (look.style) {
      case 'wood':
      case 'bow': {
        const bow = look.style === 'bow' ? 14 : 0;
        const left = this.ladderLine(foot, top, -half, bow);
        const right = this.ladderLine(foot, top, half, bow);
        this.strokeLine(g, left, 4, rail);
        this.strokeLine(g, right, 4, rail);
        drawRungs(left, right);
        break;
      }
      case 'rope':
      case 'vine': {
        const wave = look.style === 'rope' ? 1.6 : 2.2;
        const left = this.ladderLine(foot, top, -half, 0, wave);
        const right = this.ladderLine(foot, top, half, 0, -wave);
        this.strokeLine(g, left, 3, rail);
        this.strokeLine(g, right, 3, rail);
        drawRungs(left, right);
        if (look.style === 'rope') {
          // Knots where the rungs tie onto the ropes.
          for (let i = 1; i < rungCount; i++) {
            const k = Math.round((i / rungCount) * (left.length - 1));
            for (const p of [left[k]!, right[k]!]) {
              g.fillStyle(COLORS.ink, 1);
              g.fillCircle(p.x, p.y, 3.5);
              g.fillStyle(rail, 1);
              g.fillCircle(p.x, p.y, 2.2);
            }
          }
        } else {
          // Leaf dots along the vines.
          g.fillStyle(0x6fb35c, 1);
          for (let k = 4; k < left.length; k += 6) {
            g.fillCircle(left[k]!.x, left[k]!.y, 3);
            g.fillCircle(right[k]!.x, right[k]!.y, 3);
          }
        }
        break;
      }
      case 'stone': {
        const stones = Math.max(2, Math.floor(length / 24));
        for (let i = 0; i <= stones; i++) {
          const t = i / stones;
          const x = foot.x + (top.x - foot.x) * t + (i % 2 === 0 ? -3 : 3);
          const y = foot.y + (top.y - foot.y) * t;
          g.fillStyle(COLORS.ink, 1);
          g.fillEllipse(x, y, 22, 15);
          g.fillStyle(rail, 1);
          g.fillEllipse(x, y, 18, 11);
          g.fillStyle(rung, 1);
          g.fillEllipse(x - 3, y - 2, 7, 3);
        }
        break;
      }
      case 'tail': {
        // An orange tail with an ink outline, short fur ticks and a tuft at the top.
        const body = this.ladderLine(foot, top, 0, 22);
        this.strokeLine(g, body, 9, COLORS.saffron);
        g.lineStyle(1.5, COLORS.ink, 1);
        for (let k = 3; k < body.length - 2; k += 4) {
          const p = body[k]!;
          const q = body[k + 1]!;
          const dir = new Phaser.Math.Vector2(q.x - p.x, q.y - p.y).normalize();
          g.lineBetween(p.x, p.y, p.x - dir.y * 5 + dir.x * 2, p.y + dir.x * 5 + dir.y * 2);
        }
        const tip = body[body.length - 1]!;
        const before = body[body.length - 4]!;
        const heading = Math.atan2(tip.y - before.y, tip.x - before.x);
        for (const spread of [-0.6, -0.2, 0.2, 0.6]) {
          const dx = Math.cos(heading + spread) * 12;
          const dy = Math.sin(heading + spread) * 12;
          g.lineStyle(5, COLORS.ink, 1);
          g.lineBetween(tip.x, tip.y, tip.x + dx, tip.y + dy);
          g.lineStyle(3, COLORS.saffron, 1);
          g.lineBetween(tip.x, tip.y, tip.x + dx, tip.y + dy);
        }
        break;
      }
    }

    // Foot and top squares: a dot in the rail colour, ringed in ink.
    for (const p of [foot, top]) {
      g.fillStyle(COLORS.ink, 1);
      g.fillCircle(p.x, p.y, 7);
      g.fillStyle(rail, 1);
      g.fillCircle(p.x, p.y, 4.5);
    }
  }

  private drawSnake(g: Phaser.GameObjects.Graphics, id: string, head: Point, tail: Point): void {
    const look = SNAKE_LOOKS[id];
    if (!look) throw new Error(`No snake look for ${id}`);
    const body = Phaser.Display.Color.HexStringToColor(look.body).color;
    const belly = Phaser.Display.Color.HexStringToColor(look.belly).color;
    const a = new Phaser.Math.Vector2(head.x, head.y);
    const b = new Phaser.Math.Vector2(tail.x, tail.y);
    const curve = new Phaser.Curves.CubicBezier(a, this.bend(a, b, 0.25), this.bend(a, b, -0.25), b);
    const points = curve.getSpacedPoints(60);
    const widthAt = (u: number): number => 13 - 7 * u;

    // Ink outline first, then the body, so the outline never cuts across the body.
    g.fillStyle(COLORS.ink, 1);
    points.forEach((p, i) => g.fillCircle(p.x, p.y, widthAt(i / 60) / 2 + 1.5));
    g.fillStyle(body, 1);
    points.forEach((p, i) => g.fillCircle(p.x, p.y, widthAt(i / 60) / 2));
    g.fillStyle(belly, 1);
    points.forEach((p, i) => g.fillCircle(p.x, p.y, widthAt(i / 60) * 0.14));

    // Pattern every ~14px of body, skipping the part hidden under the head.
    const length = curve.getLength();
    for (let d = 26, n = 0; d < length - 6; d += 14, n++) {
      const u = d / length;
      const p = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u);
      const w = widthAt(u);
      const normal = new Phaser.Math.Vector2(-tangent.y, tangent.x);
      g.fillStyle(belly, 1);
      g.lineStyle(2, belly, 1);
      if (look.pattern === 'bands') {
        g.lineBetween(
          p.x - normal.x * w * 0.4,
          p.y - normal.y * w * 0.4,
          p.x + normal.x * w * 0.4,
          p.y + normal.y * w * 0.4,
        );
      } else if (look.pattern === 'spots') {
        const sign = n % 2 === 0 ? 1 : -1;
        g.fillCircle(
          p.x + normal.x * w * 0.22 * sign,
          p.y + normal.y * w * 0.22 * sign,
          Math.max(1.5, w * 0.16),
        );
      } else {
        const r = Math.max(2, w * 0.22);
        const angle = Math.atan2(tangent.y, tangent.x);
        const corners = [0, 1, 2, 3].map((k) => ({
          x: p.x + Math.cos(angle + (k * Math.PI) / 2) * r,
          y: p.y + Math.sin(angle + (k * Math.PI) / 2) * r,
        }));
        g.fillPoints(corners, true);
      }
    }

    // The head image looks "up" with the neck at the bottom: turn it to face away from the body.
    const start = curve.getTangentAt(0);
    const size = id === 'ravana' ? 60 : 44;
    this.add
      .image(head.x - start.x * 3, head.y - start.y * 3, snakeHeadKey(id))
      .setDisplaySize(size, size)
      .setRotation(Math.atan2(-start.y, -start.x) + Math.PI / 2)
      .setDepth(3);
  }

  private drawSeats(): void {
    this.snapshot().players.forEach((player, seat) => {
      const hero = HEROES[player.hero];
      const top = seatTop(seat);
      const frame = this.add
        .rectangle(PANEL.x, top, PANEL.width, SEAT.height, COLORS.parchment, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(2, COLORS.ink);
      this.seatFrames.push(frame);
      this.characters.push(new Character(this, PANEL.x + 48, top + 116, player.hero));
      this.bubbles.push(new SpeechBubble(this, PANEL.x + 96, top + 70).setDepth(12));
      this.add.text(PANEL.x + 100, top + 12, player.name, {
        fontFamily: TITLE_FONT,
        fontSize: '24px',
        color: CSS.ink,
      });
      this.add.text(
        PANEL.x + 100,
        top + 44,
        `${heroName(player.hero)} · ${t(player.controller === 'bot' ? 'ui.bot' : 'ui.human')}`,
        {
          fontFamily: BODY_FONT,
          fontSize: '16px',
          color: hero.cssColor,
        },
      );
      this.seatPositionText.push(
        this.add
          .text(PANEL.x + PANEL.width - 24, top + 18, '', {
            fontFamily: BODY_FONT,
            fontSize: '20px',
            color: CSS.indigo,
          })
          .setOrigin(1, 0),
      );
    });
    this.events.on('game-event', () => this.refreshSeatPositions());
    this.refreshSeatPositions();
  }

  private refreshSeatPositions(): void {
    this.snapshot().players.forEach((p, seat) =>
      this.seatPositionText[seat]?.setText(
        p.position === 0 ? t('ui.atStart') : t('ui.square', { n: p.position }),
      ),
    );
  }

  private highlightSeat(current: number): void {
    this.seatFrames.forEach((frame, seat) =>
      frame.setStrokeStyle(seat === current ? 4 : 2, seat === current ? COLORS.saffron : COLORS.ink),
    );
  }

  private createTokens(): void {
    const state = this.snapshot();
    this.shownSquare = state.players.map((p) => p.position);
    state.players.forEach((player, seat) => {
      const image = this.add.image(0, 0, tokenKey(player.hero)).setDisplaySize(40, 40);
      const at = this.restingPoint(seat);
      this.tokens.push(this.add.container(at.x, at.y, [image]).setDepth(5));
    });
  }
}

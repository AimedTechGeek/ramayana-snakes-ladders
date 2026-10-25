import Phaser from 'phaser';
import { Character } from '../../characters/Character';
import { pickSpeakers, reactionsFor, type Cue } from '../../characters/reactionMapper';
import { reactionFor, scaled, TIMING } from '../../characters/reactions';
import { speech } from '../../i18n/i18n';
import { boardFor, type StoryBoard } from '../../core/boards';
import { createRandomDice, type Dice } from '../../core/dice';
import type { GameEvent } from '../../core/events';
import { Game } from '../../core/game';
import type { GameConfig, GameState } from '../../core/types';
import { HEROES } from '../heroes';
import {
  BOARD,
  PANEL,
  SEAT,
  fanOffset,
  rowOf,
  seatTokenSpot,
  seatTop,
  squareCenter,
  type Point,
} from '../layout';
import { COLORS, CSS, BODY_FONT, TITLE_FONT } from '../palette';
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

/** Rows grouped into the story regions of the design doc, bottom row first. */
const ROW_COLORS = [
  0xf3e2b8, 0xf3e2b8, 0xf3e2b8, 0xe9d3a4, 0xcfe0b4, 0xcfe0b4, 0xcfe0b4, 0xe8c99a, 0xe8c99a, 0xe9b8a4,
  0xe9b8a4, 0xe9b8a4,
] as const;

// Timing from docs/design/reactions.json.
const STEP_MS = 120;
const FAST_STEP_MS = 40;
const BOT_DELAY_MS = 1000;
const FAST_BOT_DELAY_MS = 400;
const ROLL_HINT = 'Tap the dice to roll';

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
  private dieButton!: DiceButton;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerDot!: Phaser.GameObjects.Arc;
  private hintText!: Phaser.GameObjects.Text;
  private fastChip!: Chip;
  private muteChip!: Chip;
  private busy = false;

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
    this.busy = false;
  }

  create(): void {
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
    if (this.busy || this.engine.isOver || this.isBotTurn()) return;
    await this.takeTurn();
  }

  /** Play On: lets the remaining players continue after the first winner, then plays the events. */
  async continuePlay(): Promise<void> {
    if (this.busy || !this.engine.canContinue) return;
    this.busy = true;
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
    this.setHint(ROLL_HINT);
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
        await this.dieButton.roll(event.value);
        return;
      case 'Moved':
        for (const square of event.path) await this.stepTo(event.player, square);
        return;
      case 'Laddered':
        await this.slideTo(event.player, event.jump.to, 'ladder');
        return;
      case 'Bitten':
        await this.slideTo(event.player, event.jump.to, 'snake');
        return;
      case 'TripleSixVoid':
        this.setHint('Three sixes! The turn is void.');
        await this.slideTo(event.player, event.restoredTo, 'ladder');
        return;
      case 'Won':
        this.setHint(`${this.playerName(event.player)} reaches Ayodhya's throne!`);
        return;
      case 'Bounced':
      case 'ExtraRoll':
      case 'GameOver':
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
    const runs = cues.map((cue) => {
      const delay = cue.role === 'self' ? 0 : Phaser.Math.Between(minStagger, maxStagger);
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
      this.time.delayedCall(longest + maxStagger + 100, resolve),
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
    this.bannerText.setText(`${this.playerName(player)}'s turn`);
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
    this.createChip(1136, 624, 120, () => this.openMenu()).setLabel('Menu');
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
    this.fastChip?.setLabel(this.fastMode ? '\u00bb\u00bb Fast' : '\u00bb Fast');
  }

  private toggleMute(): void {
    this.game.registry.set('muted', this.game.registry.get('muted') !== true);
    this.applyMute();
  }

  private applyMute(): void {
    const muted = this.game.registry.get('muted') === true;
    this.muteChip.setActive(muted);
    this.muteChip.setLabel(muted ? '\u2715 Muted' : '\u266a Mute');
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

  private async slideTo(player: number, square: number, kind: 'ladder' | 'snake'): Promise<void> {
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
    await tweenAsync(this, {
      targets: progress,
      t: 1,
      duration: this.scaled(kind === 'snake' ? 700 : 500),
      ease: kind === 'snake' ? 'Quad.easeIn' : 'Sine.easeInOut',
      onUpdate: () => {
        const p = curve.getPoint(progress.t);
        token.setPosition(p.x, p.y);
      },
    });
    await this.relayout(player);
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
    const g = this.add.graphics();
    for (let square = 1; square <= 144; square++) {
      const c = squareCenter(square);
      const shade = square % 2 === 0 ? 0 : 0x0a0a0a;
      g.fillStyle((ROW_COLORS[rowOf(square)] ?? 0xf3e2b8) - shade, 1);
      g.fillRect(c.x - BOARD.cell / 2, c.y - BOARD.cell / 2, BOARD.cell, BOARD.cell);
      this.add
        .text(c.x - BOARD.cell / 2 + 4, c.y - BOARD.cell / 2 + 2, String(square), {
          fontFamily: BODY_FONT,
          fontSize: '11px',
          color: CSS.ink,
        })
        .setAlpha(0.8);
    }
    g.lineStyle(4, COLORS.gold, 1);
    g.strokeRect(BOARD.x - 2, BOARD.y - 2, BOARD.size + 4, BOARD.size + 4);
    g.lineStyle(2, COLORS.ink, 1);
    g.strokeRect(BOARD.x - 5, BOARD.y - 5, BOARD.size + 10, BOARD.size + 10);
  }

  private drawJumps(): void {
    const g = this.add.graphics().setDepth(2);
    for (const ladder of this.board.ladders)
      this.drawLadder(g, squareCenter(ladder.from), squareCenter(ladder.to));
    for (const snake of this.board.snakes)
      this.drawSnake(g, squareCenter(snake.from), squareCenter(snake.to));
  }

  private drawLadder(g: Phaser.GameObjects.Graphics, foot: Point, top: Point): void {
    const along = new Phaser.Math.Vector2(top.x - foot.x, top.y - foot.y);
    const length = along.length();
    const side = new Phaser.Math.Vector2(-along.y, along.x).normalize().scale(9);
    g.lineStyle(4, 0x8a5a1c, 1);
    g.lineBetween(foot.x + side.x, foot.y + side.y, top.x + side.x, top.y + side.y);
    g.lineBetween(foot.x - side.x, foot.y - side.y, top.x - side.x, top.y - side.y);
    g.lineStyle(3, 0xc08a3a, 1);
    const rungs = Math.max(2, Math.floor(length / 22));
    for (let i = 1; i < rungs; i++) {
      const t = i / rungs;
      const x = foot.x + along.x * t;
      const y = foot.y + along.y * t;
      g.lineBetween(x + side.x, y + side.y, x - side.x, y - side.y);
    }
  }

  private drawSnake(g: Phaser.GameObjects.Graphics, head: Point, tail: Point): void {
    const a = new Phaser.Math.Vector2(head.x, head.y);
    const b = new Phaser.Math.Vector2(tail.x, tail.y);
    const curve = new Phaser.Curves.CubicBezier(a, this.bend(a, b, 0.25), this.bend(a, b, -0.25), b);
    const points = curve.getPoints(40);
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i]!;
      const q = points[i + 1]!;
      g.lineStyle(10 - (6 * i) / points.length, 0x3f7a3a, 1);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
    g.fillStyle(0x2c5a28, 1);
    g.fillCircle(head.x, head.y, 9);
    g.fillStyle(0xf2e6c8, 1);
    g.fillCircle(head.x - 3, head.y - 3, 2);
    g.fillCircle(head.x + 3, head.y - 3, 2);
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
        `${hero.label} · ${player.controller === 'bot' ? 'Bot' : 'Human'}`,
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
      this.seatPositionText[seat]?.setText(p.position === 0 ? 'Start' : `Square ${p.position}`),
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
      const hero = HEROES[player.hero];
      const disc = this.add.circle(0, 0, 13, hero.color).setStrokeStyle(2, COLORS.ink);
      const letter = this.add
        .text(0, 0, hero.label.charAt(0), { fontFamily: TITLE_FONT, fontSize: '15px', color: '#ffffff' })
        .setOrigin(0.5);
      const at = this.restingPoint(seat);
      this.tokens.push(this.add.container(at.x, at.y, [disc, letter]).setDepth(5));
    });
  }
}

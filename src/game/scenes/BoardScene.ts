import Phaser from 'phaser';
import { boardFor, type StoryBoard } from '../../core/boards';
import { createRandomDice, type Dice } from '../../core/dice';
import type { GameEvent } from '../../core/events';
import { Game } from '../../core/game';
import type { GameConfig, GameState } from '../../core/types';
import { HEROES } from '../heroes';
import {
  BOARD,
  CONTROLS_Y,
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
import { tweenAsync } from '../tween';

export type BoardSceneData =
  { config: GameConfig; state?: undefined } | { config?: undefined; state: GameState };

/** Rows grouped into the story regions of the design doc, bottom row first. */
const ROW_COLORS = [
  0xf3e2b8, 0xf3e2b8, 0xf3e2b8, 0xe9d3a4, 0xcfe0b4, 0xcfe0b4, 0xcfe0b4, 0xe8c99a, 0xe8c99a, 0xe9b8a4,
  0xe9b8a4, 0xe9b8a4,
] as const;

const STEP_MS = 120;

export class BoardScene extends Phaser.Scene {
  private engine!: Game;
  private board!: StoryBoard;
  private dice: Dice = createRandomDice();
  private tokens: Phaser.GameObjects.Container[] = [];
  /** Square each token is drawn on; trails the engine while animations run. */
  private shownSquare: number[] = [];
  private seatPositionText: Phaser.GameObjects.Text[] = [];
  private seatFrames: Phaser.GameObjects.Rectangle[] = [];
  private statusText!: Phaser.GameObjects.Text;
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
    this.busy = false;
  }

  create(): void {
    this.drawBoard();
    this.drawJumps();
    this.drawSeats();
    this.createTokens();
    this.statusText = this.add
      .text(PANEL.x + 144, CONTROLS_Y, '', { fontFamily: TITLE_FONT, fontSize: '26px', color: CSS.parchment })
      .setDepth(10);

    this.input.keyboard?.on('keydown-SPACE', () => void this.requestRoll());
    this.input.on('pointerdown', () => void this.requestRoll());

    this.game.registry.set('board', this);
    this.game.registry.set('board-ready', true);
    void this.play(this.engine.begin());
  }

  /** The engine state for tests and saving. */
  snapshot(): GameState {
    return this.engine.snapshot();
  }

  get isBusy(): boolean {
    return this.busy;
  }

  async requestRoll(): Promise<void> {
    if (this.busy || this.engine.isOver) return;
    this.busy = true;
    try {
      await this.play(this.engine.roll());
    } finally {
      this.busy = false;
    }
  }

  private async play(events: GameEvent[]): Promise<void> {
    for (const event of events) {
      this.events.emit('game-event', event, this.engine);
      await this.animate(event);
    }
  }

  private async animate(event: GameEvent): Promise<void> {
    switch (event.type) {
      case 'TurnStarted':
        this.highlightSeat(event.player);
        this.setStatus(`${this.playerName(event.player)}'s turn`);
        return;
      case 'Rolled':
        this.setStatus(`${this.playerName(event.player)} rolled ${event.value}`);
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
        this.setStatus('Three sixes! The turn is void.');
        await this.slideTo(event.player, event.restoredTo, 'ladder');
        return;
      case 'Won':
        this.setStatus(`${this.playerName(event.player)} reaches Ayodhya's throne!`);
        return;
      case 'Bounced':
      case 'ExtraRoll':
      case 'GameOver':
        return;
    }
  }

  private playerName(player: number): string {
    return this.snapshot().players[player]?.name ?? '';
  }

  private setStatus(text: string): void {
    this.statusText.setText(text);
  }

  private async stepTo(player: number, square: number): Promise<void> {
    const token = this.tokenAt(player);
    this.shownSquare[player] = square;
    const target = this.restingPoint(player);
    await tweenAsync(this, {
      targets: token,
      x: target.x,
      y: target.y,
      duration: STEP_MS,
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
      duration: kind === 'snake' ? 700 : 500,
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
        return tweenAsync(this, { targets: this.tokenAt(i), x: p.x, y: p.y, duration: 80 });
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
      this.add.text(PANEL.x + 80, top + 18, player.name, {
        fontFamily: TITLE_FONT,
        fontSize: '24px',
        color: CSS.ink,
      });
      this.add.text(
        PANEL.x + 80,
        top + 52,
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

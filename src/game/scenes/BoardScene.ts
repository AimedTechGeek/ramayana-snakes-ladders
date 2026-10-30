import Phaser from 'phaser';
import { applyHiDpi } from '../hidpi';
import { Character } from '../../characters/Character';
import { MedallionToken, type BoardToken } from '../../characters/BoardToken';
import { Figurine } from '../../characters/Figurine';
import { orderedDelay, pickSpeakers, reactionsFor, type Cue } from '../../characters/reactionMapper';
import { reactionFor, scaled, TIMING } from '../../characters/reactions';
import { speech, t } from '../../i18n/i18n';
import { boardFor, type StoryBoard } from '../../core/boards';
import { createRandomDice, type Dice } from '../../core/dice';
import type { GameEvent } from '../../core/events';
import { Game } from '../../core/game';
import type { GameConfig, GameState, Hero, Jump, Level } from '../../core/types';
import { getAudio, type Audio } from '../audio';
import { BOARD_STAGE, boardKey, boardUrl, FIGURINE_HEROES, figurineAssets } from '../assets';
import { HEROES, heroName } from '../heroes';
import { PANEL, SEAT, seatTokenSpot, seatTop } from '../layout';
import { squareScreen } from '../iso/boardIso';
import { fieldCentre, glidePoint, jumpPaths, type JumpPath, type Vec2 } from '../iso/jumps';
import {
  entryPose,
  hopPoint,
  restingSpot,
  screenPose,
  TOKEN_DEPTH_BASE,
  worldPose,
  type TokenPose,
} from '../iso/tokenPose';
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
// Depth layers (T40 spec 2.6): board 0, shadows 500, fx 900, tokens 1000+, HUD 5000, speech bubbles 6000.
const BOARD_DEPTH = 0;
const HUD_DEPTH = 5000;
const BUBBLE_DEPTH = 6000;
/** Left edge of the banner, hint and chips: right of the die plate in the HUD column. */
const BANNER_X = PANEL.x + 144;
const BOT_DELAY_MS = 1000;
const FAST_BOT_DELAY_MS = 400;

export class BoardScene extends Phaser.Scene {
  private engine!: Game;
  private board!: StoryBoard;
  private dice: Dice = createRandomDice();
  private level: Level = 'easy';
  private heroes: Hero[] = [];
  private paths: JumpPath[] = [];
  private tokens: BoardToken[] = [];
  /** World (x, y) each token stands at on the board; null while it waits on its seat card. */
  private worldAt: (Vec2 | null)[] = [];
  /** Square each token is drawn on; trails the engine while animations run. */
  private shownSquare: number[] = [];
  private seatPositionText: Phaser.GameObjects.Text[] = [];
  private seatFrames: Phaser.GameObjects.Rectangle[] = [];
  private characters: (Character | Figurine)[] = [];
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
    this.level = data.state ? data.state.level : data.config.level;
    this.paths = jumpPaths(this.level);
    this.heroes = (data.state ?? data.config).players.map((player) => player.hero);
    if (data.state) {
      this.board = boardFor(data.state.level);
      this.engine = Game.restore(data.state, this.board, this.dice);
    } else {
      this.board = boardFor(data.config.level);
      this.engine = Game.create(data.config, this.board, this.dice);
    }
    this.tokens = [];
    this.worldAt = [];
    this.shownSquare = [];
    this.seatPositionText = [];
    this.seatFrames = [];
    this.characters = [];
    this.bubbles = [];
    this.lastLines = new Map();
    this.seatStartAt = [];
    this.busy = false;
  }

  /** Loads the chosen level's board (rasterised at 2x) and the seated Hanuman's figurine textures. */
  preload(): void {
    const key = boardKey(this.level);
    if (!this.textures.exists(key)) {
      this.load.svg(key, boardUrl(this.level), {
        width: BOARD_STAGE.width * BOARD_STAGE.scale,
        height: BOARD_STAGE.height * BOARD_STAGE.scale,
      });
    }
    for (const asset of figurineAssets(this.heroes, ['s', 'm'])) {
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.url);
    }
  }

  create(): void {
    applyHiDpi(this);
    this.audio = getAudio(this.game.registry.get('muted') === true);
    ensureFxTextures(this);
    this.drawBoard();
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
        await this.slideTo(event.player, event.jump.to, 'ladder', event.jump);
        return;
      case 'Bitten':
        this.audio.snake();
        this.biteEffects(event.jump.from);
        await this.slideTo(event.player, event.jump.to, 'snake', event.jump);
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

  private characterAt(seat: number): Character | Figurine {
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
    this.dieButton = new DiceButton(this, PANEL.x + 64, 552 + 64).setDepth(HUD_DEPTH);
    this.dieButton.on('press', () => void this.requestRoll());

    this.bannerDot = this.add.circle(BANNER_X + 6, 548 + 16, 6, COLORS.parchment).setDepth(HUD_DEPTH);
    this.bannerText = this.add
      .text(BANNER_X + 24, 548, '', { fontFamily: TITLE_FONT, fontSize: '26px', color: CSS.parchment })
      .setDepth(HUD_DEPTH);
    this.hintText = this.add
      .text(BANNER_X, 584, '', { fontFamily: BODY_FONT, fontSize: '16px', color: CSS.parchment })
      .setAlpha(0.7)
      .setDepth(HUD_DEPTH)
      .setVisible(false);

    this.fastChip = this.createChip(BANNER_X, 624, 100, () => this.toggleFast());
    this.muteChip = this.createChip(BANNER_X + 108, 624, 100, () => this.toggleMute());
    this.createChip(BANNER_X + 216, 624, 104, () => this.openMenu()).setLabel(t('ui.menu'));
    this.applyFast();
    this.applyMute();
    this.setBanner(this.snapshot().current);
  }

  private createChip(x: number, y: number, width: number, onClick: () => void): Chip {
    const box = this.add
      .rectangle(x, y, width, 56, COLORS.parchment)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.ink)
      .setDepth(HUD_DEPTH)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x + width / 2, y + 28, '', { fontFamily: BODY_FONT, fontSize: '20px', color: CSS.ink })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
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

  /** Runs `poseAt(u)` for u from 0 to 1 over `duration` (eased by `ease`), placing the token every frame. */
  private async travel(
    player: number,
    duration: number,
    ease: string,
    poseAt: (u: number) => TokenPose,
    onUpdate?: (u: number, pose: TokenPose) => void,
  ): Promise<void> {
    const token = this.tokenAt(player);
    const progress = { u: 0 };
    await tweenAsync(this, {
      targets: progress,
      u: 1,
      duration,
      ease,
      onUpdate: () => {
        const pose = poseAt(progress.u);
        token.place(pose);
        onUpdate?.(progress.u, pose);
      },
    });
    token.place(poseAt(1));
  }

  /** The pose a token has at rest: on the board at a world spot, or on its seat card. */
  private restPose(player: number, spot: Vec2 | null): TokenPose {
    return spot ? worldPose(spot[0], spot[1]) : screenPose(seatTokenSpot(player), TOKEN_DEPTH_BASE);
  }

  private async stepTo(player: number, square: number): Promise<void> {
    this.audio.step();
    const token = this.tokenAt(player);
    const from = this.worldAt[player] ?? null;
    this.shownSquare[player] = square;
    const to = this.spotOf(player);
    if (from === null) {
      const seat = seatTokenSpot(player);
      await this.travel(player, this.scaled(360), 'Sine.easeInOut', (u) => entryPose(seat, to, u));
    } else {
      await this.travel(player, this.stepMs, 'Linear', (u) => {
        const [x, y, z] = hopPoint(from, to, u);
        return worldPose(x, y, z);
      });
    }
    this.worldAt[player] = to;
    token.squash(this.scaled(60));
    await this.relayout(player);
  }

  private async slideTo(
    player: number,
    square: number,
    kind: 'ladder' | 'snake' | 'void',
    jump?: Jump,
  ): Promise<void> {
    const start = this.worldAt[player] ?? null;
    this.shownSquare[player] = square;
    const end = square === 0 ? null : this.spotOf(player);
    const path = jump ? this.paths.find((p) => p.from === jump.from && p.to === jump.to) : undefined;
    const trail = kind === 'ladder' ? sparkleTrail(this, this.fastMode) : undefined;
    let lastSparkle = 0;
    let poseAt: (u: number) => TokenPose;
    if (path && start && end) {
      // Along the jump's own path; the fan offset eases from the old slot to the new one.
      const [fromX, fromY] = fieldCentre(path.from);
      const [toX, toY] = fieldCentre(path.to);
      const startFan = [start[0] - fromX, start[1] - fromY];
      const endFan = [end[0] - toX, end[1] - toY];
      poseAt = (u) => {
        const [x, y, z] = glidePoint(path, u);
        const dx = startFan[0]! + (endFan[0]! - startFan[0]!) * u;
        const dy = startFan[1]! + (endFan[1]! - startFan[1]!) * u;
        return worldPose(x + dx, y + dy, z);
      };
    } else {
      // A straight line at tile height (to or from the seat card, a straight screen line).
      const a = this.restPose(player, start);
      const b = this.restPose(player, end);
      poseAt = (u) => ({
        feet: { x: a.feet.x + (b.feet.x - a.feet.x) * u, y: a.feet.y + (b.feet.y - a.feet.y) * u },
        ground: {
          x: a.ground.x + (b.ground.x - a.ground.x) * u,
          y: a.ground.y + (b.ground.y - a.ground.y) * u,
        },
        depth: a.depth + (b.depth - a.depth) * u,
        lift: 0,
      });
    }
    const ladderMs = Math.max(400, 25 * Math.abs((jump?.to ?? 0) - (jump?.from ?? 0)));
    await this.travel(
      player,
      this.scaled(kind === 'snake' ? 700 : kind === 'ladder' ? ladderMs : 500),
      kind === 'snake' ? 'Quad.easeIn' : 'Sine.easeInOut',
      poseAt,
      (u, pose) => {
        if (trail && u - lastSparkle >= 0.04) {
          lastSparkle = u;
          trail.emit(pose.feet.x, pose.feet.y);
        }
      },
    );
    trail?.stop();
    this.worldAt[player] = end;
    const landed = this.restPose(player, end).feet;
    if (kind === 'ladder') goldBurst(this, landed.x, landed.y, this.fastMode);
    else dustPuff(this, landed.x, landed.y, this.fastMode);
    await this.relayout(player);
  }

  /** Dust at the snake's head and a brief camera shake when a token is bitten. */
  private biteEffects(headSquare: number): void {
    const head = squareScreen(headSquare);
    dustPuff(this, head.x, head.y, this.fastMode);
    shake(this, this.fastMode);
  }

  private bounceEffect(): void {
    const c = squareScreen(144);
    bouncePuff(this, c.x, c.y, this.fastMode);
  }

  /** Re-fan every token sharing the square the given player just reached. */
  private async relayout(player: number): Promise<void> {
    const square = this.shownSquare[player];
    const sharing = this.shownSquare.flatMap((s, i) => (s === square ? [i] : []));
    if (square === 0 || sharing.length < 2) return;
    await Promise.all(
      sharing.map((i) => {
        const from = this.worldAt[i];
        const to = this.spotOf(i);
        this.worldAt[i] = to;
        if (!from) return this.travel(i, 0, 'Linear', () => this.restPose(i, to));
        return this.travel(i, this.scaled(80), 'Linear', (u) =>
          worldPose(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u),
        );
      }),
    );
  }

  /** The world spot (x, y) a token on the board rests at: the square's field centre plus its fan slot. */
  private spotOf(player: number): Vec2 {
    const square = this.shownSquare[player] ?? 0;
    const sharing = this.shownSquare.flatMap((s, i) => (s === square ? [i] : []));
    return restingSpot(square, sharing.indexOf(player), sharing.length);
  }

  private tokenAt(player: number): BoardToken {
    const token = this.tokens[player];
    if (!token) throw new Error(`No token for player ${player}`);
    return token;
  }

  /** The board diorama: one image per difficulty at (0, 0), rasterised at 2x (T40 spec 2.6). */
  private drawBoard(): void {
    this.add
      .image(0, 0, boardKey(this.level))
      .setOrigin(0)
      .setDisplaySize(BOARD_STAGE.width, BOARD_STAGE.height)
      .setDepth(BOARD_DEPTH);
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
      this.characters.push(this.createSeatFigure(player.hero, PANEL.x + 48, top + 116));
      this.bubbles.push(new SpeechBubble(this, PANEL.x + 96, top + 70).setDepth(BUBBLE_DEPTH));
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
    // The current player's seat figure and board token use the lit textures until the next TurnStarted.
    this.characters.forEach((character, seat) => {
      if (character instanceof Figurine) character.setLit(seat === current);
      this.tokens[seat]?.setLit(seat === current);
    });
  }

  private createSeatFigure(hero: Hero, x: number, y: number): Character | Figurine {
    if (!FIGURINE_HEROES.includes(hero)) return new Character(this, x, y, hero);
    return new Figurine(this, x, y, hero, 'm', 0);
  }

  private createTokens(): void {
    const state = this.snapshot();
    this.shownSquare = state.players.map((p) => p.position);
    state.players.forEach((player, seat) => {
      const token: BoardToken = FIGURINE_HEROES.includes(player.hero)
        ? new Figurine(this, 0, 0, player.hero, 's')
        : new MedallionToken(this, player.hero);
      const seatFigure = this.characters[seat];
      // The board token shows the seat figure's emotion but plays no reaction tween (T40 spec 5).
      if (seatFigure instanceof Figurine) seatFigure.onEmotion = (emotion) => token.setEmotion(emotion);
      this.tokens.push(token);
      const spot = player.position === 0 ? null : this.spotOf(seat);
      this.worldAt.push(spot);
      token.place(this.restPose(seat, spot));
    });
  }
}

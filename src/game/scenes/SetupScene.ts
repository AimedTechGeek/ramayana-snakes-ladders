import Phaser from 'phaser';
import type { Level } from '../../core/types';
import { t } from '../../i18n/i18n';
import { HEROES } from '../heroes';
import { BODY_FONT, COLORS, CSS, TITLE_FONT } from '../palette';
import {
  MAX_NAME_LENGTH,
  canStart,
  cycleHero,
  defaultSeats,
  setController,
  setName,
  toGameConfig,
  type SeatController,
  type SeatModel,
} from '../setupModel';

const SEAT_COUNT = 4;
const COLUMN = { x: 24, y: 104, w: 296, h: 456, step: 312 };
// Labels are i18n keys, resolved with t() when the scene is built (after the locale is restored).
const CONTROLLER_OPTIONS: readonly { value: SeatController; labelKey: string }[] = [
  { value: 'human', labelKey: 'ui.human' },
  { value: 'bot', labelKey: 'ui.bot' },
  { value: 'empty', labelKey: 'ui.empty' },
];
const LEVEL_OPTIONS: readonly { value: Level; labelKey: string }[] = [
  { value: 'easy', labelKey: 'ui.easy' },
  { value: 'medium', labelKey: 'ui.medium' },
  { value: 'hard', labelKey: 'ui.hard' },
];
const EMPTY_SEAT_ALPHA = 0.6;
const DISABLED_START_ALPHA = 0.55;
const GREY = 0x8a8a8a;

interface Segment {
  box: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

interface SeatView {
  column: Phaser.GameObjects.Container;
  controllerSegments: Segment[];
  arrows: Phaser.GameObjects.Rectangle[];
  arrowTexts: Phaser.GameObjects.Text[];
  portrait: Phaser.GameObjects.Arc;
  initial: Phaser.GameObjects.Text;
  caption: Phaser.GameObjects.Text;
  nameField: Phaser.GameObjects.DOMElement;
  nameInput: HTMLInputElement;
}

export class SetupScene extends Phaser.Scene {
  private seats: SeatModel[] = defaultSeats();
  private level: Level = 'easy';
  private seatViews: SeatView[] = [];
  private levelSegments: Segment[] = [];
  private startButton!: Phaser.GameObjects.Container;
  private startBox!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Setup');
  }

  create(): void {
    this.seats = defaultSeats();
    this.level = 'easy';
    this.seatViews = [];
    this.levelSegments = [];

    this.cameras.main.setBackgroundColor(CSS.deepIndigo);
    this.createHeader();
    for (let k = 0; k < SEAT_COUNT; k++) {
      this.seatViews.push(this.createSeatColumn(k));
    }
    this.createBottomBar();
    this.refresh();

    this.game.registry.set('setup', this);
  }

  private createHeader(): void {
    this.add
      .text(640, 56, t('ui.title'), {
        fontFamily: TITLE_FONT,
        fontSize: '40px',
        color: CSS.gold,
        stroke: CSS.ink,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const box = this.add
      .rectangle(24, 24, 120, 56, COLORS.parchment)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.indigo)
      .setInteractive({ useHandCursor: true });
    box.on('pointerup', () => this.scene.start('Boot'));
    this.add
      .text(84, 52, t('ui.menu'), {
        fontFamily: BODY_FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: CSS.indigo,
      })
      .setOrigin(0.5);
  }

  private createSeatColumn(k: number): SeatView {
    const cx = COLUMN.x + COLUMN.step * k;
    const cy = COLUMN.y;
    const column = this.add.container(cx, cy);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.parchment, 1);
    panel.fillRoundedRect(0, 0, COLUMN.w, COLUMN.h, 6);
    panel.lineStyle(3, COLORS.ink, 1);
    panel.strokeRoundedRect(0, 0, COLUMN.w, COLUMN.h, 6);
    column.add(panel);

    column.add(
      this.add.text(16, 12, t('ui.seat', { n: k + 1 }), {
        fontFamily: BODY_FONT,
        fontSize: '18px',
        color: CSS.indigo,
      }),
    );

    const controllerSegments = CONTROLLER_OPTIONS.map((option, i) => {
      const segment = this.makeSegment(16 + 88 * i, 40, 88, t(option.labelKey), () => {
        this.seats = setController(this.seats, k, option.value);
        this.refresh();
      });
      column.add([segment.box, segment.text]);
      return segment;
    });

    const portrait = this.add.circle(148, 76 + 112, 76, COLORS.indigo).setStrokeStyle(3, COLORS.ink);
    portrait.setInteractive({ useHandCursor: true });
    portrait.on('pointerup', () => this.changeHero(k, 1));
    const initial = this.add
      .text(148, 188, '', {
        fontFamily: TITLE_FONT,
        fontSize: '80px',
        color: CSS.parchment,
        stroke: CSS.ink,
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    column.add([portrait, initial]);

    const left = this.makeArrow(16, 160, '<', () => this.changeHero(k, -1));
    const right = this.makeArrow(208, 160, '>', () => this.changeHero(k, 1));
    column.add([left.box, left.text, right.box, right.text]);

    const caption = this.add.text(148, 290, '', { fontFamily: TITLE_FONT, fontSize: '22px' }).setOrigin(0.5);
    column.add(caption);
    column.add(
      this.add.text(16, 316, t('ui.name'), {
        fontFamily: BODY_FONT,
        fontSize: '14px',
        color: CSS.ink,
      }),
    );

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = MAX_NAME_LENGTH;
    nameInput.setAttribute('aria-label', `Seat ${k + 1} name`);
    Object.assign(nameInput.style, {
      width: '264px',
      height: '48px',
      boxSizing: 'border-box',
      padding: '0 12px',
      font: `600 20px ${BODY_FONT}`,
      color: CSS.ink,
      background: '#fff8e1',
      border: `2px solid ${CSS.indigo}`,
      borderRadius: '6px',
    });
    nameInput.addEventListener('input', () => {
      this.seats = setName(this.seats, k, nameInput.value);
    });
    const nameField = this.add.dom(cx + 148, cy + 360, nameInput);

    return {
      column,
      controllerSegments,
      arrows: [left.box, right.box],
      arrowTexts: [left.text, right.text],
      portrait,
      initial,
      caption,
      nameField,
      nameInput,
    };
  }

  private createBottomBar(): void {
    this.add
      .text(24, 620, 'Board', { fontFamily: BODY_FONT, fontSize: '14px', color: CSS.parchment })
      .setOrigin(0, 0.5);
    this.levelSegments = LEVEL_OPTIONS.map((option, i) =>
      this.makeSegment(72 + 120 * i, 592, 120, t(option.labelKey), () => {
        this.level = option.value;
        this.refresh();
      }),
    );

    this.startBox = this.add
      .rectangle(0, 0, 296, 72, COLORS.saffron)
      .setOrigin(0)
      .setStrokeStyle(3, COLORS.ink);
    const startText = this.add
      .text(148, 36, t('ui.start'), {
        fontFamily: TITLE_FONT,
        fontSize: '28px',
        color: CSS.ink,
      })
      .setOrigin(0.5);
    this.startButton = this.add.container(960, 584, [this.startBox, startText]);
    this.startBox.on('pointerup', () => {
      if (!canStart(this.seats)) return;
      this.scene.start('Board', { config: toGameConfig(this.seats, this.level) });
    });
  }

  private changeHero(index: number, dir: 1 | -1): void {
    if (this.seats[index]?.controller === 'empty') return;
    this.seats = cycleHero(this.seats, index, dir);
    this.refresh();
  }

  private makeArrow(
    x: number,
    y: number,
    glyph: string,
    onPress: () => void,
  ): { box: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
    const box = this.add
      .rectangle(x, y, 56, 56, COLORS.parchment)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.indigo)
      .setInteractive({ useHandCursor: true });
    box.on('pointerup', onPress);
    const text = this.add
      .text(x + 28, y + 28, glyph, {
        fontFamily: BODY_FONT,
        fontSize: '32px',
        fontStyle: 'bold',
        color: CSS.indigo,
      })
      .setOrigin(0.5);
    return { box, text };
  }

  private makeSegment(x: number, y: number, w: number, label: string, onPress: () => void): Segment {
    const box = this.add
      .rectangle(x, y, w, 56, COLORS.parchment)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.indigo)
      .setInteractive({ useHandCursor: true });
    box.on('pointerup', onPress);
    const text = this.add
      .text(x + w / 2, y + 28, label, { fontFamily: BODY_FONT, fontSize: '20px', fontStyle: 'bold' })
      .setOrigin(0.5);
    return { box, text };
  }

  private styleSegment(segment: Segment, active: boolean): void {
    segment.box.setFillStyle(active ? COLORS.indigo : COLORS.parchment);
    segment.text.setColor(active ? CSS.parchment : CSS.indigo);
  }

  private refresh(): void {
    this.seats.forEach((seat, k) => {
      const view = this.seatViews[k];
      if (!view) return;
      const empty = seat.controller === 'empty';
      const look = HEROES[seat.hero];

      view.column.setAlpha(empty ? EMPTY_SEAT_ALPHA : 1);
      CONTROLLER_OPTIONS.forEach((option, i) => {
        const segment = view.controllerSegments[i];
        if (segment) this.styleSegment(segment, option.value === seat.controller);
      });
      view.arrows.forEach((arrow) => arrow.setVisible(!empty));
      view.arrowTexts.forEach((text) => text.setVisible(!empty));
      view.portrait.setFillStyle(empty ? GREY : look.color);
      view.initial.setText(look.label.charAt(0));
      view.caption.setText(look.label).setColor(empty ? CSS.ink : look.cssColor);
      view.nameField.setVisible(!empty);
      if (view.nameInput.value !== seat.name) view.nameInput.value = seat.name;
    });

    LEVEL_OPTIONS.forEach((option, i) => {
      const segment = this.levelSegments[i];
      if (segment) this.styleSegment(segment, option.value === this.level);
    });

    const startable = canStart(this.seats);
    this.startButton.setAlpha(startable ? 1 : DISABLED_START_ALPHA);
    if (startable) this.startBox.setInteractive({ useHandCursor: true });
    else this.startBox.disableInteractive();
  }
}

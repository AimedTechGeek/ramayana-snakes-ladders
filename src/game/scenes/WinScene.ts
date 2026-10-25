import Phaser from 'phaser';
import type { GameConfig, GameState, PlayerState } from '../../core/types';
import { HEROES } from '../heroes';
import { BODY_FONT, COLORS, CSS, TITLE_FONT } from '../palette';
import { clearSave } from '../save';
import type { BoardScene } from './BoardScene';

export interface WinSceneData {
  state: GameState;
  canContinue: boolean;
}

const PANEL = { x: 200, y: 80, width: 880, height: 560 };
const OTHERS = { x: 470, y: 300, spacing: 140 };
const ORDINALS = ['1st', '2nd', '3rd', '4th'];

/** Win overlay launched over the Board when the game is over (T04 section 5). */
export class WinScene extends Phaser.Scene {
  private state!: GameState;
  private canContinue = false;

  constructor() {
    super('Win');
  }

  init(data: WinSceneData): void {
    this.state = data.state;
    this.canContinue = data.canContinue;
  }

  create(): void {
    this.add.rectangle(0, 0, 1280, 720, COLORS.deepIndigo, 0.7).setOrigin(0).setInteractive();

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.parchment, 1);
    panel.fillRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 8);
    panel.lineStyle(3, COLORS.ink, 1);
    panel.strokeRoundedRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 8);

    const winner = this.state.players.find((p) => p.rank === 1);
    if (!winner) throw new Error('The game is over but no player has rank 1');
    this.drawWinner(winner);
    this.drawOthers(this.state.players.filter((p) => p !== winner));

    this.createButton(470, 560, 240, 72, 'Play Again', COLORS.saffron, () => this.playAgain());
    if (this.canContinue) {
      this.createButton(726, 560, 200, 72, 'Play On', COLORS.parchment, () => this.playOn());
    }
    this.createButton(942, 560, 120, 72, 'Menu', COLORS.parchment, () => this.menu());

    this.game.registry.set('win', this);
  }

  private drawWinner(winner: PlayerState): void {
    const hero = HEROES[winner.hero];
    this.add.circle(340, 290, 100, hero.color).setStrokeStyle(4, COLORS.ink);
    this.add
      .text(340, 290, hero.label.charAt(0), {
        fontFamily: TITLE_FONT,
        fontSize: '120px',
        color: CSS.parchment,
        stroke: CSS.ink,
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add.text(470, 140, `${winner.name} reaches Ayodhya's throne!`, {
      fontFamily: TITLE_FONT,
      fontSize: '36px',
      color: CSS.ink,
      wordWrap: { width: 560 },
    });
  }

  private drawOthers(others: PlayerState[]): void {
    others.forEach((player, i) => {
      const x = OTHERS.x + OTHERS.spacing * i;
      const hero = HEROES[player.hero];
      this.add.circle(x + 40, OTHERS.y + 40, 36, hero.color).setStrokeStyle(3, COLORS.ink);
      this.add
        .text(x + 40, OTHERS.y + 40, hero.label.charAt(0), {
          fontFamily: TITLE_FONT,
          fontSize: '40px',
          color: CSS.parchment,
        })
        .setOrigin(0.5);
      this.add.text(x, OTHERS.y + 92, player.name, {
        fontFamily: BODY_FONT,
        fontSize: '20px',
        color: CSS.ink,
      });
      this.add.text(x, OTHERS.y + 120, player.rank === null ? '-' : (ORDINALS[player.rank - 1] ?? ''), {
        fontFamily: BODY_FONT,
        fontSize: '20px',
        color: CSS.indigo,
      });
    });
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fill: number,
    onPress: () => void,
  ): void {
    const box = this.add
      .rectangle(x, y, width, height, fill)
      .setOrigin(0)
      .setStrokeStyle(3, COLORS.ink)
      .setInteractive({ useHandCursor: true });
    box.on('pointerup', onPress);
    this.add
      .text(x + width / 2, y + height / 2, label, {
        fontFamily: TITLE_FONT,
        fontSize: '26px',
        color: CSS.ink,
      })
      .setOrigin(0.5);
  }

  /** A fresh game with the same seats and level. */
  private playAgain(): void {
    const config: GameConfig = {
      level: this.state.level,
      playOn: false,
      players: this.state.players.map(({ hero, controller, name }) => ({ hero, controller, name })),
    };
    this.scene.stop();
    this.scene.start('Board', { config });
  }

  /** Winner is retired; the Board carries on with the remaining players. */
  private playOn(): void {
    const board = this.scene.get('Board') as BoardScene;
    this.scene.stop();
    this.scene.resume('Board');
    void board.continuePlay();
  }

  private menu(): void {
    clearSave();
    this.scene.stop('Board');
    this.scene.stop();
    this.scene.start('Boot');
  }
}

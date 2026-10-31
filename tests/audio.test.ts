import { describe, expect, it } from 'vitest';
import { Audio, getAudio } from '../src/game/audio';

describe('audio', () => {
  it('Audio_WithoutAudioContext_Should_NoOpEverySound', () => {
    const audio = new Audio();
    expect(() => {
      audio.unlock();
      audio.dice();
      audio.step();
      audio.ladder();
      audio.ladder(true);
      audio.stone();
      audio.stone(true);
      audio.snake();
      audio.hiss();
      audio.gulp();
      audio.pop(true);
      audio.bounce();
      audio.tripleSix();
      audio.win();
      audio.drone(true);
      audio.drone(false);
    }).not.toThrow();
  });

  it('Audio_SetMuted_Should_ReportMuteState', () => {
    const audio = new Audio(false);
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.setMuted(false);
    expect(audio.isMuted()).toBe(false);
  });

  it('Audio_InitialMuted_Should_BeReportedBeforeAnyUnlock', () => {
    expect(new Audio(true).isMuted()).toBe(true);
  });

  it('GetAudio_CalledTwice_Should_ReturnSameInstance', () => {
    expect(getAudio()).toBe(getAudio());
  });
});

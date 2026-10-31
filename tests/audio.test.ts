import { describe, expect, it, vi } from 'vitest';
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

  it('Audio_(Muted)_Should_MakeNoSoundForTheBridgeAndSnakeCues', () => {
    // a counting AudioContext: every sound creates at least one oscillator or buffer source
    let made = 0;
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} });
    const node = () => ({ connect: (n: unknown) => n, start() {}, stop() {}, gain: param(), frequency: param(), Q: param(), type: '', buffer: null, loop: false });
    class CountingContext {
      currentTime = 0;
      state = 'running';
      destination = node();
      sampleRate = 8000;
      createGain = () => node();
      createBiquadFilter = () => node();
      createOscillator = () => (made++, node());
      createBufferSource = () => (made++, node());
      createBuffer = (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) });
      resume = () => Promise.resolve();
    }
    vi.stubGlobal('AudioContext', CountingContext);
    try {
      const audio = new Audio(true);
      audio.unlock();
      for (const sound of ['stone', 'hiss', 'snake', 'gulp', 'pop'] as const) audio[sound](true);
      expect(made).toBe(0);
      audio.setMuted(false);
      for (const sound of ['stone', 'hiss', 'snake', 'gulp', 'pop'] as const) audio[sound]();
      expect(made).toBeGreaterThanOrEqual(5);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('GetAudio_CalledTwice_Should_ReturnSameInstance', () => {
    expect(getAudio()).toBe(getAudio());
  });
});

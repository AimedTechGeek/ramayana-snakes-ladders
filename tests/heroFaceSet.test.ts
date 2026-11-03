// T44 4.4 R2 as data: Rama, Sita and Bharata keep a calm face in every frame; the comic set still has the drop and the tear.
import { describe, expect, it } from 'vitest';
import { FACE_FRAMES } from '../src/app/board3d/heroClips';
import { faceSetOf, faceSpec } from '../src/app/board3d/heroFace';

describe('Face sets (T44 4.4 R2)', () => {
  it('FaceSet_(RamaSitaAndBharata)_ShouldBeRestrainedAndTheOthersComic', () => {
    expect(faceSetOf('rama')).toBe('restrained');
    expect(faceSetOf('sita')).toBe('restrained');
    expect(faceSetOf('bharata')).toBe('restrained');
    expect(faceSetOf('lakshmana')).toBe('comic');
    expect(faceSetOf('hanuman')).toBe('comic');
  });

  it('Scared_(Restrained)_ShouldKeepTheIdleBrowsAndShowNoSweat', () => {
    const idle = faceSpec('restrained', 'idle');
    const scared = faceSpec('restrained', 'scared');
    expect(scared.browTilt).toBe(idle.browTilt);
    expect(scared.browLift).toBe(idle.browLift);
    expect(scared.sweatDrop).toBe(false);
  });

  it('Frames_(Restrained)_ShouldNeverDrawASweatDropATearOrSparkles', () => {
    for (const look of FACE_FRAMES) {
      const spec = faceSpec('restrained', look);
      expect(spec.sweatDrop, look).toBe(false);
      expect(spec.tear, look).toBe(false);
      expect(spec.sparkles, look).toBe(false);
    }
  });

  it('Frames_(Comic)_ShouldKeepTheComicDrawings', () => {
    expect(faceSpec('comic', 'scared').sweatDrop).toBe(true);
    expect(faceSpec('comic', 'sad').tear).toBe(true);
    expect(faceSpec('comic', 'excited').sparkles).toBe(true);
    expect(faceSpec('comic', 'scared').browLift).toBeGreaterThan(faceSpec('comic', 'idle').browLift);
  });
});

describe('Face sets of the new brothers (T46)', () => {
  it('FaceSet_(Bharata)_ShouldBeRestrainedLikeRamaAndShatrughnaComicLikeLakshmana', () => {
    expect(faceSetOf('bharata')).toBe('restrained');
    expect(faceSetOf('shatrughna')).toBe('comic');
  });
});

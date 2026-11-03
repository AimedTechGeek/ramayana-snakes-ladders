// The chapter card (T46.5): when a hero first enters a stage of the Ramayana, a glass card with the stage's name,
// Kanda and one line slides in at the bottom left and leaves by itself (HudStore times it). It never takes a pointer.

import { useEffect, useState } from 'react';
import { stageKey } from '../../game/stages';
import { t } from '../../i18n/i18n';
import { Sparkle } from '../ui/Controls';
import type { ChapterNotice } from './HudStore';

const LEAVE_MS = 150;

export function ChapterCard({ chapter }: { chapter: ChapterNotice | null }) {
  const [held, setHeld] = useState<ChapterNotice | null>(null);
  if (chapter && held !== chapter) setHeld(chapter);
  const leaving = !chapter && held !== null;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setHeld(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  if (!held) return null;
  const kanda = t(stageKey(held.stage, 'kanda'));
  return (
    <div
      key={held.seq}
      className={`chapter-card glass${leaving ? ' leaving' : ''}`}
      role="status"
      data-testid="chapter-card"
      data-stage={held.stage}
    >
      {kanda && <div className="chapter-kanda">{kanda}</div>}
      <div className="chapter-name">{t(stageKey(held.stage, 'name'))}</div>
      <div className="chapter-line">
        <Sparkle size={8} />
        {t(stageKey(held.stage, 'line'))}
      </div>
    </div>
  );
}

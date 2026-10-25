// Ladder palette (T03 §3) -> ladders/palette.json
import { P, shade, write } from './common.mjs';

export const LADDERS = {
  vishwamitra: { rail: P.parchment, rung: P.gold, style: 'wood' },
  'shiva-bow': { rail: P.gold, rung: P.indigo, style: 'bow' },
  wedding: { rail: P.sitaAccent, rung: P.saffron, style: 'rope' },
  guha: { rail: shade(P.parchment), rung: P.saffron, style: 'rope' },
  shabari: { rail: P.leaf, rung: P.blood, style: 'vine' },
  'hanuman-meeting': { rail: P.hanumanAccent, rung: P.gold, style: 'rope' },
  sugriva: { rail: P.ochre, rung: P.gold, style: 'stone' },
  'hanuman-leap': { rail: P.river, rung: P.parchment, style: 'tail' },
  'rama-setu': { rail: P.ochre, rung: shade(P.ochre), style: 'stone' },
};

export function writeLadders(root) {
  return {
    'ladders/palette.json': write(`${root}/ladders/palette.json`, JSON.stringify(LADDERS, null, 2) + '\n'),
  };
}

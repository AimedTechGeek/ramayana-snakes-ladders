// Every prop kind of the region atlas, region by region (T42 spec section 2 and 1.5).
import { AYODHYA } from './ayodhya.mjs';
import { DANDAKA } from './dandaka.mjs';
import { GANGA } from './ganga.mjs';
import { KISHKINDHA } from './kishkindha.mjs';
import { LANKA } from './lanka.mjs';
import { MITHILA } from './mithila.mjs';
import { SEA } from './sea.mjs';

export const KINDS = [...MITHILA, ...AYODHYA, ...DANDAKA, ...GANGA, ...KISHKINDHA, ...SEA, ...LANKA];

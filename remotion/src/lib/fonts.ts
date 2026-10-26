import { loadFont as anton } from '@remotion/google-fonts/Anton';
import { loadFont as archivo } from '@remotion/google-fonts/ArchivoBlack';
import { loadFont as inter } from '@remotion/google-fonts/Inter';
import { loadFont as serif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as mono } from '@remotion/google-fonts/SpaceMono';
import { loadFont as script } from '@remotion/google-fonts/Parisienne';

const A = anton('normal', { weights: ['400'], subsets: ['latin'] });
const B = archivo('normal', { weights: ['400'], subsets: ['latin'] });
const I = inter('normal', { weights: ['500', '600', '700', '800'], subsets: ['latin'] });
const S = serif('italic', { weights: ['400'], subsets: ['latin'] });
const M = mono('normal', { weights: ['400', '700'], subsets: ['latin'] });
const P = script('normal', { weights: ['400'], subsets: ['latin'] });

export const FONT = {
  anton: A.fontFamily, bold: B.fontFamily, ui: I.fontFamily, serif: S.fontFamily, mono: M.fontFamily, script: P.fontFamily,
} as const;
export type FontKey = keyof typeof FONT;
export const fontsReady = Promise.all([A, B, I, S, M, P].map((f) => f.waitUntilDone()));

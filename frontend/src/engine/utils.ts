import type { Color, Position } from './types';

// Board indices:
// 0  1  2  3  4  5  6  7
// 8  9 10 11 12 13 14 15
// ...
// 56 57 58 59 60 61 62 63

export const indexToPos = (idx: number): Position => ({
  r: Math.floor(idx / 8),
  c: idx % 8,
});

export const posToIndex = (r: number, c: number): number => r * 8 + c;

export const isValidPos = (r: number, c: number): boolean => r >= 0 && r < 8 && c >= 0 && c < 8;

export const rankToChar = (r: number): string => (8 - r).toString();
export const fileToChar = (c: number): string => String.fromCharCode('a'.charCodeAt(0) + c);
export const indexToAlgebraic = (idx: number): string => {
  const p = indexToPos(idx);
  return fileToChar(p.c) + rankToChar(p.r);
};

export const oppositeColor = (c: Color): Color => (c === 'w' ? 'b' : 'w');

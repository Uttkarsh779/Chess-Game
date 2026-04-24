import { Color, Position } from './types';

export const indexToPos = (idx: number): Position => ({
  r: Math.floor(idx / 8),
  c: idx % 8,
});

export const posToIndex = (r: number, c: number): number => r * 8 + c;

export const isValidPos = (r: number, c: number): boolean =>
  r >= 0 && r < 8 && c >= 0 && c < 8;

export const rankToChar = (r: number): string => (8 - r).toString();
export const fileToChar = (c: number): string =>
  String.fromCharCode('a'.charCodeAt(0) + c);

export const oppositeColor = (c: Color): Color => (c === 'w' ? 'b' : 'w');

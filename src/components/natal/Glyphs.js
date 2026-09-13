import React from 'react';

// Original local vector drawings of conventional astronomical symbols.
// A shared 24x24 coordinate space avoids platform-dependent emoji glyphs.
const paths = {
  '☉': 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M12 11.5v1',
  '☽': 'M15 3a9 9 0 1 0 0 18 10 10 0 0 1 0-18Z',
  '☿': 'M7 3a5 5 0 0 0 10 0 M17 10a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M12 15v7 M8 19h8',
  '♀': 'M18 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M12 14v8 M8 19h8',
  '♂': 'M15 15a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M13 11l8-8 M15 3h6v6',
  '♃': 'M5 5c8-5 9 6 0 9h14 M15 3v19',
  '♄': 'M8 2v15 M4 6h9 M8 11c10-6 11 4 7 9q-1 3 3 1',
  '♅': 'M4 3v11 M20 3v11 M4 9h16 M12 3v13 M15 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  '♆': 'M5 3v5a7 7 0 0 0 14 0V3 M12 2v20 M8 18h8',
  '♇': 'M15 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 7a7 7 0 0 0 14 0 M12 14v8 M8 19h8',
  '☊': 'M7 18C-2 4 26 4 17 18 M8 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  '☋': 'M7 6C-2 20 26 20 17 6 M8 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  '⚷': 'M15 18a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M11 14V2 M11 8l8-6 M11 8l8 6',
  '⚳': 'M5 10C1 0 19 0 19 10H12v12 M8 18h8',
  '⚴': 'M12 2l6 6-6 6-6-6Z M12 14v8 M8 18h8',
  '⚵': 'M12 2v12 M6 5l12 6 M18 5L6 11 M12 14v8 M8 18h8',
  '⚶': 'M12 2c-7 9-7 11 0 14 7-3 7-5 0-14Z M4 17l8 5 8-5',
  '⚸': 'M14 2a7 7 0 1 0 0 14 8 8 0 0 1 0-14Z M11 16v6 M7 19h8',
  'φ': 'M12 2v20 M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
  'W': 'M3 5l4 15 5-12 5 12 4-15',
  'X': 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M6 6l12 12 M18 6L6 18',
  'Vx': 'M2 5l5 14 5-14 M14 10l8 9 M22 10l-8 9',
  'sign-0': 'M12 21V8C12-2 0 1 4 10 M12 8C12-2 24 1 20 10',
  'sign-1': 'M18 15a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M5 2c0 9 14 9 14 0',
  'sign-2': 'M4 3q8 4 16 0 M4 21q8-4 16 0 M8 5v14 M16 5v14',
  'sign-3': 'M20 5C11 0 1 7 5 10c4 3 8-4 2-4 M4 19c9 5 19-2 15-5-4-3-8 4-2 4',
  'sign-4': 'M9 16a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M8 14C-1-1 20-2 16 10s-7 15 6 9',
  'sign-5': 'M3 21V6q2-7 5 0v15 M8 6q3-7 5 0v15 M13 6q3-7 5 0v10 M15 12q9-8 7 0c-2 6-5 8-9 9',
  'sign-6': 'M3 15h5a6 6 0 1 1 8 0h5 M3 21h18',
  'sign-7': 'M3 21V6q2-7 5 0v15 M8 6q3-7 5 0v15 M13 6q3-7 5 0v10q0 5 5 3 M20 15l3 4-4 3',
  'sign-8': 'M3 21L21 3 M11 3h10v10 M5 10l9 9',
  'sign-9': 'M2 5l5 16 5-16q4-4 4 4v8a4 4 0 1 0 4-4q-5 0-8 8',
  'sign-10': 'M2 9l4-4 4 4 4-4 4 4 4-4 M2 19l4-4 4 4 4-4 4 4 4-4',
  'sign-11': 'M5 2q9 10 0 20 M19 2q-9 10 0 20 M2 12h20',
};
export function glyphKey(id) { return Object.keys(paths).indexOf(id); }
export function GlyphDefs({ prefix }) {
  return <defs>{Object.entries(paths).map(([key, path], index) => <symbol id={`${prefix}-g${index}`} key={key} viewBox="0 0 24 24"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" /></symbol>)}</defs>;
}
export function Glyph({ id, prefix, x, y, size = 24 }) {
  const key = glyphKey(id);
  return key >= 0 ? <use href={`#${prefix}-g${key}`} x={x - size / 2} y={y - size / 2} width={size} height={size} aria-hidden="true" /> : <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size * .45} aria-hidden="true">{id}</text>;
}

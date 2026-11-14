import { SIGNS } from '../natal/model';
import { glyphPath } from '../natal/Glyphs';
import { SIGN_TEXTS } from './signTexts';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;
const ASC_NOTE = 'Асцендент не показан: для него нужно проверенное время рождения.';
// The site's own arrow for the Ascendant (24x24 space like the other glyphs).
const ASC_GLYPH = 'M6 18L18 6 M8 6h10v10';
const POSITIONS = [
  { id: 'sun', symbol: '☉', label: 'Солнце' },
  { id: 'moon', symbol: '☽', label: 'Луна' },
  { id: 'asc', symbol: 'AS', label: 'Асцендент' },
];

// Only signs are read from the chart. The Ascendant needs a verified birth time (time_provenance), it is never guessed.
export function bigThree(bodies, timeProvenance) {
  const signIndex = symbol => SIGNS.indexOf(bodies?.[symbol]?.sign);
  if (signIndex('☉') < 0 || signIndex('☽') < 0) return null;
  const ascKnown = timeProvenance === 'local_iana' && signIndex('AS') >= 0;
  const items = POSITIONS.filter(position => position.id !== 'asc' || ascKnown).map(position => {
    const index = signIndex(position.symbol);
    return { ...position, sign: SIGNS[index], signIndex: index, text: SIGN_TEXTS[position.id][index] };
  });
  return { items, ascNote: ascKnown ? null : ASC_NOTE };
}

export const cardDescription = three =>
  `Моя большая тройка: ${three.items.map(item => `${item.label} — ${item.sign}`).join(', ')}`;

export async function loadCardFonts() {
  try {
    await Promise.all(['500 40px Literata', '600 40px Manrope', '700 40px Manrope'].map(font => document.fonts.load(font)));
  } catch { /* fall back to the system fonts of the same style */ }
}

export const canvasToBlob = canvas => new Promise((resolve, reject) =>
  canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Пустая картинка'))), 'image/png'));

const token = (name, fallback) =>
  (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  return line ? [...lines, line] : lines;
}

function glyph(ctx, path, x, y, size, strokeWidth, stroke) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.stroke(new Path2D(path));
  ctx.restore();
}

// 1080x1920 story card in the site's night palette. Keep the title and footer out of the story app's top and bottom bars.
export function drawShareCard(canvas, three) {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  const color = {
    night: token('--ln-color-surface-inverse', '#0C071A'), text: token('--ln-color-text-inverse', '#FFFFFF'),
    muted: token('--ln-color-text-inverse-muted', '#D8D0E3'), line: token('--ln-color-inverse-border', 'rgba(216,208,227,.22)'),
    glow: token('--ln-color-cosmic-glow', 'rgba(108,82,245,.22)'), primary: token('--ln-color-primary', '#54227A'),
    secondary: token('--ln-color-secondary', '#6C52F5'), accent: token('--ln-color-accent', '#A13AD1'),
  };
  const display = token('--ln-font-display', "'Literata', Georgia, serif");
  const body = token('--ln-font-body', "'Manrope', sans-serif");
  const margin = 96, right = CARD_WIDTH - margin, textWidth = right - margin;

  ctx.fillStyle = color.night;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const glow = ctx.createRadialGradient(864, 0, 0, 864, 0, 1150);
  glow.addColorStop(0, color.glow);
  glow.addColorStop(1, 'rgba(12,7,26,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const low = ctx.createRadialGradient(100, CARD_HEIGHT, 0, 100, CARD_HEIGHT, 1000);
  low.addColorStop(0, 'rgba(84,34,122,.42)');
  low.addColorStop(1, 'rgba(12,7,26,0)');
  ctx.fillStyle = low;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = color.text;
  ctx.font = `500 80px ${display}`;
  ctx.fillText('Моя большая тройка', margin, 310);

  const rule = y => { ctx.fillStyle = color.line; ctx.fillRect(margin, y, textWidth, 2); };
  const rowHeight = 360, firstRow = 410;
  three.items.forEach((item, index) => {
    const top = firstRow + index * rowHeight;
    rule(top);
    glyph(ctx, item.id === 'asc' ? ASC_GLYPH : glyphPath(item.symbol), margin + 28, top + 76, 56, 1.65, color.muted);
    ctx.fillStyle = color.muted;
    ctx.font = `600 38px ${body}`;
    ctx.fillText(item.label, margin + 80, top + 90);
    ctx.fillStyle = color.text;
    ctx.font = `500 128px ${display}`;
    ctx.fillText(item.sign, margin, top + 218);
    const gradient = ctx.createLinearGradient(right - 170, top + 80, right, top + 250);
    gradient.addColorStop(0, color.secondary);
    gradient.addColorStop(1, color.accent);
    glyph(ctx, glyphPath(`sign-${item.signIndex}`), right - 85, top + 165, 170, 1.3, gradient);
    ctx.fillStyle = color.muted;
    ctx.font = `500 36px ${body}`;
    wrap(ctx, item.text, textWidth).slice(0, 2).forEach((line, lineIndex) => ctx.fillText(line, margin, top + 278 + lineIndex * 46));
  });
  if (three.ascNote) {
    const top = firstRow + three.items.length * rowHeight;
    rule(top);
    ctx.fillStyle = color.muted;
    ctx.font = `500 38px ${body}`;
    wrap(ctx, three.ascNote, textWidth).forEach((line, lineIndex) => ctx.fillText(line, margin, top + 90 + lineIndex * 52));
  }

  rule(firstRow + 3 * rowHeight);
  const brandY = firstRow + 3 * rowHeight + 100;
  // The site's orbit mark from the header, at card scale.
  ctx.save();
  ctx.translate(margin + 30, brandY - 18);
  ctx.scale(1.5, 1.5);
  ctx.translate(-20, -20);
  ctx.strokeStyle = color.text;
  ctx.fillStyle = color.text;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(20, 20, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(20, 20, 19, 7, -40 * Math.PI / 180, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(20, 20, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = color.text;
  ctx.font = `500 54px ${display}`;
  ctx.fillText('Lunaria', margin + 80, brandY);
  ctx.fillStyle = color.muted;
  ctx.font = `700 38px ${body}`;
  ctx.fillText('mylunariaai.com', margin + 80, brandY + 56);
}

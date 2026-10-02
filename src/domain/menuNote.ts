import { parseIso, toDisplay, weekRangeLabel } from './week';
import type { MenuRow } from './types';

export const LIST_MARKER = 'LISTA DELLA SPESA';

export function menuNote(weekStart: string, rows: MenuRow[]): string {
  const lines = rows
    .filter(r => r.weekStart === weekStart)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(r => `${r.dayName} ${toDisplay(parseIso(r.date))} — Pranzo: ${r.lunch || '—'} — Cena: ${r.dinner || '—'}`);
  return [`Menù della settimana: ${weekRangeLabel(weekStart)}`, '', ...lines].join('\n');
}

export function composeListFile(note: string, items: string[]): string {
  const body = items.length > 0 ? `\n${items.map(i => `- ${i}`).join('\n')}` : '';
  return `${note}\n\n${LIST_MARKER}${body}`;
}

export function parseListFile(content: string): { items: string[] } {
  const lines = content.split('\n');
  const marker = lines.findIndex(l => l.trim() === LIST_MARKER);
  if (marker === -1) {
    return { items: [] };
  }
  const items = lines
    .slice(marker + 1)
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  return { items };
}
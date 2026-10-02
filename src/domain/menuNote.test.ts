import { describe, expect, it } from 'vitest';
import { composeListFile, LIST_MARKER, menuNote, parseListFile } from './menuNote';
import type { MenuRow } from './types';

const weekStart = '2026-09-21';
const rows: MenuRow[] = [
  { weekStart, dayName: 'Lunedì', date: '2026-09-21', lunch: 'Pasta', dinner: 'Pizza' },
  { weekStart, dayName: 'Martedì', date: '2026-09-22', lunch: '', dinner: 'Tortino' },
];
const otherWeek: MenuRow = { weekStart: '2026-09-28', dayName: 'Lunedì', date: '2026-09-28', lunch: 'Riso', dinner: '' };

describe('menuNote', () => {
  it('builds a header and one line per day, ignoring other weeks', () => {
    const note = menuNote(weekStart, [...rows, otherWeek]);
    const lines = note.split('\n');
    expect(lines[0]).toBe('Menù della settimana: dal 21/09/2026 al 27/09/2026');
    expect(note).toContain('Lunedì 21/09/2026 — Pranzo: Pasta — Cena: Pizza');
    expect(note).toContain('Martedì 22/09/2026 — Pranzo: — — Cena: Tortino');
    expect(note).not.toContain('Riso');
  });

  it('renders just the header for a week without stored rows', () => {
    const note = menuNote(weekStart, [otherWeek]);
    expect(note.split('\n').length).toBeGreaterThanOrEqual(1);
    expect(note).toContain('Menù della settimana:');
    expect(note).not.toContain('Pranzo:');
  });
});

describe('composeListFile / parseListFile', () => {
  it('roundtrips items after the marker', () => {
    const note = menuNote(weekStart, rows);
    const content = composeListFile(note, ['farina', 'uova 6']);
    const lines = content.split('\n');
    expect(lines).toContain(LIST_MARKER);
    expect(lines).toContain('- farina');
    expect(lines).toContain('- uova 6');
    expect(parseListFile(content).items).toEqual(['farina', 'uova 6']);
  });

  it('supports an empty list (no items) roundtripping to []', () => {
    const content = composeListFile(menuNote(weekStart, rows), []);
    expect(content).toContain(LIST_MARKER);
    expect(parseListFile(content).items).toEqual([]);
  });

  it('returns empty items when there is no marker', () => {
    expect(parseListFile('niente lista qui').items).toEqual([]);
  });
});
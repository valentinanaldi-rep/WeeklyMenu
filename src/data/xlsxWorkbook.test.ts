import { describe, expect, it } from 'vitest';
import type { MenuRow, WeekMenu } from '../domain/types';
import { emptyWorkbook, mergeWeek, parseWorkbook, serializeWorkbook } from './xlsxWorkbook';

const rows: MenuRow[] = [
  { weekStart: '2026-02-23', dayName: 'Lunedì', date: '2026-02-23', lunch: 'Pasta', dinner: 'Pizza' },
  { weekStart: '2026-02-23', dayName: 'Martedì', date: '2026-02-24', lunch: 'Riso', dinner: '' },
];

describe('xlsx workbook', () => {
  it('empty workbook has headers only and parses to no rows', () => {
    expect(parseWorkbook(emptyWorkbook())).toEqual([]);
  });

  it('round-trips rows through serialize/parse', () => {
    expect(parseWorkbook(serializeWorkbook(rows))).toEqual(rows);
  });

  it('keeps strings starting with = verbatim (no formula)', () => {
    const formulaRow: MenuRow[] = [{ ...rows[0], lunch: '=A1+B1', dinner: '=2+3' }];
    const out = parseWorkbook(serializeWorkbook(formulaRow));
    expect(out[0].lunch).toBe('=A1+B1');
    expect(out[0].dinner).toBe('=2+3');
  });

  it('mergeWeek appends the week when absent', () => {
    const merged = mergeWeek([], weekWithLunch(''));
    expect(merged).toHaveLength(7);
    expect(merged.every(r => r.weekStart === '2026-02-23')).toBe(true);
  });

  it('mergeWeek replaces the same week and keeps other weeks', () => {
    const other: MenuRow = { weekStart: '2026-03-02', dayName: 'Lunedì', date: '2026-03-02', lunch: 'Minestra', dinner: 'Frittata' };
    const updated = mergeWeek([...rows, other], weekWithLunch('Lasagne'));
    expect(updated.filter(r => r.weekStart === '2026-02-23')).toHaveLength(7);
    expect(updated.filter(r => r.weekStart === '2026-02-23').every(r => r.lunch === 'Lasagne')).toBe(true);
    expect(updated).toContainEqual(other);
  });
});

function weekWithLunch(lunch: string): WeekMenu {
  const w: WeekMenu = { weekStart: '2026-02-23', days: [] };
  for (let i = 0; i < 7; i++) {
    w.days.push({ dayName: `G${i}`, date: `2026-02-2${i}`, lunch, dinner: '' });
  }
  return w;
}
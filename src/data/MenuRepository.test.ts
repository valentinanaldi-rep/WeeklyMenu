import { describe, expect, it } from 'vitest';
import type { WeekMenu } from '../domain/types';
import { InMemoryFileGateway } from './FileGateway';
import { XlsxMenuRepository } from './MenuRepository';
import { emptyWorkbook } from './xlsxWorkbook';

const weekA: WeekMenu = {
  weekStart: '2026-02-23',
  days: [
    { dayName: 'Lunedì', date: '2026-02-23', lunch: 'Pasta', dinner: 'Pizza' },
    { dayName: 'Martedì', date: '2026-02-24', lunch: 'Riso', dinner: '' },
    { dayName: 'Mercoledì', date: '2026-02-25', lunch: '', dinner: 'Tortino' },
    { dayName: 'Giovedì', date: '2026-02-26', lunch: '', dinner: '' },
    { dayName: 'Venerdì', date: '2026-02-27', lunch: '', dinner: '' },
    { dayName: 'Sabato', date: '2026-02-28', lunch: '', dinner: '' },
    { dayName: 'Domenica', date: '2026-03-01', lunch: '', dinner: '' },
  ],
};

const weekB: WeekMenu = {
  weekStart: '2026-03-02',
  days: [
    { dayName: 'Lunedì', date: '2026-03-02', lunch: '', dinner: '' },
    { dayName: 'Martedì', date: '2026-03-03', lunch: '', dinner: '' },
    { dayName: 'Mercoledì', date: '2026-03-04', lunch: '', dinner: '' },
    { dayName: 'Giovedì', date: '2026-03-05', lunch: '', dinner: '' },
    { dayName: 'Venerdì', date: '2026-03-06', lunch: '', dinner: '' },
    { dayName: 'Sabato', date: '2026-03-07', lunch: '', dinner: '' },
    { dayName: 'Domenica', date: '2026-03-08', lunch: '', dinner: '' },
  ],
};

describe('XlsxMenuRepository', () => {
  it('starts empty when no file is available', async () => {
    const repo = new XlsxMenuRepository(new InMemoryFileGateway());
    expect(await repo.loadWeeks()).toEqual([]);
  });

  it('loads nothing from a header-only workbook', async () => {
    const repo = new XlsxMenuRepository(new InMemoryFileGateway(emptyWorkbook()));
    expect(await repo.loadWeeks()).toEqual([]);
  });

  it('saves a week and reads back its 7 rows', async () => {
    const repo = new XlsxMenuRepository(new InMemoryFileGateway());
    await repo.saveWeek(weekA);
    const rows = await repo.loadWeeks();
    expect(rows).toHaveLength(7);
    expect(rows.filter(r => r.weekStart === '2026-02-23')).toHaveLength(7);
    expect(rows.find(r => r.date === '2026-02-23')?.lunch).toBe('Pasta');
    expect(rows.find(r => r.date === '2026-02-24')?.dinner).toBe('');
  });

  it('preserves other weeks when saving a new one', async () => {
    const repo = new XlsxMenuRepository(new InMemoryFileGateway());
    await repo.saveWeek(weekA);
    await repo.saveWeek(weekB);
    const rows = await repo.loadWeeks();
    expect(rows).toHaveLength(14);
    expect(rows.filter(r => r.weekStart === '2026-02-23')).toHaveLength(7);
    expect(rows.filter(r => r.weekStart === '2026-03-02')).toHaveLength(7);
  });

  it('overwrites the same week keeping exactly 7 rows', async () => {
    const repo = new XlsxMenuRepository(new InMemoryFileGateway());
    await repo.saveWeek(weekA);
    await repo.saveWeek({ ...weekA, days: weekA.days.map(d => ({ ...d, lunch: '-' })) });
    const rows = await repo.loadWeeks();
    expect(rows).toHaveLength(7);
    expect(rows.every(r => r.lunch === '-')).toBe(true);
  });

  it('preserves values starting with = verbatim', async () => {
    const repo = new XlsxMenuRepository(new InMemoryFileGateway());
    await repo.saveWeek({ ...weekA, days: weekA.days.map(d => ({ ...d, lunch: '=A1+B1' })) });
    const rows = await repo.loadWeeks();
    expect(rows.every(r => r.lunch === '=A1+B1')).toBe(true);
  });
});
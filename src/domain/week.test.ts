import { describe, expect, it } from 'vitest';
import { DAY_NAMES } from './week';
import {
  addDays, dateForDay, parseIso, previousYearWeekStart, startOfWeek,
  startOfWeekToday, toDisplay, toIso, weekMenuFor, weekRangeLabel,
  weekStartForOffset,
} from './week';

describe('week date logic', () => {
  it('startOfWeek returns the Monday of the same week', () => {
    expect(toIso(startOfWeek(parseIso('2026-02-25')))).toBe('2026-02-23');
    expect(toIso(startOfWeek(parseIso('2026-02-23')))).toBe('2026-02-23');
  });

  it('wraps across year end keeping weekdays aligned', () => {
    expect(toIso(addDays(parseIso('2026-12-28'), 7))).toBe('2027-01-04');
    expect(toIso(startOfWeek(parseIso('2027-01-01')))).toBe('2026-12-28');
    expect(weekRangeLabel('2026-12-28')).toBe('dal 28/12/2026 al 03/01/2027');
  });

  it('weekStartForOffset(0) is today week, 1 is next, -1 previous', () => {
    const cur = toIso(startOfWeekToday());
    expect(toIso(weekStartForOffset(0))).toBe(cur);
    expect(toIso(weekStartForOffset(1))).toBe(toIso(addDays(parseIso(cur), 7)));
    expect(toIso(weekStartForOffset(-1))).toBe(toIso(addDays(parseIso(cur), -7)));
  });

  it('builds a 7-day week from Monday to Sunday', () => {
    const week = weekMenuFor('2026-02-23');
    expect(week.weekStart).toBe('2026-02-23');
    expect(week.days).toHaveLength(7);
    expect(week.days.map(d => d.dayName)).toEqual([...DAY_NAMES]);
    expect(week.days[0].date).toBe('2026-02-23');
    expect(week.days[6].date).toBe('2026-03-01');
    expect(dateForDay('2026-02-23', 3)).toBe('2026-02-26');
  });

  it('formats iso and display strings', () => {
    expect(toIso(parseIso('2026-02-23'))).toBe('2026-02-23');
    expect(toDisplay(parseIso('2026-02-23'))).toBe('23/02/2026');
  });

  it('previousYearWeekStart is exactly 364 days before', () => {
    expect(previousYearWeekStart('2026-02-23')).toBe('2025-02-24');
    expect(previousYearWeekStart('2026-02-23')).toBe(toIso(addDays(parseIso('2026-02-23'), -364)));
  });
});
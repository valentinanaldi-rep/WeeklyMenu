import type { WeekMenu } from './types';

export const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const;

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function startOfWeek(date: Date): Date {
  const mondayIndex = (date.getUTCDay() + 6) % 7;
  return addDays(date, -mondayIndex);
}

export function startOfWeekToday(): Date {
  const now = new Date();
  return startOfWeek(utc(now.getFullYear(), now.getMonth() + 1, now.getDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function weekStartForOffset(offsetWeeks: number): Date {
  return addDays(startOfWeekToday(), offsetWeeks * 7);
}

export function toIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDisplay(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getUTCFullYear()}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return utc(y, m, d);
}

export function dateForDay(weekStartIso: string, dayIndex: number): string {
  return toIso(addDays(parseIso(weekStartIso), dayIndex));
}

export function weekMenuFor(weekStartIso: string): WeekMenu {
  return {
    weekStart: weekStartIso,
    days: DAY_NAMES.map((name, i) => ({
      dayName: name,
      date: dateForDay(weekStartIso, i),
      lunch: '',
      dinner: '',
    })),
  };
}

export function weekRangeLabel(weekStartIso: string): string {
  const start = parseIso(weekStartIso);
  return `dal ${toDisplay(start)} al ${toDisplay(addDays(start, 6))}`;
}

export function previousYearWeekStart(weekStartIso: string): string {
  return toIso(addDays(parseIso(weekStartIso), -364));
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function offsetForWeekStart(targetWeekStartIso: string): number {
  const target = parseIso(targetWeekStartIso);
  const current = startOfWeekToday();
  return Math.round((target.getTime() - current.getTime()) / MS_PER_WEEK);
}

export function toIsoWeekValue(weekStartIso: string): string {
  const monday = parseIso(weekStartIso);
  const thursday = addDays(monday, 3 - ((monday.getUTCDay() + 6) % 7));
  const isoYear = thursday.getUTCFullYear();
  const mondayOfWeek1 = startOfWeek(utc(isoYear, 1, 4));
  const week = Math.round((thursday.getTime() - mondayOfWeek1.getTime()) / MS_PER_WEEK) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function weekStartFromIsoWeekValue(value: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const isoYear = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) {
    return null;
  }
  const mondayOfWeek1 = startOfWeek(utc(isoYear, 1, 4));
  return toIso(addDays(mondayOfWeek1, (week - 1) * 7));
}
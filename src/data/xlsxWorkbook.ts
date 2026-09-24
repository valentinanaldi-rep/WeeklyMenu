import * as XLSX from 'xlsx';
import type { MenuRow, WeekMenu } from '../domain/types';

export const SHEET_NAME = 'Menù';
export const HEADERS = ['Settimana', 'Giorno', 'Data', 'Pranzo', 'Cena'];

function stringCells(values: string[]): XLSX.CellObject[] {
  return values.map(v => ({ t: 's', v }));
}

function aoaToSheet(rows: string[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows.map(values => stringCells(values)));
}

function toBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out as ArrayBuffer;
}

function workbook(ws: XLSX.WorkSheet): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  return wb;
}

export function emptyWorkbook(): ArrayBuffer {
  return toBuffer(workbook(aoaToSheet([HEADERS])));
}

export function serializeWorkbook(rows: MenuRow[]): ArrayBuffer {
  const sheetRows = [HEADERS, ...rows.map(r => [r.weekStart, r.dayName, r.date, r.lunch, r.dinner])];
  return toBuffer(workbook(aoaToSheet(sheetRows)));
}

export function parseWorkbook(buffer: ArrayBuffer): MenuRow[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[SHEET_NAME] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const records = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
  return records.map(r => ({
    weekStart: String(r.Settimana ?? ''),
    dayName: String(r.Giorno ?? ''),
    date: String(r.Data ?? ''),
    lunch: String(r.Pranzo ?? ''),
    dinner: String(r.Cena ?? ''),
  }));
}

export function mergeWeek(rows: MenuRow[], week: WeekMenu): MenuRow[] {
  const others = rows.filter(r => r.weekStart !== week.weekStart);
  const newRows: MenuRow[] = week.days.map(day => ({
    weekStart: week.weekStart,
    dayName: day.dayName,
    date: day.date,
    lunch: day.lunch,
    dinner: day.dinner,
  }));
  return [...others, ...newRows];
}
# Weekly Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un'app Ionic React a schermata unica per visualizzare e inserire il menù settimanale, persistita in un file Excel `dati/menu.xlsx` del progetto.

**Architecture:** Tre strati isolati — `src/domain` (modello + logica date pura), `src/data` (persistenza: SheetJS + `FileGateway` + repository), `src/pages/Home.tsx` (UI Ionic). In browser dev un piccolo middleware Vite (`viteDevFilePlugin`) espone GET/POST su `/api/menu` che leggono/riscrivono il reale file `dati/menu.xlsx`; sostituendo solo `FileGateway` l'app girerà su dispositivo reale.

**Tech Stack:** Ionic React 9, Capacitor 8, React 19, Vite, Vitest (jsdom) + Testing Library, SheetJS (`xlsx` 0.18.5). Nessuna dipendenza runtime oltre `xlsx`.

**Spec:** `docs/superpowers/specs/2026-09-24-weekly-menu-design.md`

## Global Constraints

- Unica nuova dipendenza runtime: `xlsx` (SheetJS).
- Colonne Excel: `Settimana | Giorno | Data | Pranzo | Cena`, header in riga 1, foglio "Menù", date ISO `yyyy-mm-dd`.
- `dati/*.xlsx` in `.gitignore`; `dati/.gitkeep` committato.
- Tutta la matematica date in UTC (niente DST/ora locale).
- Nomi giorni: `Lunedì … Domenica` iniziale maiuscola.
- Testi senza interpretazione formula Excel (valori tipo `=SUM(...)` salvati e riletti verbatim).
- Sostituzione settimana: le righe delle altre settimane restano intatte.
- Doppio click su matita in modalità inserimento: ignorato.
- Il middleware Vite è attivo solo in `configureServer` (solo dev server).

## Review Focus

1. Settimana a cavallo di fine anno (es. 28/12/2026 → 03/01/2027): le date devono restare esatte e i giorni della settimana coerenti.
2. Workbook vuoto (solo header): caricato come lista vuota, nessun crash.
3. File `dati/menu.xlsx` assente al primo GET: il middleware lo crea con header e lo serve.
4. Valori che iniziano con `=`: salvati e riletti come testo letterale (niente formula Excel).
5. Salvataggio di una settimana: le righe delle altre settimane presenti vengono preservate.

---

### Task 1: Setup — dipendenze, `dati/`, gitignore

**Files:**
- Modify: `package.json` (via `npm i`), `.gitignore`
- Create: `dati/.gitkeep`

**Interfaces:**
- Consumes: nothing.
- Produces: toolchain pronta; cartella `dati/` presente; dati ignorati da git.

- [ ] **Step 1: Installa SheetJS**

Run: `npm install xlsx@0.18.5`
Expected: aggiorna `package.json` e `package-lock.json`; nessun errore.

- [ ] **Step 2: Crea la cartella dati**

```powershell
New-Item -ItemType Directory -Path "dati" -Force; New-Item -ItemType File -Path "dati\.gitkeep" -Force
```

- [ ] **Step 3: Gitignore per i dati**

Append to `.gitignore`:

```
# app data
/dati/*.xlsx
```

- [ ] **Step 4: Verifica toolchain**

Run: `npm run build`
Expected: build ok (tsc + vite), nessun errore.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore dati/.gitkeep
git commit -m "chore: add xlsx dependency and dati dir"
```

---

### Task 2: Domain — tipi e logica date

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/week.ts`
- Test: `src/domain/week.test.ts`

**Interfaces:**
- Consumes: nothing (nuovo modulo).
- Produces (usati nei task successivi):
  - `types.ts`: `DayMenu { dayName, date, lunch, dinner }`, `WeekMenu { weekStart, days }`, `MenuRow { weekStart, dayName, date, lunch, dinner }` (tutte string).
  - `week.ts`: `DAY_NAMES`, `startOfWeekToday(): Date`, `startOfWeek(date: Date): Date`, `addDays(date: Date, days: number): Date`, `weekStartForOffset(offsetWeeks: number): Date`, `toIso(date: Date): string`, `toDisplay(date: Date): string`, `parseIso(iso: string): Date`, `dateForDay(weekStartIso: string, dayIndex: number): string`, `weekMenuFor(weekStartIso: string): WeekMenu`, `weekRangeLabel(weekStartIso: string): string`, `previousYearWeekStart(weekStartIso: string): string`.

- [ ] **Step 1: Scrivi i test che falliscono**

Create `src/domain/week.test.ts`:

```ts
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
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm run test.unit -- --run src/domain/week.test.ts`
Expected: FAIL (il modulo `./week` non esiste).

- [ ] **Step 3: Implementa i tipi**

Create `src/domain/types.ts`:

```ts
export interface DayMenu {
  dayName: string;
  date: string;
  lunch: string;
  dinner: string;
}

export interface WeekMenu {
  weekStart: string;
  days: DayMenu[];
}

export interface MenuRow {
  weekStart: string;
  dayName: string;
  date: string;
  lunch: string;
  dinner: string;
}
```

- [ ] **Step 4: Implementa la logica date**

Create `src/domain/week.ts`:

```ts
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
```

- [ ] **Step 5: Verifica che passino**

Run: `npm run test.unit -- --run src/domain/week.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/week.ts src/domain/week.test.ts
git commit -m "feat: domain types and UTC date logic"
```

---

### Task 3: Data — serializzazione workbook Excel

**Files:**
- Create: `src/data/xlsxWorkbook.ts`
- Test: `src/data/xlsxWorkbook.test.ts`

**Interfaces:**
- Consumes: `MenuRow`, `WeekMenu` da `src/domain/types`.
- Produces:
  - `SHEET_NAME = 'Menù'`, `HEADERS = ['Settimana', 'Giorno', 'Data', 'Pranzo', 'Cena']`
  - `emptyWorkbook(): ArrayBuffer`
  - `parseWorkbook(buffer: ArrayBuffer): MenuRow[]`
  - `serializeWorkbook(rows: MenuRow[]): ArrayBuffer`
  - `mergeWeek(rows: MenuRow[], week: WeekMenu): MenuRow[]`

- [ ] **Step 1: Scrivi i test che falliscono**

Create `src/data/xlsxWorkbook.test.ts`:

```ts
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
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm run test.unit -- --run src/data/xlsxWorkbook.test.ts`
Expected: FAIL (modulo `./xlsxWorkbook` non esiste).

- [ ] **Step 3: Implementa la serializzazione**

Create `src/data/xlsxWorkbook.ts`:

```ts
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
```

- [ ] **Step 4: Verifica che passino**

Run: `npm run test.unit -- --run src/data/xlsxWorkbook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/xlsxWorkbook.ts src/data/xlsxWorkbook.test.ts
git commit -m "feat: xlsx workbook serialize/parse/merge"
```

---

### Task 4: Data — FileGateway e MenuRepository

**Files:**
- Create: `src/data/FileGateway.ts`
- Create: `src/data/MenuRepository.ts`
- Test: `src/data/MenuRepository.test.ts`

**Interfaces:**
- Consumes: `MenuRow`, `WeekMenu` da `src/domain/types`; `parseWorkbook`, `serializeWorkbook`, `mergeWeek` da `src/data/xlsxWorkbook`.
- Produces:
  - `FileGateway`: `read(): Promise<ArrayBuffer | null>`, `write(data: ArrayBuffer): Promise<void>`
  - `InMemoryFileGateway` (implements `FileGateway`, `constructor(initial?: ArrayBuffer | null)`)
  - `MenuRepository`: `loadWeeks(): Promise<MenuRow[]>`, `saveWeek(week: WeekMenu): Promise<void>`
  - `XlsxMenuRepository` (implements `MenuRepository`, `constructor(gateway: FileGateway)`)

- [ ] **Step 1: Scrivi i test che falliscono**

Create `src/data/MenuRepository.test.ts`:

```ts
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

- [ ] **Step 2: Verifica che falliscano**

Run: `npm run test.unit -- --run src/data/MenuRepository.test.ts`
Expected: FAIL (modulo `./FileGateway` o `./MenuRepository` non esiste).

- [ ] **Step 3: Implementa FileGateway**

Create `src/data/FileGateway.ts`:

```ts
export interface FileGateway {
  read(): Promise<ArrayBuffer | null>;
  write(data: ArrayBuffer): Promise<void>;
}

export class InMemoryFileGateway implements FileGateway {
  private data: ArrayBuffer | null;

  constructor(initial?: ArrayBuffer | null) {
    this.data = initial ?? null;
  }

  async read(): Promise<ArrayBuffer | null> {
    return this.data;
  }

  async write(data: ArrayBuffer): Promise<void> {
    this.data = data;
  }
}
```

- [ ] **Step 4: Implementa MenuRepository**

Create `src/data/MenuRepository.ts`:

```ts
import type { MenuRow, WeekMenu } from '../domain/types';
import type { FileGateway } from './FileGateway';
import { mergeWeek, parseWorkbook, serializeWorkbook } from './xlsxWorkbook';

export interface MenuRepository {
  loadWeeks(): Promise<MenuRow[]>;
  saveWeek(week: WeekMenu): Promise<void>;
}

export class XlsxMenuRepository implements MenuRepository {
  constructor(private readonly gateway: FileGateway) {}

  async loadWeeks(): Promise<MenuRow[]> {
    const buffer = await this.gateway.read();
    return buffer === null ? [] : parseWorkbook(buffer);
  }

  async saveWeek(week: WeekMenu): Promise<void> {
    const buffer = await this.gateway.read();
    const rows = buffer === null ? [] : parseWorkbook(buffer);
    const merged = mergeWeek(rows, week);
    await this.gateway.write(serializeWorkbook(merged));
  }
}
```

- [ ] **Step 5: Verifica che passino**

Run: `npm run test.unit -- --run src/data/MenuRepository.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/FileGateway.ts src/data/MenuRepository.ts src/data/MenuRepository.test.ts
git commit -m "feat: menu repository over xlsx file gateway"
```

---

### Task 5: Data — gateway HTTP dev e middleware Vite

**Files:**
- Create: `src/data/DevHttpFileGateway.ts`
- Create: `src/data/viteDevFilePlugin.ts`
- Test: `src/data/devHttp.test.ts`

**Interfaces:**
- Consumes: `FileGateway` da `src/data/FileGateway`; `emptyWorkbook`, `parseWorkbook`, `serializeWorkbook` da `src/data/xlsxWorkbook`; `MenuRow` da `src/domain/types`.
- Produces:
  - `DevHttpFileGateway` (implements `FileGateway`, `constructor(baseUrl?: string)`): GET/POST su `${baseUrl}/api/menu`.
  - `createFileMiddleware(filePath: string): Connect.NextHandleFunction` — GET: crea il file se manca (`emptyWorkbook()`) e lo serve; POST: sovrascrive il file.
  - `viteDevFilePlugin(): Plugin` — registra il middleware su `configureServer` risolvendo `path.resolve(process.cwd(), 'dati', 'menu.xlsx')`.

- [ ] **Step 1: Scrivi i test che falliscono**

Create `src/data/devHttp.test.ts`:

```ts
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MenuRow } from '../domain/types';
import { DevHttpFileGateway } from './DevHttpFileGateway';
import { createFileMiddleware } from './viteDevFilePlugin';
import { parseWorkbook, serializeWorkbook } from './xlsxWorkbook';

const rows: MenuRow[] = [
  { weekStart: '2026-02-23', dayName: 'Lunedì', date: '2026-02-23', lunch: 'Pasta', dinner: 'Pizza' },
  { weekStart: '2026-02-23', dayName: 'Martedì', date: '2026-02-24', lunch: 'Riso', dinner: '' },
];

describe('dev file server', () => {
  const servers: ReturnType<typeof createServer>[] = [];
  const dirs: string[] = [];

  afterEach(() => {
    for (const s of servers.splice(0)) {
      s.close();
    }
    for (const d of dirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  async function start(): Promise<{ port: number; file: string }> {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-'));
    dirs.push(dir);
    const file = path.join(dir, 'menu.xlsx');
    const handler = createFileMiddleware(file) as unknown as RequestListener;
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    return { port, file };
  }

  it('GET creates the file with headers when missing', async () => {
    const { port, file } = await start();
    const res = await fetch(`http://localhost:${port}/api/menu`);
    expect(res.ok).toBe(true);
    expect(parseWorkbook(await res.arrayBuffer())).toEqual([]);
    expect(existsSync(file)).toBe(true);
  });

  it('POST writes rows and GET returns them', async () => {
    const { port } = await start();
    const post = await fetch(`http://localhost:${port}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: serializeWorkbook(rows),
    });
    expect(post.ok).toBe(true);
    const get = await fetch(`http://localhost:${port}/api/menu`);
    expect(parseWorkbook(await get.arrayBuffer())).toEqual(rows);
  });

  it('POST overwrites previous content', async () => {
    const { port } = await start();
    await fetch(`http://localhost:${port}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: serializeWorkbook(rows),
    });
    await fetch(`http://localhost:${port}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: serializeWorkbook([]),
    });
    const get = await fetch(`http://localhost:${port}/api/menu`);
    expect(parseWorkbook(await get.arrayBuffer())).toEqual([]);
  });

it('DevHttpFileGateway reads and writes through the server', async () => {
    const { port } = await start();
    const gateway = new DevHttpFileGateway(`http://localhost:${port}`);
    const initial = await gateway.read();
    expect(initial).not.toBeNull();
    await gateway.write(serializeWorkbook(rows));
    const after = await gateway.read();
    expect(parseWorkbook(after as ArrayBuffer)).toEqual(rows);
  });
});

- [ ] **Step 2: Verifica che falliscano**

Run: `npm run test.unit -- --run src/data/devHttp.test.ts`
Expected: FAIL (moduli `./DevHttpFileGateway` e `./viteDevFilePlugin` non esistono).

- [ ] **Step 3: Implementa DevHttpFileGateway**

Create `src/data/DevHttpFileGateway.ts`:

```ts
import type { FileGateway } from './FileGateway';

export class DevHttpFileGateway implements FileGateway {
  constructor(private readonly baseUrl: string = '') {}

  async read(): Promise<ArrayBuffer | null> {
    const res = await fetch(`${this.baseUrl}/api/menu`);
    if (!res.ok) {
      throw new Error(`Failed to read menu: ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    return buffer.byteLength === 0 ? null : buffer;
  }

  async write(data: ArrayBuffer): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data,
    });
    if (!res.ok) {
      throw new Error(`Failed to save menu: ${res.status}`);
    }
  }
}
```

- [ ] **Step 4: Implementa il middleware e il plugin**

Create `src/data/viteDevFilePlugin.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Connect, Plugin } from 'vite';
import path from 'node:path';
import { emptyWorkbook } from './xlsxWorkbook';

export function createFileMiddleware(filePath: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? '';
    if (url !== '/api/menu' && !url.startsWith('/api/menu?')) {
      next();
      return;
    }

    if (req.method === 'GET') {
      if (!existsSync(filePath)) {
        writeFileSync(filePath, Buffer.from(emptyWorkbook()));
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.end(readFileSync(filePath));
      return;
    }

    if (req.method === 'POST') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        writeFileSync(filePath, Buffer.concat(chunks));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('ok');
      });
      return;
    }

    next();
  };
}

export function viteDevFilePlugin(): Plugin {
  return {
    name: 'weeklymenu-dati',
    configureServer(server) {
      const filePath = path.resolve(process.cwd(), 'dati', 'menu.xlsx');
      server.middlewares.use(createFileMiddleware(filePath));
    },
  };
}
```

- [ ] **Step 5: Verifica che passino**

Run: `npm run test.unit -- --run src/data/devHttp.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/DevHttpFileGateway.ts src/data/viteDevFilePlugin.ts src/data/devHttp.test.ts
git commit -m "feat: dev http file gateway and vite middleware"
```

---

### Task 6: UI — Home in modalità vista

**Files:**
- Create: `src/pages/Home.test.tsx`
- Modify: `src/pages/Home.tsx` (riscritto), `src/pages/Home.css` (riscritto)
- Delete: `src/components/ExploreContainer.tsx`, `src/components/ExploreContainer.css`

**Interfaces:**
- Consumes: `MenuRepository` da `src/data/MenuRepository`; `DevHttpFileGateway` da `src/data/DevHttpFileGateway`; `DayMenu`, `MenuRow`, `WeekMenu` da `src/domain/types`; helper date da `src/domain/week`; `mergeWeek` da `src/data/xlsxWorkbook` (per il mock del repository nei test).
- Produces:
  - `createDevRepository(): MenuRepository`
  - `Home({ repository?: MenuRepository })` — vista: titolo, riga dal/al con `<`/`>`, 7 card giorno con pranzo/cena; carica le righe al mount.
  - `Home.test.tsx` con helper `weekRows`, `seededStore`, `renderHome`.

- [ ] **Step 1: Scrivi i test che falliscono**

Create `src/pages/Home.test.tsx` (solo test vista; i test di modifica arrivano in Task 7):

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuRepository } from '../data/MenuRepository';
import { mergeWeek } from '../data/xlsxWorkbook';
import type { MenuRow, WeekMenu } from '../domain/types';
import { toIso, weekMenuFor, weekRangeLabel, weekStartForOffset } from '../domain/week';
import Home from './Home';

function weekRows(week: WeekMenu): MenuRow[] {
  return week.days.map(d => ({ weekStart: week.weekStart, ...d }));
}

function seededStore(rows: MenuRow[]): MenuRepository {
  const store: MenuRow[] = [...rows];
  return {
    loadWeeks: vi.fn(async () => [...store]),
    saveWeek: vi.fn(async (week: WeekMenu) => {
      const merged = mergeWeek(store, week);
      store.length = 0;
      store.push(...merged);
    }),
  };
}

async function renderHome(rows: MenuRow[] = []) {
  const repo = seededStore(rows);
  render(<Home repository={repo} />);
  await screen.findByText('Weekly Menu');
  return repo;
}

describe('Home view', () => {
  it('shows title, week range and 7 day cards', async () => {
    await renderHome();
    expect(screen.getByText('Weekly Menu')).toBeInTheDocument();
    expect(screen.getByTestId('week-range').textContent).toBe(weekRangeLabel(toIso(weekStartForOffset(0))));
    const week = weekMenuFor(toIso(weekStartForOffset(0)));
    for (const day of week.days) {
      expect(screen.getByText(day.dayName)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^lunch-\d$/)).toHaveLength(7);
    expect(screen.getAllByTestId(/^dinner-\d$/)).toHaveLength(7);
  });

  it('shows saved lunch/dinner for the current week', async () => {
    const week = weekMenuFor(toIso(weekStartForOffset(0)));
    week.days[0].lunch = 'Pasta al pomodoro';
    week.days[1].dinner = 'Frittata';
    await renderHome(weekRows(week));
    expect(screen.getByText(/Pasta al pomodoro/)).toBeInTheDocument();
    expect(screen.getByText(/Frittata/)).toBeInTheDocument();
  });

  it('navigates weeks with > and < showing exact ranges', async () => {
    await renderHome();
    fireEvent.click(screen.getByTestId('next-week'));
    expect(screen.getByTestId('week-range').textContent).toBe(weekRangeLabel(toIso(weekStartForOffset(1))));
    fireEvent.click(screen.getByTestId('prev-week'));
    fireEvent.click(screen.getByTestId('prev-week'));
    expect(screen.getByTestId('week-range').textContent).toBe(weekRangeLabel(toIso(weekStartForOffset(-1))));
  });

  it('shows empty state for weeks without data', async () => {
    await renderHome();
    fireEvent.click(screen.getByTestId('next-week'));
    expect(screen.getAllByText(/—/).length).toBeGreaterThanOrEqual(14);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm run test.unit -- --run src/pages/Home.test.tsx`
Expected: FAIL (Home non ha ancora testid/layout richiesti).

- [ ] **Step 3: Implementa Home (vista) e CSS**

Rewrite `src/pages/Home.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon,
  IonPage, IonTitle, IonToolbar,
} from '@ionic/react';
import { chevronBack, chevronForward } from 'ionicons/icons';
import { DevHttpFileGateway } from '../data/DevHttpFileGateway';
import type { MenuRepository } from '../data/MenuRepository';
import { XlsxMenuRepository } from '../data/MenuRepository';
import type { DayMenu, MenuRow } from '../domain/types';
import {
  parseIso, toDisplay, toIso, weekMenuFor, weekRangeLabel, weekStartForOffset,
} from '../domain/week';
import './Home.css';

export function createDevRepository(): MenuRepository {
  return new XlsxMenuRepository(new DevHttpFileGateway());
}

interface HomeProps {
  repository?: MenuRepository;
}

const EMPTY_TEXT = '—';

const Home: React.FC<HomeProps> = ({ repository }) => {
  const repo = useMemo(() => repository ?? createDevRepository(), [repository]);
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await repo.loadWeeks());
    } catch {
      setToast('Impossibile caricare il menù');
    }
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const weekStartIso = toIso(weekStartForOffset(weekOffset));
  const week = weekMenuFor(weekStartIso);

  const mealFor = (day: DayMenu, field: 'lunch' | 'dinner') =>
    rows.find(r => r.date === day.date)?.[field] ?? '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Weekly Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="week-nav">
          <IonButton fill="outline" data-testid="prev-week" onClick={() => setWeekOffset(w => w - 1)}>
            <IonIcon icon={chevronBack} />
          </IonButton>
          <div className="week-nav__label" data-testid="week-range">
            {weekRangeLabel(weekStartIso)}
          </div>
          <IonButton fill="outline" data-testid="next-week" onClick={() => setWeekOffset(w => w + 1)}>
            <IonIcon icon={chevronForward} />
          </IonButton>
        </div>

        <div className="day-list">
          {week.days.map((day, i) => (
            <IonCard key={day.date}>
              <IonCardContent>
                <div className="day-head">
                  <strong>{day.dayName}</strong>
                  <span data-testid={`day-date-${i}`}>{toDisplay(parseIso(day.date))}</span>
                </div>
                <div className="meal" data-testid={`lunch-${i}`}>
                  Pranzo: {mealFor(day, 'lunch') || EMPTY_TEXT}
                </div>
                <div className="meal" data-testid={`dinner-${i}`}>
                  Cena: {mealFor(day, 'dinner') || EMPTY_TEXT}
                </div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        {toast && <div className="toast" data-testid="toast">{toast}</div>}
      </IonContent>
    </IonPage>
  );
};

export default Home;
```

Rewrite `src/pages/Home.css` (era vuoto):

```css
.week-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
}

.week-nav__label {
  font-weight: 600;
  text-align: center;
}

.day-list {
  padding: 0 12px 12px;
}

.day-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.meal {
  padding: 4px 0;
  white-space: pre-wrap;
}

.meal-label {
  display: block;
  margin-top: 6px;
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.meal-input {
  width: 100%;
  min-height: 48px;
  border: 1px solid var(--ion-color-medium);
  border-radius: 8px;
  padding: 8px;
  font: inherit;
}

.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ion-color-dark);
  color: var(--ion-color-light);
  padding: 10px 16px;
  border-radius: 8px;
  z-index: 10;
}
```

Delete `src/components/ExploreContainer.tsx` and `src/components/ExploreContainer.css` (non più usati).

- [ ] **Step 4: Verifica che passino**

Run: `npm run test.unit -- --run src/pages/Home.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.css src/pages/Home.test.tsx
git add -A src/components
git commit -m "feat: weekly menu view mode"
```

---

### Task 7: UI — modalità inserimento

**Files:**
- Modify: `src/pages/Home.tsx`, `src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `WeekMenu`, `DayMenu` da `src/domain/types`; `dateForDay`, `previousYearWeekStart` da `src/domain/week`; icone `pencil`, `close`, `checkmark` da `ionicons/icons`; `IonFab`, `IonFabButton` da `@ionic/react`.
- Produces: `Home` con stato `mode: 'view' | 'edit'` e `draft: WeekMenu | null`; testid `edit-pencil`, `edit-save`, `edit-cancel`.

- [ ] **Step 1: Aggiungi i test di modifica che falliscono**

Add to `src/pages/Home.test.tsx` (aggiungi `previousYearWeekStart` all'import esistente da `'../domain/week'` e `userEvent` come nuovo import):

```tsx
import userEvent from '@testing-library/user-event';

const curStart = toIso(weekStartForOffset(0));
const prevStart = previousYearWeekStart(curStart);

function rowsWithPrev(): MenuRow[] {
  const prev = weekMenuFor(prevStart);
  prev.days[0].lunch = 'Minestra di ceci';
  prev.days[0].dinner = 'Tortino';
  prev.days[1].lunch = 'Risotto ai funghi';
  return weekRows(prev);
}

describe('Home edit', () => {
  it('enters edit mode prefilling from 52 weeks before', async () => {
    await renderHome(rowsWithPrev());
    fireEvent.click(screen.getByTestId('edit-pencil'));
    expect(screen.getByTestId('edit-pencil')).toBeInTheDocument();
    const lunch0 = screen.getByTestId('lunch-0');
    expect(lunch0.tagName).toBe('TEXTAREA');
    expect((lunch0 as HTMLTextAreaElement).value).toBe('Minestra di ceci');
    expect((screen.getByTestId('dinner-0') as HTMLTextAreaElement).value).toBe('Tortino');
    expect(screen.getByTestId('edit-save')).toBeInTheDocument();
    expect(screen.getByTestId('edit-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('day-date-0').textContent).not.toBe('');
  });

  it('save writes the draft and shows it in view', async () => {
    const repo = await renderHome([]);
    fireEvent.click(screen.getByTestId('edit-pencil'));
    await userEvent.type(screen.getByTestId('lunch-0'), 'Pasta e patate');
    fireEvent.click(screen.getByTestId('edit-save'));
    expect(vi.mocked(repo.saveWeek)).toHaveBeenCalledTimes(1);
    const draft = vi.mocked(repo.saveWeek).mock.calls[0][0] as WeekMenu;
    expect(draft.days[0].lunch).toBe('Pasta e patate');
    expect(await screen.findByText(/Pasta e patate/)).toBeInTheDocument();
  });

  it('cancel discards the draft without saving', async () => {
    const repo = await renderHome([]);
    fireEvent.click(screen.getByTestId('edit-pencil'));
    await userEvent.type(screen.getByTestId('lunch-0'), 'Da buttare');
    fireEvent.click(screen.getByTestId('edit-cancel'));
    expect(repo.saveWeek).not.toHaveBeenCalled();
    expect(screen.queryByTestId('edit-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lunch-0')?.tagName).not.toBe('TEXTAREA');
  });

  it('second pencil press while editing is ignored', async () => {
    await renderHome([]);
    fireEvent.click(screen.getByTestId('edit-pencil'));
    fireEvent.click(screen.getByTestId('edit-pencil'));
    expect(screen.getAllByTestId('edit-save')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verifica che falliscano**

Run: `npm run test.unit -- --run src/pages/Home.test.tsx`
Expected: FAIL (testid `edit-pencil` non esiste).

- [ ] **Step 3: Implementa la modalità inserimento**

Replace `src/pages/Home.tsx` with the full version (vista + inserimento):

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonFab, IonFabButton,
  IonHeader, IonIcon, IonPage, IonTitle, IonToolbar,
} from '@ionic/react';
import { checkmark, chevronBack, chevronForward, close, pencil } from 'ionicons/icons';
import { DevHttpFileGateway } from '../data/DevHttpFileGateway';
import type { MenuRepository } from '../data/MenuRepository';
import { XlsxMenuRepository } from '../data/MenuRepository';
import type { DayMenu, MenuRow, WeekMenu } from '../domain/types';
import {
  dateForDay, parseIso, previousYearWeekStart, toDisplay, toIso,
  weekMenuFor, weekRangeLabel, weekStartForOffset,
} from '../domain/week';
import './Home.css';

export function createDevRepository(): MenuRepository {
  return new XlsxMenuRepository(new DevHttpFileGateway());
}

interface HomeProps {
  repository?: MenuRepository;
}

const EMPTY_TEXT = '—';

const Home: React.FC<HomeProps> = ({ repository }) => {
  const repo = useMemo(() => repository ?? createDevRepository(), [repository]);
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [draft, setDraft] = useState<WeekMenu | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await repo.loadWeeks());
    } catch {
      setToast('Impossibile caricare il menù');
    }
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const weekStartIso = toIso(weekStartForOffset(weekOffset));
  const week = weekMenuFor(weekStartIso);
  const display = draft ?? week;

  const mealFor = (day: DayMenu, field: 'lunch' | 'dinner') =>
    rows.find(r => r.date === day.date)?.[field] ?? '';

  const handleEdit = () => {
    if (mode === 'edit') {
      return;
    }
    const prevStart = previousYearWeekStart(weekStartIso);
    const prev = rows.filter(r => r.weekStart === prevStart);
    const nextDraft = weekMenuFor(weekStartIso);
    nextDraft.days = nextDraft.days.map((day, i) => {
      const source = prev.find(r => r.date === dateForDay(prevStart, i));
      return source ? { ...day, lunch: source.lunch, dinner: source.dinner } : day;
    });
    setDraft(nextDraft);
    setMode('edit');
  };

  const updateDraft = (dayIndex: number, field: 'lunch' | 'dinner', value: string) => {
    setDraft(prev => {
      if (!prev) return prev;
      const days = prev.days.map((day, i) =>
        i === dayIndex ? { ...day, [field]: value } : day,
      );
      return { ...prev, days };
    });
  };

  const handleCancel = () => {
    setDraft(null);
    setMode('view');
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      await repo.saveWeek(draft);
      await load();
      setMode('view');
      setDraft(null);
      setToast('Menù salvato');
    } catch {
      setToast('Errore nel salvataggio');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Weekly Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="week-nav">
          <IonButton fill="outline" data-testid="prev-week" onClick={() => setWeekOffset(w => w - 1)}>
            <IonIcon icon={chevronBack} />
          </IonButton>
          <div className="week-nav__label" data-testid="week-range">
            {weekRangeLabel(weekStartIso)}
          </div>
          <IonButton fill="outline" data-testid="next-week" onClick={() => setWeekOffset(w => w + 1)}>
            <IonIcon icon={chevronForward} />
          </IonButton>
        </div>

        <div className="day-list">
          {display.days.map((day, i) => (
            <IonCard key={day.date}>
              <IonCardContent>
                <div className="day-head">
                  <strong>{day.dayName}</strong>
                  <span data-testid={`day-date-${i}`}>{toDisplay(parseIso(day.date))}</span>
                </div>
                {mode === 'edit' ? (
                  <>
                    <label className="meal-label" htmlFor={`lunch-${i}`}>Pranzo</label>
                    <textarea
                      id={`lunch-${i}`}
                      data-testid={`lunch-${i}`}
                      className="meal-input"
                      rows={2}
                      value={draft?.days[i].lunch ?? ''}
                      onChange={e => updateDraft(i, 'lunch', e.target.value)}
                    />
                    <label className="meal-label" htmlFor={`dinner-${i}`}>Cena</label>
                    <textarea
                      id={`dinner-${i}`}
                      data-testid={`dinner-${i}`}
                      className="meal-input"
                      rows={2}
                      value={draft?.days[i].dinner ?? ''}
                      onChange={e => updateDraft(i, 'dinner', e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <div className="meal" data-testid={`lunch-${i}`}>
                      Pranzo: {mealFor(day, 'lunch') || EMPTY_TEXT}
                    </div>
                    <div className="meal" data-testid={`dinner-${i}`}>
                      Cena: {mealFor(day, 'dinner') || EMPTY_TEXT}
                    </div>
                  </>
                )}
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        {mode === 'edit' ? (
          <IonFab slot="fixed" vertical="bottom" horizontal="end">
            <IonFabButton data-testid="edit-cancel" onClick={handleCancel}>
              <IonIcon icon={close} />
            </IonFabButton>
            <IonFabButton data-testid="edit-save" onClick={() => void handleSave()}>
              <IonIcon icon={checkmark} />
            </IonFabButton>
          </IonFab>
        ) : (
          <IonFab slot="fixed" vertical="bottom" horizontal="end">
            <IonFabButton data-testid="edit-pencil" onClick={handleEdit}>
              <IonIcon icon={pencil} />
            </IonFabButton>
          </IonFab>
        )}

        {toast && <div className="toast" data-testid="toast">{toast}</div>}
      </IonContent>
    </IonPage>
  );
};

export default Home;
```

- [ ] **Step 4: Verifica che passino**

Run: `npm run test.unit -- --run src/pages/Home.test.tsx`
Expected: PASS (test vista + test modifica).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.test.tsx
git commit -m "feat: weekly menu edit mode with 52-weeks prefill"
```

---

### Task 8: Wiring e verifica completa (stretch: e2e)

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Optional: `cypress/e2e/test.cy.ts`

**Interfaces:**
- Consumes: `viteDevFilePlugin` da `src/data/viteDevFilePlugin`.
- Produces: dev server con `/api/menu` attivo; `npm run dev` funzionante con salvataggio reale su `dati/menu.xlsx`.

- [ ] **Step 1: Registra il plugin Vite**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteDevFilePlugin } from './src/data/viteDevFilePlugin'

export default defineConfig({
  plugins: [
    react(),
    legacy(),
    viteDevFilePlugin()
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
```

- [ ] **Step 2: Aggiorna il titolo della pagina**

In `index.html` cambiare `<title>Ionic App</title>` in `<title>Weekly Menu</title>`.

- [ ] **Step 3: Verifica completa**

Run: `npm run test.unit -- --run`
Expected: tutti i test passano (week, xlsxWorkbook, MenuRepository, devHttp, Home).

Run: `npm run build`
Expected: `tsc` e `vite build` senza errori.

Run: `npm run lint`
Expected: nessun errore (i warnings `react-refresh/only-export-components` per gli Export non-component su `Home.tsx` possono essere ignorati o soppressi con `// eslint-disable-next-line` se bloccano).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts index.html
git commit -m "chore: wire dev file plugin and app title"
```

- [ ] **Step 5 (opzionale): smoke e2e**

Se si vuole un test end-to-end Cypress (richiede `npm run dev` attivo su porta 5173 e scrive sul vero `dati/menu.xlsx`), sostituire `cypress/e2e/test.cy.ts` con:

```ts
describe('Weekly Menu', () => {
  it('opens, edits and saves the current week', () => {
    cy.visit('/');
    cy.contains('Weekly Menu').should('be.visible');
    cy.get('[data-testid="edit-pencil"]').click();
    cy.get('[data-testid="lunch-0"]').type('Pasta e ceci');
    cy.get('[data-testid="edit-save"]').click();
    cy.contains('Pasta e ceci').should('be.visible');
  });
});
```

Run (con il dev server attivo): `npm run test.e2e`
Avviso: questo test scrive dati reali in `dati/menu.xlsx`.

Commit eventuale:

```bash
git add cypress/e2e/test.cy.ts
git commit -m "test: e2e smoke for weekly menu"
```

---

## Verification (manuale finale consigliata)

1. `npm run dev` e aprire l'app nel browser.
2. Verificare: titolo, riga "dal … al …", 7 card con pranzo/cena, scorrimento `<`/`>`, matita, prefill 52 settimane, salva/annulla.
3. Controllare che `dati/menu.xlsx` sia stato creato e contenga le righe salvate.
4. Riaprire l'app: i dati devono essere ancora visibili.
# Menù hamburger: lista spesa, stampa, esporta DB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere all'app un menù a hamburger (ion-menu) con tre voci — crea/richiama la lista della spesa per settimana, stampa il menù settimanale, esporta tutto il DB — con il web come target immediato e un'astrazione per i plugin nativi futuri.

**Architecture:** File di testo (nota menù + lista) via dominio puro (`menuNote`), un nuovo `TextFileGateway` HTTP verso il middleware dev esteso (`/api/lista?week=`), esportazione DB con picker/`<a download>`, e due nuove pagine (`/lista/:week`, `/stampa/:week`) dietro lo stesso pattern `repository?` iniettato usato da Home.

**Tech Stack:** Ionic React 9, React 19, Vite, vitest + jsdom + Testing Library, xlsx (esistente). Nessuna nuova dipendenza.

**Spec:** `docs/superpowers/specs/2026-10-02-export-list-menu-design.md`

## Global Constraints

- Nessuna nuova dipendenza runtime o dev.
- Dati: date ISO UTC `yyyy-mm-dd`; settimana = lunedì→domenica (lunedì = inizio settimana ISO).
- Helper dominio da `src/domain/week.ts` (non modificarli): `toIso(date: Date): string`, `parseIso(iso: string): Date`, `toDisplay(date: Date): string`, `weekRangeLabel(weekStartIso: string): string`.
- UI in italiano; testo voci menù esatto da spec:
  - "Crea lista della spesa" (icona `cart`)
  - "Esporta in PDF il menù settimanale selezionato" (icona `print`)
  - "Esporta tutto il DB" (icona `download`)
- File lista salvato come `dati/lista_<week-ISO>.txt` (UTF-8); marcatore `LISTA DELLA SPESA`.
- Nessuna modifica ai file `src/domain/week.ts`, `src/domain/types.ts`, `src/data/xlsxWorkbook.ts` (tranne gli import aggiunti nei test).
- TDD: il test scrive prima dell'implementazione e fallisce prima di passare.

## Review Focus

Questi sono i modi di fallimento che la spec implica ma nessun test di singolo task coprirebbe da solo; ogni riga ha il proprio test nel task che possiede il codice:

- Chiave settimana non valida/non-lunedì nella rotta lista → risposta 400, non 500. (Task 2)
- File lista assente → `readText` restituisce `null` e la pagina mostra il toast informativo senza crash. (Task 3 + Task 6)
- Utente annulla la finestra "Salva con nome" → risultato `'cancelled'`, nessuna scrittura e nessuna eccezione. (Task 5)
- Lista senza elementi (solo nota) → il file contiene il marcatore e il parse restituisce `[]`. (Task 1 + Task 6)
- Settimana senza righe salvate → nota e stampa rendono comunque intestazione/range senza crash. (Task 1 + Task 7)

---

### Task 1: Nota menù + composizione/parsing file lista (dominio)

**Files:**
- Create: `src/domain/menuNote.ts`
- Create: `src/domain/menuNote.test.ts`

**Interfaces:**
- Produces (usate da Task 2, 3, 6):
  - `export const LIST_MARKER: string` — `'LISTA DELLA SPESA'`
  - `export function menuNote(weekStart: string, rows: MenuRow[]): string`
  - `export function composeListFile(note: string, items: string[]): string`
  - `export function parseListFile(content: string): { items: string[] }`
  - Consumes: `weekRangeLabel`, `toDisplay`, `parseIso` da `./week`; `MenuRow` da `./types`.

- [ ] **Step 1: Write the failing test**

`src/domain/menuNote.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test.unit -- --run src/domain/menuNote.test.ts`
Expected: FAIL — `Cannot find module './menuNote'`.

- [ ] **Step 3: Write minimal implementation**

`src/domain/menuNote.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test.unit -- --run src/domain/menuNote.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/menuNote.ts src/domain/menuNote.test.ts
git commit -m "feat: nota menù e composizione/parsing lista spesa (dominio)"
```

---

### Task 2: Middleware dev — endpoint testo `/api/lista?week=`

**Files:**
- Modify: `src/data/viteDevFilePlugin.ts`
- Modify: `vite.config.ts`
- Modify: `src/data/devHttp.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: (nessuno dai task precedenti; `emptyWorkbook` da `./xlsxWorkbook` già importato)
- Produces (usata da Task 3 e dal dev server):
  - `export function createFileMiddleware(menuFilePath: string, listsDir: string): FileMiddleware` — stessa firma mentale, due parametri.
  - Rotte: `GET|POST /api/menu` (invariate, binario); `GET /api/lista?week=<key>` (testo, 404 se assente); `PUT /api/lista?week=<key>` (scrive `<listsDir>/lista_<key>.txt`); key deve essere un lunedì ISO valido (`/^\d{4}-\d{2}-\d{2}$/` + data valida + `getUTCDay()===1`) altrimenti 400.

- [ ] **Step 1: Write the failing tests**

Aggiornare `src/data/devHttp.test.ts`:

- Cambiare `start()` per restituire `listsDir` e passare due argomenti al middleware:

```ts
async function start(): Promise<{ port: number; file: string; listsDir: string }> {
  const dir = mkdtempSync(path.join(tmpdir(), 'wm-'));
  dirs.push(dir);
  const file = path.join(dir, 'menu.xlsx');
  const handler = createFileMiddleware(file, dir) as unknown as RequestListener;
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  return { port, file, listsDir: dir };
}
```

- Aggiungere nel describe, dopo i test esistenti:

```ts
describe('text list endpoint', () => {
  it('returns 404 for a missing list', async () => {
    const { port } = await start();
    const res = await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`);
    expect(res.status).toBe(404);
  });

  it('saves and reads back a list for a given week', async () => {
    const { port } = await start();
    const put = await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Menù della settimana: x\n\nLISTA DELLA SPESA\n- farina',
    });
    expect(put.ok).toBe(true);
    const get = await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`);
    expect(get.status).toBe(200);
    expect(await get.text()).toContain('- farina');
  });

  it('keeps lists of different weeks separate', async () => {
    const { port } = await start();
    await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`, { method: 'PUT', body: 'settimana A' });
    await fetch(`http://localhost:${port}/api/lista?week=2026-09-28`, { method: 'PUT', body: 'settimana B' });
    const a = await (await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`)).text();
    const b = await (await fetch(`http://localhost:${port}/api/lista?week=2026-09-28`)).text();
    expect(a).toBe('settimana A');
    expect(b).toBe('settimana B');
  });

  it('rejects invalid or non-Monday week keys with 400', async () => {
    const { port } = await start();
    for (const bad of ['abc', '2026-02-30', '2026-09-20', '2026-09-21T00:00:00', '']) {
      const res = await fetch(`http://localhost:${port}/api/lista?week=${encodeURIComponent(bad)}`);
      expect(res.status).toBe(400);
    }
  });

  it('still serves the menu endpoints', async () => {
    const { port } = await start();
    const res = await fetch(`http://localhost:${port}/api/menu`);
    expect(res.ok).toBe(true);
  });
});
```

In `.gitignore`, sotto `# app data`, aggiungere una riga:

```gitignore
/dati/*.txt
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit -- --run src/data/devHttp.test.ts`
Expected: FAIL — i nuovi test 404/roundtrip falliscono (404 per tutti, 400 non rispetta, PUT ignored), e i test esistenti falliscono con errore TS (firma `createFileMiddleware` a 1 parametro).

- [ ] **Step 3: Write minimal implementation**

`src/data/viteDevFilePlugin.ts` diventa:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { emptyWorkbook } from './xlsxWorkbook';

export type FileMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;

function isMondayIso(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(ms);
  if (date.toISOString().slice(0, 10) !== value) {
    return false;
  }
  return date.getUTCDay() === 1;
}

function sendText(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

export function createFileMiddleware(menuFilePath: string, listsDir: string): FileMiddleware {
  return (req, res, next) => {
    const parsed = new URL(req.url ?? '', 'http://localhost');
    const pathname = parsed.pathname;

    if (pathname === '/api/menu') {
      if (req.method === 'GET') {
        if (!existsSync(menuFilePath)) {
          writeFileSync(menuFilePath, Buffer.from(emptyWorkbook()));
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.end(readFileSync(menuFilePath));
        return;
      }
      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          writeFileSync(menuFilePath, Buffer.concat(chunks));
          sendText(res, 200, 'ok');
        });
        return;
      }
      next();
      return;
    }

    if (pathname === '/api/lista') {
      const week = parsed.searchParams.get('week') ?? '';
      if (!isMondayIso(week)) {
        sendText(res, 400, 'invalid week');
        return;
      }
      const filePath = path.join(listsDir, `lista_${week}.txt`);
      if (req.method === 'GET') {
        if (!existsSync(filePath)) {
          sendText(res, 404, 'not found');
          return;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(filePath));
        return;
      }
      if (req.method === 'PUT') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          writeFileSync(filePath, Buffer.concat(chunks));
          sendText(res, 200, 'ok');
        });
        return;
      }
      next();
      return;
    }

    next();
  };
}
```

In `vite.config.ts`, modificare `weeklyMenuDati`:

```ts
const weeklyMenuDati = (): Plugin => ({
  name: 'weeklymenu-dati',
  configureServer(server) {
    const dataDir = path.resolve(process.cwd(), 'dati')
    const filePath = path.join(dataDir, 'menu.xlsx')
    server.middlewares.use(createFileMiddleware(filePath, dataDir) as Connect.NextHandleFunction)
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit -- --run src/data/devHttp.test.ts`
Expected: PASS (8 test esistenti + 5 nuovi).

- [ ] **Step 5: Commit**

```bash
git add src/data/viteDevFilePlugin.ts vite.config.ts src/data/devHttp.test.ts .gitignore
git commit -m "feat: endpoint testo /api/lista per-settimana nel middleware dev"
```

---

### Task 3: TextFileGateway + DevHttpTextGateway

**Files:**
- Create: `src/data/TextFileGateway.ts`
- Create: `src/data/DevHttpTextGateway.ts`
- Create: `src/data/devHttpText.test.ts`

**Interfaces:**
- Consumes: niente dai task precedenti.
- Produces (usata da Task 6):
  - `export interface TextFileGateway { readText(key: string): Promise<string | null>; writeText(key: string, content: string): Promise<void>; }`
  - `export class DevHttpTextGateway implements TextFileGateway { constructor(baseUrl?: string) }`

- [ ] **Step 1: Write the failing tests**

`src/data/devHttpText.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFileMiddleware } from './viteDevFilePlugin';

describe('DevHttpTextGateway', () => {
  const servers: ReturnType<typeof createServer>[] = [];
  const dirs: string[] = [];
  let port = 0;

  afterEach(() => {
    for (const s of servers.splice(0)) s.close();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  async function start(): Promise<number> {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-text-'));
    dirs.push(dir);
    const file = path.join(dir, 'menu.xlsx');
    const handler = createFileMiddleware(file, dir) as unknown as RequestListener;
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    return (server.address() as AddressInfo).port;
  }

  it('returns null for a key that has no file', async () => {
    const { DevHttpTextGateway } = await import('./DevHttpTextGateway');
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    expect(await gw.readText('2026-09-21')).toBeNull();
  });

  it('reads back what it wrote', async () => {
    const { DevHttpTextGateway } = await import('./DevHttpTextGateway');
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    expect(await gw.readText('2026-09-21')).toBeNull();
    await gw.writeText('2026-09-21', 'contenuto lista');
    expect(await gw.readText('2026-09-21')).toBe('contenuto lista');
  });

  it('rejects on server errors (invalid key)', async () => {
    const { DevHttpTextGateway } = await import('./DevHttpTextGateway');
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    await expect(gw.writeText('2026-02-30', 'x')).rejects.toThrow();
  });
});
```

**Attenzione:** per i test qui NON usare `import ... from './DevHttpTextGateway'` in cima perché il modulo non esiste ancora (il test deve fallire per il giusto motivo). Al primo `- [ ] Step 1` il file `DevHttpTextGateway.ts` non esiste, quindi l'import statico in cima farebbe fallire il file al *parse*, non al test. Va bene comunque se il Task si apre con `import { DevHttpTextGateway } from './DevHttpTextGateway';` in cima: il fallimento "cannot resolve module" è il fail legittimo. Per semplicità usa l'import statico in cima (senza gli `await import` dinamici dell'esempio sopra), e al **Step 3** crea sia `TextFileGateway.ts` sia `DevHttpTextGateway.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit -- --run src/data/devHttpText.test.ts`
Expected: FAIL — module `./DevHttpTextGateway` non risolvibile.

- [ ] **Step 3: Write minimal implementation**

`src/data/TextFileGateway.ts`:

```ts
export interface TextFileGateway {
  readText(key: string): Promise<string | null>;
  writeText(key: string, content: string): Promise<void>;
}
```

`src/data/DevHttpTextGateway.ts`:

```ts
import type { TextFileGateway } from './TextFileGateway';

export class DevHttpTextGateway implements TextFileGateway {
  constructor(private readonly baseUrl: string = '') {}

  async readText(key: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/api/lista?week=${encodeURIComponent(key)}`);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Failed to read list: ${res.status}`);
    }
    return res.text();
  }

  async writeText(key: string, content: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/lista?week=${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: content,
    });
    if (!res.ok) {
      throw new Error(`Failed to write list: ${res.status}`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit -- --run src/data/devHttpText.test.ts`
Expected: PASS (3 test). Poi esegui l'intera suite data per assicurare che non via siano regressioni: `npm run test.unit -- --run src/data/devHttp.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/data/TextFileGateway.ts src/data/DevHttpTextGateway.ts src/data/devHttpText.test.ts
git commit -m "feat: gateway testuale per la lista della spesa (dev HTTP)"
```

---

### Task 4: `MenuRepository.exportWorkbook()`

**Files:**
- Modify: `src/data/MenuRepository.ts`
- Modify: `src/data/MenuRepository.test.ts`
- Modify: `src/pages/Home.test.tsx` (mock `seededStore` deve implementare la nuova firma del tipo)

**Interfaces:**
- Produces (usata da Task 8):
  - `export interface MenuRepository { loadWeeks(): Promise<MenuRow[]>; saveWeek(week: WeekMenu): Promise<void>; exportWorkbook(): Promise<ArrayBuffer>; }`
  - `XlsxMenuRepository.exportWorkbook()` → bytes del gateway; se `read()` è `null` ritorna `emptyWorkbook()`.
  - Consumes: `emptyWorkbook` da `./xlsxWorkbook` (import necessario in MenuRepository.ts).

- [ ] **Step 1: Write the failing test**

Aggiungere a `src/data/MenuRepository.test.ts` (aggiungere `parseWorkbook` all'import da `./xlsxWorkbook`):

```ts
import { emptyWorkbook, parseWorkbook } from './xlsxWorkbook';
```

e i test:

```ts
it('exportWorkbook returns the whole stored workbook', async () => {
  const repo = new XlsxMenuRepository(new InMemoryFileGateway());
  await repo.saveWeek(weekA);
  const bytes = await repo.exportWorkbook();
  expect(parseWorkbook(bytes)).toHaveLength(7);
});

it('exportWorkbook falls back to a header-only workbook when empty', async () => {
  const repo = new XlsxMenuRepository(new InMemoryFileGateway());
  const bytes = await repo.exportWorkbook();
  expect(parseWorkbook(bytes)).toEqual([]);
});
```

Anche in `src/pages/Home.test.tsx`, dentro `seededStore`, aggiungere la nuova voce (altrimenti il tipo `MenuRepository` non compila):

```ts
return {
  loadWeeks: vi.fn(async () => [...store]),
  saveWeek: vi.fn(async (week: WeekMenu) => {
    const merged = mergeWeek(store, week);
    store.length = 0;
    store.push(...merged);
  }),
  exportWorkbook: vi.fn(async () => new ArrayBuffer(0)),
};
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit -- --run src/data/MenuRepository.test.ts`
Expected: FAIL — `exportWorkbook` non esiste sull'interfaccia/implementazione (errore TS: "Property 'exportWorkbook' does not exist").

- [ ] **Step 3: Write minimal implementation**

In `src/data/MenuRepository.ts`:

```ts
import type { MenuRow, WeekMenu } from '../domain/types';
import type { FileGateway } from './FileGateway';
import { emptyWorkbook, mergeWeek, parseWorkbook, serializeWorkbook } from './xlsxWorkbook';

export interface MenuRepository {
  loadWeeks(): Promise<MenuRow[]>;
  saveWeek(week: WeekMenu): Promise<void>;
  exportWorkbook(): Promise<ArrayBuffer>;
}
```

E nell'implementazione `XlsxMenuRepository`:

```ts
async exportWorkbook(): Promise<ArrayBuffer> {
  const buffer = await this.gateway.read();
  return buffer ?? emptyWorkbook();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit -- --run src/data/MenuRepository.test.ts`
Expected: PASS (7 test). Poi: `npm run test.unit -- --run src/pages/Home.test.tsx` PASS (compila il nuovo tipo nel mock).

- [ ] **Step 5: Commit**

```bash
git add src/data/MenuRepository.ts src/data/MenuRepository.test.ts src/pages/Home.test.tsx
git commit -m "feat: esportazione workbook completo dal repository"
```

---

### Task 5: `saveWorkbookToDisk` (picker o download)

**Files:**
- Create: `src/data/exportWorkbook.ts`
- Create: `src/data/exportWorkbook.test.ts`

**Interfaces:**
- Consumes: niente dai task precedenti (ArrayBuffer in input).
- Produces (usata da Task 8):
  - `export type SaveResult = 'saved' | 'cancelled';`
  - `export async function saveWorkbookToDisk(buffer: ArrayBuffer, filename: string): Promise<SaveResult>`

- [ ] **Step 1: Write the failing tests**

`src/data/exportWorkbook.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveWorkbookToDisk } from './exportWorkbook';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('saveWorkbookToDisk', () => {
  const buffer = new Uint8Array([1, 2, 3]).buffer as ArrayBuffer;

  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('downloads via anchor when no picker is available', async () => {
    const result = await saveWorkbookToDisk(buffer, 'file.xlsx');
    expect(result).toBe('saved');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe(XLSX_MIME);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('uses showSaveFilePicker when available and writes the bytes', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const createWritable = vi.fn(async () => ({ write, close }));
    const pick = vi.fn(async () => ({ createWritable }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: pick });

    const result = await saveWorkbookToDisk(buffer, 'file.xlsx');
    expect(result).toBe('saved');
    expect(pick).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'file.xlsx' }));
    expect(write).toHaveBeenCalledWith(buffer);
    expect(close).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('returns cancelled when the user aborts the picker', async () => {
    const pick = vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: pick });
    await expect(saveWorkbookToDisk(buffer, 'file.xlsx')).resolves.toBe('cancelled');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit -- --run src/data/exportWorkbook.test.ts`
Expected: FAIL — `Cannot find module './exportWorkbook'`.

- [ ] **Step 3: Write minimal implementation**

`src/data/exportWorkbook.ts`:

```ts
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type SaveResult = 'saved' | 'cancelled';

interface FileWritable {
  write(data: BufferSource): Promise<void>;
  close(): Promise<void>;
}

interface FilePickHandle {
  createWritable(): Promise<FileWritable>;
}

type ShowSaveFilePicker = (options: unknown) => Promise<FilePickHandle>;

function nativePicker(win: Window): ShowSaveFilePicker | undefined {
  const maybe = win as unknown as { showSaveFilePicker?: unknown };
  return typeof maybe.showSaveFilePicker === 'function'
    ? (maybe.showSaveFilePicker as ShowSaveFilePicker)
    : undefined;
}

export async function saveWorkbookToDisk(buffer: ArrayBuffer, filename: string): Promise<SaveResult> {
  const picker = nativePicker(window);
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'Excel', accept: { [XLSX_MIME]: ['.xlsx'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
      throw err;
    }
  }

  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return 'saved';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit -- --run src/data/exportWorkbook.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/data/exportWorkbook.ts src/data/exportWorkbook.test.ts
git commit -m "feat: salvataggio xlsx su dispositivo (picker o download)"
```

---

### Task 6: Pagina Lista della spesa

**Files:**
- Create: `src/pages/ShoppingList.tsx`
- Create: `src/pages/ShoppingList.css`
- Create: `src/pages/ShoppingList.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `menuNote`, `composeListFile`, `parseListFile`, `LIST_MARKER` da `../domain/menuNote`; `weekRangeLabel` da `../domain/week`; `TextFileGateway`, `DevHttpTextGateway`, `MenuRepository`, `XlsxMenuRepository`, `DevHttpFileGateway`.
- Produces (usata da App):
  - `export const ShoppingListRoute: React.FC` — legge `:week` da router e rende `<ShoppingList week={week} />`.
  - `ShoppingList` props: `{ week: string; repository?: MenuRepository; textGateway?: TextFileGateway }`.

- [ ] **Step 1: Write the failing tests**

`src/pages/ShoppingList.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MenuRepository } from '../data/MenuRepository';
import type { TextFileGateway } from '../data/TextFileGateway';
import { LIST_MARKER } from '../domain/menuNote';
import type { MenuRow } from '../domain/types';
import ShoppingList from './ShoppingList';

const week = '2026-09-21';
const rows: MenuRow[] = [
  { weekStart: week, dayName: 'Lunedì', date: '2026-09-21', lunch: 'Pasta', dinner: 'Pizza' },
  { weekStart: week, dayName: 'Martedì', date: '2026-09-22', lunch: 'Riso', dinner: '' },
];

function fakeRepo(): MenuRepository {
  return {
    loadWeeks: vi.fn(async () => rows),
    saveWeek: vi.fn(),
    exportWorkbook: vi.fn(),
  };
}

function fakeList(initial: string | null = null): TextFileGateway & { lastContent: () => string | null } {
  let content: string | null = initial;
  return {
    readText: vi.fn(async () => content),
    writeText: vi.fn(async (_key: string, text: string) => {
      content = text;
    }),
    lastContent: () => content,
  };
}

async function renderList(initial: string | null = null) {
  const repo = fakeRepo();
  const lists = fakeList(initial);
  render(<ShoppingList week={week} repository={repo} textGateway={lists} />);
  await screen.findByText('Lista della spesa');
  return { repo, lists };
}

describe('ShoppingList', () => {
  it('shows the week range and the menu note', async () => {
    await renderList();
    expect(screen.getByTestId('list-week').textContent).toBe('dal 21/09/2026 al 27/09/2026');
    const note = screen.getByTestId('list-note').textContent ?? '';
    expect(note).toContain('Lunedì 21/09/2026 — Pranzo: Pasta — Cena: Pizza');
    expect(note).toContain('Martedì 22/09/2026 — Pranzo: Riso — Cena: —');
  });

  it('saves the menu plus the typed items to the gateway', async () => {
    const { lists } = await renderList();
    await userEvent.type(screen.getByTestId('shopping-items'), 'farina\nuova\n');
    fireEvent.click(screen.getByTestId('list-save'));
    await waitFor(() => expect(lists.writeText).toHaveBeenCalledTimes(1));
    const content = vi.mocked(lists.writeText).mock.calls[0][1] as string;
    expect(content).toContain(LIST_MARKER);
    expect(content).toContain('- farina');
    expect(screen.getByTestId('toast')).toHaveTextContent('Lista salvata');
  });

  it('prefills the textarea from a saved list', async () => {
    const custom = fakeList(`nota\n\n${LIST_MARKER}\n- farina\n- uova 6`);
    render(<ShoppingList week={week} repository={fakeRepo()} textGateway={custom} />);
    await screen.findByText('Lista della spesa');
    const ta = screen.getByTestId('shopping-items') as HTMLTextAreaElement;
    expect(ta.value).toContain('farina');
    expect(ta.value).toContain('uova 6');
  });

  it('shows an info toast when no list exists for the week', async () => {
    await renderList(null);
    expect(screen.getByTestId('toast')).toHaveTextContent('Nessuna lista per questa settimana');
  });

  it('recalls a saved list on demand', async () => {
    const custom = fakeList(`nota\n\n${LIST_MARKER}\n- farina`);
    render(<ShoppingList week={week} repository={fakeRepo()} textGateway={custom} />);
    await screen.findByText('Lista della spesa');
    const ta = screen.getByTestId('shopping-items') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'da sovrascrivere' } });
    fireEvent.click(screen.getByTestId('list-reload'));
    await waitFor(() => expect(ta.value).toBe('farina'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit -- --run src/pages/ShoppingList.test.tsx`
Expected: FAIL — module `./ShoppingList` non esiste.

- [ ] **Step 3: Write minimal implementation**

`src/pages/ShoppingList.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage,
  IonTitle, IonToolbar,
} from '@ionic/react';
import { DevHttpFileGateway } from '../data/DevHttpFileGateway';
import { DevHttpTextGateway } from '../data/DevHttpTextGateway';
import { XlsxMenuRepository, type MenuRepository } from '../data/MenuRepository';
import type { TextFileGateway } from '../data/TextFileGateway';
import { composeListFile, menuNote, parseListFile } from '../domain/menuNote';
import type { MenuRow } from '../domain/types';
import { weekRangeLabel } from '../domain/week';
import './ShoppingList.css';

const TOAST_MS = 3000;

export interface ShoppingListProps {
  week: string;
  repository?: MenuRepository;
  textGateway?: TextFileGateway;
}

export const ShoppingListRoute: React.FC = () => {
  const params = useParams<{ week?: string }>();
  return <ShoppingList week={params.week ?? ''} />;
};

const ShoppingList: React.FC<ShoppingListProps> = ({ week, repository, textGateway }) => {
  const repo = useMemo(() => repository ?? new XlsxMenuRepository(new DevHttpFileGateway()), [repository]);
  const lists = useMemo(() => textGateway ?? new DevHttpTextGateway(), [textGateway]);
  const [note, setNote] = useState('');
  const [items, setItems] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows: MenuRow[] = await repo.loadWeeks();
      setNote(menuNote(week, rows));
    } catch {
      setToast('Impossibile caricare il menù');
    }
  }, [repo, week]);

  const loadList = useCallback(async () => {
    const content = await lists.readText(week);
    if (content === null) {
      setToast('Nessuna lista per questa settimana');
      return;
    }
    setItems(parseListFile(content).items.join('\n'));
  }, [lists, week]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSave = async () => {
    const parsed = items.split('\n').map(line => line.trim()).filter(Boolean);
    try {
      await lists.writeText(week, composeListFile(note, parsed));
      setToast('Lista salvata');
    } catch {
      setToast('Errore nel salvataggio della lista');
    }
  };

  const handleReload = async () => {
    try {
      await loadList();
    } catch {
      setToast('Errore nel caricamento della lista');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Lista della spesa</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <h2 className="list-week" data-testid="list-week">{weekRangeLabel(week)}</h2>
        <pre className="list-note" data-testid="list-note">{note}</pre>
        <label className="list-label" htmlFor="shopping-items">Lista della spesa</label>
        <textarea
          id="shopping-items"
          data-testid="shopping-items"
          className="list-editor"
          rows={8}
          placeholder="Una voce per riga"
          value={items}
          onChange={e => setItems(e.target.value)}
        />
        <div className="list-actions">
          <IonButton data-testid="list-save" onClick={() => void handleSave()}>Salva in Dati</IonButton>
          <IonButton fill="outline" data-testid="list-reload" onClick={() => void handleReload()}>Richiama</IonButton>
        </div>
        {toast && <div className="toast" data-testid="toast">{toast}</div>}
      </IonContent>
    </IonPage>
  );
};

export default ShoppingList;
```

`src/pages/ShoppingList.css`:

```css
.list-week {
  margin: 12px 16px 4px;
  font-size: 1.05rem;
}

.list-note {
  margin: 8px 16px 16px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
  white-space: pre-wrap;
  font-family: inherit;
}

.list-label {
  display: block;
  margin: 0 16px 4px;
  font-weight: 600;
}

.list-editor {
  width: calc(100% - 32px);
  margin: 0 16px;
  padding: 10px;
  border: 1px solid var(--ion-color-medium);
  border-radius: 8px;
  resize: vertical;
}

.list-actions {
  display: flex;
  gap: 12px;
  margin: 16px 16px 40px;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1000;
  background: var(--ion-color-dark);
  color: var(--ion-color-light);
  padding: 10px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
}
```

Modificare `src/App.tsx` — aggiungere import e rotte:

```tsx
import ShoppingList, { ShoppingListRoute } from './pages/ShoppingList';
```

```tsx
<IonRouterOutlet>
  <Route path="/home" element={<Home />} />
  <Route path="/lista/:week" element={<ShoppingListRoute />} />
  <Route path="/" element={<Navigate to="/home" replace />} />
</IonRouterOutlet>
```

**Nota:** se l'import di `ShoppingList` (default) non viene usato nel JSX, importalo come `import { ShoppingListRoute } from './pages/ShoppingList';` senza il default.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit -- --run src/pages/ShoppingList.test.tsx`
Expected: PASS (5 test). Poi `npm run test.unit -- --run src/App.test.tsx` (deve ancora passare) e, per sicurezza, l'intera suite: `npm run test.unit -- --run` (46+5 test).

- [ ] **Step 5: Commit**

```bash
git add src/pages/ShoppingList.tsx src/pages/ShoppingList.css src/pages/ShoppingList.test.tsx src/App.tsx
git commit -m "feat: pagina lista della spesa con salvataggio e richiamo in Dati"
```

---

### Task 7: Pagina Stampa (vista stampabile)

**Files:**
- Create: `src/pages/PrintMenu.tsx`
- Create: `src/pages/PrintMenu.css`
- Create: `src/pages/PrintMenu.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `MenuRepository`, `XlsxMenuRepository`, `DevHttpFileGateway`, `toDisplay`, `parseIso`, `weekRangeLabel` da `../domain/week`.
- Produces (usata da App):
  - `export const PrintMenuRoute: React.FC` — legge `:week` e rende `<PrintMenu week={week} />`.
  - `PrintMenu` props: `{ week: string; repository?: MenuRepository }`.

- [ ] **Step 1: Write the failing tests**

`src/pages/PrintMenu.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuRepository } from '../data/MenuRepository';
import type { MenuRow } from '../domain/types';
import PrintMenu from './PrintMenu';

const week = '2026-09-21';
const rows: MenuRow[] = [
  { weekStart: week, dayName: 'Lunedì', date: '2026-09-21', lunch: 'Pasta', dinner: 'Pizza' },
  { weekStart: week, dayName: 'Martedì', date: '2026-09-22', lunch: 'Riso', dinner: '' },
];

function fakeRepo(): MenuRepository {
  return {
    loadWeeks: vi.fn(async () => rows),
    saveWeek: vi.fn(),
    exportWorkbook: vi.fn(),
  };
}

describe('PrintMenu', () => {
  beforeEach(() => {
    window.print = vi.fn();
  });

  it('renders a printable sheet with the week range and the meals', async () => {
    render(<PrintMenu week={week} repository={fakeRepo()} />);
    await screen.findByText('Menù settimanale');
    expect(screen.getByTestId('print-range').textContent).toBe('dal 21/09/2026 al 27/09/2026');
    expect(screen.getByText(/Pasta/)).toBeInTheDocument();
    expect(screen.getByText(/Pizza/)).toBeInTheDocument();
    expect(screen.getByTestId('print-row-2026-09-22')).toHaveTextContent('Riso');
  });

  it('still shows the sheet for a week without saved rows', async () => {
    const emptyRepo: MenuRepository = { loadWeeks: vi.fn(async () => []), saveWeek: vi.fn(), exportWorkbook: vi.fn() };
    render(<PrintMenu week={week} repository={emptyRepo} />);
    await screen.findByText('Menù settimanale');
    expect(screen.getByTestId('print-range').textContent).toBe('dal 21/09/2026 al 27/09/2026');
  });

  it('opens the print dialog', async () => {
    render(<PrintMenu week={week} repository={fakeRepo()} />);
    await screen.findByText('Menù settimanale');
    fireEvent.click(screen.getByTestId('print-button'));
    expect(window.print).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit -- --run src/pages/PrintMenu.test.tsx`
Expected: FAIL — module `./PrintMenu` non esiste.

- [ ] **Step 3: Write minimal implementation**

`src/pages/PrintMenu.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage,
  IonTitle, IonToolbar,
} from '@ionic/react';
import { DevHttpFileGateway } from '../data/DevHttpFileGateway';
import { XlsxMenuRepository, type MenuRepository } from '../data/MenuRepository';
import type { MenuRow } from '../domain/types';
import { parseIso, toDisplay, weekRangeLabel } from '../domain/week';
import './PrintMenu.css';

const EMPTY = '—';

export interface PrintMenuProps {
  week: string;
  repository?: MenuRepository;
}

export const PrintMenuRoute: React.FC = () => {
  const params = useParams<{ week?: string }>();
  return <PrintMenu week={params.week ?? ''} />;
};

const PrintMenu: React.FC<PrintMenuProps> = ({ week, repository }) => {
  const repo = useMemo(() => repository ?? new XlsxMenuRepository(new DevHttpFileGateway()), [repository]);
  const [rows, setRows] = useState<MenuRow[]>([]);

  const load = useCallback(async () => {
    try {
      setRows(await repo.loadWeeks());
    } catch {
      setRows([]);
    }
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(
    () =>
      rows
        .filter(r => r.weekStart === week)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [rows, week],
  );

  return (
    <IonPage className="printable-page">
      <IonHeader className="no-print">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Stampa menù</IonTitle>
          <IonButton slot="end" data-testid="print-button" onClick={() => window.print()}>
            Stampa
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="print-sheet" data-testid="print-sheet">
          <h1 className="print-title">Menù settimanale</h1>
          <p className="print-range" data-testid="print-range">{weekRangeLabel(week)}</p>
          <table className="print-table">
            <thead>
              <tr>
                <th>Giorno</th>
                <th>Pranzo</th>
                <th>Cena</th>
              </tr>
            </thead>
            <tbody>
              {days.map(row => (
                <tr key={row.date} data-testid={`print-row-${row.date}`}>
                  <td>{row.dayName} {toDisplay(parseIso(row.date))}</td>
                  <td>{row.lunch || EMPTY}</td>
                  <td>{row.dinner || EMPTY}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PrintMenu;
```

`src/pages/PrintMenu.css`:

```css
.print-sheet {
  padding: 24px;
}

.print-title {
  margin: 0 0 8px;
  font-size: 1.4rem;
}

.print-range {
  margin: 0 0 16px;
  color: var(--ion-color-medium);
}

.print-table {
  width: 100%;
  border-collapse: collapse;
}

.print-table th,
.print-table td {
  border: 1px solid var(--ion-color-medium);
  padding: 6px 10px;
  text-align: left;
  vertical-align: top;
}

@media print {
  .printable-page {
    --background: #fff;
  }

  .no-print {
    display: none !important;
  }

  ion-content {
    --padding-top: 0;
    --padding-bottom: 0;
  }
}
```

Modificare `src/App.tsx`:

```tsx
import { PrintMenuRoute } from './pages/PrintMenu';
```

```tsx
<Route path="/stampa/:week" element={<PrintMenuRoute />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit -- --run src/pages/PrintMenu.test.tsx`
Expected: PASS (3 test). Poi `npm run test.unit -- --run src/App.test.tsx` (ancora verdi).

- [ ] **Step 5: Commit**

```bash
git add src/pages/PrintMenu.tsx src/pages/PrintMenu.css src/pages/PrintMenu.test.tsx src/App.tsx
git commit -m "feat: pagina di stampa del menù settimanale"
```

---

### Task 8: Menù hamburger in Home (3 voci + esporta DB)

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.css`
- Modify: `src/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `MenuRepository.exportWorkbook` (Task 4), `saveWorkbookToDisk` da `../data/exportWorkbook` (Task 5), icona `cart`, `print`, `download` da `ionicons/icons`, componenti Ionic menu (`IonMenu`, `IonMenuButton`, `IonList`, `IonItem`, `IonLabel`, `IonContent`), `toIso` già importato.
- Produces: `HomeProps.onNavigate?: (url: string) => void` (default assente → i click navigano solo se la prop è data, così i test esistenti restano invariati). Rotte navigate: `/lista/<weekIso>` e `/stampa/<weekIso>`.

- [ ] **Step 1: Write the failing tests**

In `src/pages/Home.test.tsx`, aggiungere sopra `describe('Home view', ...)` il mock del modulo di export (top-level, viene hoisted):

```tsx
vi.mock('../data/exportWorkbook', () => ({
  saveWorkbookToDisk: vi.fn(async () => 'saved' as const),
}));
import { saveWorkbookToDisk } from '../data/exportWorkbook';
```

Poi aggiungere un nuovo describe in fondo al file:

```tsx
describe('Home hamburger menu', () => {
  it('shows the three menu entries with their labels', async () => {
    await renderHome();
    expect(screen.getByTestId('menu-list')).toHaveTextContent('Crea lista della spesa');
    expect(screen.getByTestId('menu-print')).toHaveTextContent('Esporta in PDF il menù settimanale selezionato');
    expect(screen.getByTestId('menu-export')).toHaveTextContent('Esporta tutto il DB');
  });

  it('navigates to the shopping list of the shown week', async () => {
    const navigate = vi.fn();
    render(<Home repository={seededStore([])} onNavigate={navigate} />);
    await screen.findByText('Weekly Menu');
    fireEvent.click(screen.getByTestId('menu-list'));
    expect(navigate).toHaveBeenCalledWith(`/lista/${toIso(weekStartForOffset(0))}`);
  });

  it('navigates to the print view of the shown week', async () => {
    const navigate = vi.fn();
    render(<Home repository={seededStore([])} onNavigate={navigate} />);
    await screen.findByText('Weekly Menu');
    fireEvent.click(screen.getByTestId('menu-print'));
    expect(navigate).toHaveBeenCalledWith(`/stampa/${toIso(weekStartForOffset(0))}`);
  });

  it('exports the whole workbook with a dated filename', async () => {
    const repo = await renderHome([]);
    fireEvent.click(screen.getByTestId('menu-export'));
    await waitFor(() => expect(vi.mocked(repo.exportWorkbook)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveWorkbookToDisk)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveWorkbookToDisk).mock.calls[0][1]).toMatch(/^WeeklyMenu_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it('shows a toast when exporting fails', async () => {
    const repo = seededStore([]);
    vi.mocked(repo.exportWorkbook).mockRejectedValueOnce(new Error('boom'));
    render(<Home repository={repo} />);
    await screen.findByText('Weekly Menu');
    fireEvent.click(screen.getByTestId('menu-export'));
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent("Errore nell'esportazione"));
  });
});
```

Nota: `seededStore` e `renderHome` vivono in `Home.test.tsx`; `renderHome` deve restituire il repo con `exportWorkbook` (già aggiunto in Task 4).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit -- --run src/pages/Home.test.tsx`
Expected: FAIL — testid `menu-list`, `menu-print`, `menu-export` non trovati.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/Home.tsx`:

Imports:

```tsx
import {
  checkmark, chevronBack, chevronDown, chevronForward, close, pencil,
  cart, download, print,
} from 'ionicons/icons';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonFab, IonFabButton,
  IonHeader, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuButton,
  IonPage, IonTitle, IonToolbar,
} from '@ionic/react';
import { saveWorkbookToDisk } from '../data/exportWorkbook';
```

Props:

```tsx
interface HomeProps {
  repository?: MenuRepository;
  onNavigate?: (url: string) => void;
}
```

Firma componente e handler:

```tsx
const Home: React.FC<HomeProps> = ({ repository, onNavigate }) => {
```

Handler di navigazione ed export (dopo `handleSave`):

```tsx
const navigateTo = (url: string) => {
  onNavigate?.(url);
};

const openShoppingList = () => navigateTo(`/lista/${weekStartIso}`);

const openPrintView = () => navigateTo(`/stampa/${weekStartIso}`);

const handleExportDb = async () => {
  try {
    const buffer = await repo.exportWorkbook();
    await saveWorkbookToDisk(buffer, `WeeklyMenu_${toIso(new Date())}.xlsx`);
  } catch {
    setToast("Errore nell'esportazione");
  }
};
```

JSX — prima di `<IonPage>` il menù, e toolbar con hamburger:

```tsx
return (
  <>
    <IonMenu contentId="main-content">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Weekly Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem data-testid="menu-list" button onClick={openShoppingList}>
            <IonIcon icon={cart} slot="start" />
            <IonLabel>Crea lista della spesa</IonLabel>
          </IonItem>
          <IonItem data-testid="menu-print" button onClick={openPrintView}>
            <IonIcon icon={print} slot="start" />
            <IonLabel>Esporta in PDF il menù settimanale selezionato</IonLabel>
          </IonItem>
          <IonItem data-testid="menu-export" button onClick={() => void handleExportDb()}>
            <IonIcon icon={download} slot="start" />
            <IonLabel>Esporta tutto il DB</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonMenu>

    <IonPage id="main-content">
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Weekly Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
      ... (resto invariato) ...
    </IonPage>
  </>
);
```

**Attenzione al fragment:** il return di Home ora deve avvolgere tutto in `<>...</>`. Il resto del JSX di `IonPage` resta invariato. Nel file, `return (` inizia con `<IonPage>`; sostituisci l'apertura con il blocco sopra e chiudi con `</>`. Verifica che il JSX esistente dentro `IonPage` resti identico.

In `src/pages/Home.css`, aggiungere (cursore a mano anche sulle voci del menù, come da scelta utente):

```css
ion-menu ion-item {
  cursor: pointer;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit -- --run src/pages/Home.test.tsx`
Expected: PASS (18+4 test). Poi l'intera suite: `npm run test.unit -- --run` → atteso 46 + 5 (ShoppingList) + 3 (PrintMenu) + 1 (App extra? App resta 1) = **58 test**.

- [ ] **Step 5: Static check finale**

Run: `npm run lint` e `npm run build`.
Expected: lint 0 problemi; build ok.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.css src/pages/Home.test.tsx
git commit -m "feat: menù hamburger con lista spesa, stampa ed esporta DB"
```

---

### Task 9: Registrazione e verifica finale

**Files:**
- Modify: `.superpowers/sdd/2026-09-24-weekly-menu/progress.md` (append)

- [ ] **Step 1: Record the increment in the ledger**

Appendere una riga in coda a `.superpowers/sdd/2026-09-24-weekly-menu/progress.md` con: data, feature, commit HEAD, esito test/build/lint (es. `2026-10-02: menù hamburger (lista spesa, stampa, esporta DB) — 58 test / build / lint ok`).

- [ ] **Step 2: Full verification**

Run: `npm run test.unit -- --run` → 58 PASS; `npm run lint` → ok; `npm run build` → ok.
Poi smoke manuale consigliata all'utente: `npm run dev`, hamberger → "Crea lista della spesa" su una settimana con dati salvati in `dati/menu.xlsx` (es. 2026-09-28), "Salva in Dati", riapri la pagina (Richiama), "Esporta in PDF …" → `window.print()`, "Esporta tutto il DB" → download `WeeklyMenu_*.xlsx`.

- [ ] **Step 3: Commit**

```bash
git add .superpowers/sdd/2026-09-24-weekly-menu/progress.md
git commit -m "docs: registro incremento menù hamburger"
```

(Se non ci sono modifiche da committare, il commit può restare vuoto: in tal caso non creare commit vuoti e lascia solo la riga nel ledger salvata localmente, segnalandolo.)
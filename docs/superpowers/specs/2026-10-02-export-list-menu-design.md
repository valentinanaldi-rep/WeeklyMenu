# Weekly Menu — Menù hamburger: lista spesa, PDF/stampa, esporta DB

Data: 2026-10-02

## Obiettivo

Aggiungere all'app (Ionic React + Capacitor, provata in `vite dev`) un **menù a hamburger** con tre voci:

1. **Crea lista della spesa** — copia in un file nota il menù della settimana selezionata, permette di inserire la lista della spesa, di salvarla nella cartella `dati/` e di richiamarla quando serve.
2. **Esporta in PDF il menù settimanale selezionato** — copia il menù settimanale in una vista nota stampabile e permette di stamparlo (con possibilità "Salva come PDF" dalla finestra di stampa di sistema).
3. **Esporta tutto il DB** — salva il file Excel completo su un device a scelta (finestra "Salva con nome" su Chromium, download negli altri browser; su nativo, condivisione di sistema in una fase futura).

Scelta target: **web prima, nativo dopo**. Le funzioni di file/condivisione stanno dietro interface agnostiche (stile `FileGateway`) così in futuro si sostituiscono con i plugin Capacitor Filesystem/capacitor-file-sharer senza toccare la UI.

## Requisiti

- Il menù a hamburger (stile Ionic) è accessibile da Home tramite il bottone hamburger nella toolbar.
- 3 voci con icona, rispettivamente: `cart` (Crea lista della spesa), `print` (Esporta in PDF…), `download` (Esporta tutto il DB).
- Voce 1 → naviga alla pagina `/lista/:week` della settimana mostrata.
- Voce 2 → naviga alla pagina `/stampa/:week` della settimana mostrata.
- Voce 3 → scarica il file `WeeklyMenu_<data-ISO>.xlsx` (tutto il DB) restando su Home.

### Pagina Lista della spesa (`/lista/:week`)

- Mostra la settimana ("dal … al …") e, in alto, il **menù copiato in nota** (una riga per giorno: `Giorno GG/MM/AAAA — Pranzo: … — Cena: …`), in sola lettura.
- Sotto, un editor a righe per la lista della spesa (una riga = un elemento).
- Bottoni: **Salva in Dati** e **Richiama** (più il back).
- Salva → scrive `dati/lista_<week-ISO>.txt` in UTF-8 con formato nota (vedi "Formato file nota"); feedback via toast.
- Richiama → se il file esiste ricarica gli elementi nella textarea; se non esiste toast "Nessuna lista per questa settimana".
- All'apertura la lista viene caricata se presente.

### Pagina Stampa (`/stampa/:week`)

- Vista dedicata, senza chrome dell'app: titolo "Menù settimanale", intervallo "dal … al …" e tabella giorni con Pranzo e Cena.
- Bottoni **Torna al menù** e **Stampa** (entrambi nascosti in stampa via CSS `@media print`).
- **Stampa** chiama `window.print()`: l'utente sceglie stampante o "Salva come PDF".

## Architettura

Strati già esistenti, estesi:

```
src/
  domain/
    types.ts            (invariato)
    week.ts             (invariato)
    menuNote.ts         (nuovo) nota menù + composizione/parsing file lista
  data/
    MenuRepository.ts   + exportWorkbook(): Promise<ArrayBuffer>
    FileGateway.ts      (invariato) read/write ArrayBuffer
    TextFileGateway.ts  (nuovo) readText/writeText per stringhe
    DevHttpTextGateway.ts (nuovo) HTTP verso /api/lista
    exportWorkbook.ts   (nuovo) salvataggio su disco (picker o download)
    viteDevFilePlugin.ts (esteso) endpoint /api/lista per-settimana
  pages/
    Home.tsx            + ion-menu, export DB, navigazione a /lista e /stampa
    Home.css            + stili menù
    ShoppingList.tsx    (nuovo) pagina lista spesa
    ShoppingList.css    (nuovo)
    PrintMenu.tsx       (nuovo) vista stampabile
    PrintMenu.css       (nuovo, regole @media print)
  App.tsx               + rotte /lista/:week e /stampa/:week
```

### Modello nota (src/domain/menuNote.ts) — funzioni pure

- `menuNote(weekStart: string, rows: MenuRow[]): string` — costruisce la parte "nota": riga intestazione `Menù della settimana: <weekRangeLabel>` e una riga per giorno:
  `Lunedì 28/09/2026 — Pranzo: … — Cena: …` (campo vuoto → `—`).
- `LIST_MARKER = 'LISTA DELLA SPESA'` (riga che separa nota e lista).
- `composeListFile(note: string, items: string[]): string` — nota + riga vuota + `LISTA DELLA SPESA` + righe `- <item>`.
- `parseListFile(content: string): { items: string[] }` — estrae gli elementi dopo il marker (ignora le righe nota), toglie il prefisso `- `, scarta righe vuote. Senza marker → `items: []`.

### Gateway testuale (src/data/TextFileGateway.ts)

```ts
export interface TextFileGateway {
  readText(key: string): Promise<string | null>;  // null = file assente
  writeText(key: string, content: string): Promise<void>;
}
```

- `DevHttpTextGateway`: `readText(key)` → `GET /api/lista?week=<key>` (404 → `null`); `writeText(key, content)` → `PUT /api/lista?week=<key>` con body testo (errore se non 2xx).

### Export su dispositivo (src/data/exportWorkbook.ts)

- `saveWorkbookToDisk(buffer: ArrayBuffer, filename: string): Promise<'saved' | 'cancelled'>`:
  - se esiste `window.showSaveFilePicker` (Chromium in contesto sicuro): apre il picker con `suggestedName = filename`, scrive i bytes; `AbortError` (utente annulla) → `'cancelled'`.
  - altrimenti: `Blob` + `<a download>` auto-click → `'saved'`.

### Repository

- Aggiunta a interfaccia `MenuRepository`: `exportWorkbook(): Promise<ArrayBuffer>`.
- Implementazione `XlsxMenuRepository.exportWorkbook()`: legge i bytes dal `FileGateway`; se `null` ritorna `emptyWorkbook()`.

### Middleware dev (viteDevFilePlugin.ts) — esteso

Cambio firma: `createFileMiddleware(menuFilePath: string, listsDir: string)`.

- `GET/POST /api/menu` → comportamento attuale (binario, `menuFilePath`).
- `GET /api/lista?week=<key>` → se `<listsDir>/lista_<key>.txt` esiste: 200 testo UTF-8; altrimenti 404.
- `PUT /api/lista?week=<key>` → crea/sovrascrive `<listsDir>/lista_<key>.txt` con il body; 200 `ok`.
- `week` deve valicare `/^\d{4}-\d{2}-\d{2}$/` e rappresentare una data valida (lunedì ISO), altrimenti 400.
- Altre rotte → `next()`.

Aggiornare `vite.config.ts` di conseguenza.

### UI Home (src/pages/Home.tsx)

- `<IonMenu contentId="main-content">` con header "Weekly Menu" e 3 `IonItem` (etichette come da Requisiti) che usano `useIonRouter`:
  - lista spesa → `push('/lista/' + weekStartIso)` e chiude il menù;
  - stampa → `push('/stampa/' + weekStartIso)` e chiude il menù;
  - esporta DB → async `repo.exportWorkbook()` + `saveWorkbookToDisk(buffer, 'WeeklyMenu_' + toIso(new Date()) + '.xlsx')`; toast su errore (annullamento silenzioso).
- `<IonPage id="main-content">`, toolbar con `IonMenuButton` prima del titolo.
- `HomeProps` guadagna `onNavigate?` per i test (default `useIonRouter().push`).

### Pagina ShoppingList (src/pages/ShoppingList.tsx)

- Props: `{ week?: string; repository?: MenuRepository; textGateway?: TextFileGateway }` (default dev).
- `week` da `useParams`, sovrascrivibile dalla prop per i test.
- Al mount: `repo.loadWeeks()`, estrae le righe della settimana, costruisce `menuNote`; poi `textGateway.readText(week)` → se presente ripopola la lista.
- Stato: `note`, `items` (testo textarea), `busy`, `toast`.
- **Salva in Dati**: `writeText(week, composeListFile(note, righeNonVuote(items)))`; toast "Lista salvata".
- **Richiama**: `readText(week)`; `null` → toast "Nessuna lista per questa settimana"; altrimenti aggiorna la textarea con gli elementi parsati; toast "Lista caricata".

### Pagina PrintMenu (src/pages/PrintMenu.tsx)

- Props: `{ week?: string; repository?: MenuRepository }`.
- Al mount carica le righe della settimana e compone la tabella.
- Bottone **Stampa**: `window.print()`.
- CSS: `.no-print { display: none }` in `@media print`; layout pulito (tabella settimana, niente Ionic chrome).

### Rotte (App.tsx)

- Aggiungere `<Route path="/lista/:week" element={<ShoppingList />} />` e `<Route path="/stampa/:week" element={<PrintMenu />} />`.

## Formato file nota `dati/lista_<week-ISO>.txt` (UTF-8)

```
Menù della settimana: dal 28/09/2026 al 04/10/2026

Lunedì 28/09/2026 — Pranzo: Pasta al pomodoro e basilico — Cena: Pollo alla pizzaiola con riso pilaf
Martedì 29/09/2026 — Pranzo: … — Cena: …
… (7 giorni)

LISTA DELLA SPESA
- farina
- uova
- latte
```

## Gestione errori

- `readText` 404 → trattato come "nessuna lista" (niente toast d'errore, toast informativo su Richiama).
- `writeText` fallito → toast "Errore nel salvataggio della lista", si resta sulla pagina senza perdere il testo.
- Esporta DB: picker annullato → silenzioso; errore di scrittura/download → toast "Errore nell'esportazione".
- Stampa: nessuna gestione speciale.

## Testing

- **Unit dominio / dati** (vitest):
  - `menuNote.test.ts`: costruzione nota (7 giorni, campi vuoti `—`), roundtrip `composeListFile`/`parseListFile`.
  - `viteDevFilePlugin.test.ts`: GET lista assente → 404; GET lista presente → testo; PUT lista crea/sovrascrive; week non valida → 400; rotte `/api/menu` nello stesso middleware restano funzionanti.
  - `DevHttpTextGateway.test.ts`: 404 → null; 200 → testo; PUT con body corretto; errore non-2xx.
  - `XlsxMenuRepository.test.ts`: `exportWorkbook` restituisce i bytes del gateway (e `emptyWorkbook` se `null`).
  - `exportWorkbook.test.ts`: con `showSaveFilePicker` → usa il picker; senza → anchor download.
- **Component (vitest + jsdom + Testing Library)**:
  - `Home.test.tsx` (esistente, integrato): il menù ha 3 voci con le etichette richieste; click su "Crea lista della spesa" naviga a `/lista/<week>`; click su "Esporta tutto il DB" chiama `exportWorkbook` e il salvataggio (mock).
  - `ShoppingList.test.tsx`: mostra nota + giorni; salva → `writeText` con contenuto composto; richiama → ripopola la textarea; file assente → toast.
  - `PrintMenu.test.tsx`: rende la tabella con pranzo/cena; click Stampa → `window.print` chiamato (stub).
- **E2E**: smoke opzionale non previsto per questo incremento.

## Dipendenze

- Nessuna nuova dipendenza runtime né dev.

## Fuori scope (fasi future)

- Sostituzione `TextFileGateway`/esportazione con plugin Capacitor (`@capacitor/filesystem`, `@capgo/capacitor-file-sharer`) e stampa nativa (`@capawesome-team/capacitor-printer`) quando verranno aggiunte le piattaforme `android`/`ios`.
- "Esporta in PDF" come generazione di un vero file `.pdf` via jsPDF (non necessaria: la stampa di sistema già offre "Salva come PDF").
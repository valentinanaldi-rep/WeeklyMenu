# Weekly Menu — Design

Data: 2026-09-24

## Obiettivo

App mobile (Ionic React + Capacitor, per ora provata nel browser in `vite dev`) con una sola schermata che consente di visualizzare e inserire a mano il menù settimanale. I dati vengono letti e scritti in un file Excel `dati/menu.xlsx` nella directory del progetto.

## Requisiti

- Titolo in alto.
- Riga della settimana: intervallo "dal … al …" con due pulsanti `<` e `>` per scorrere tra le settimane.
- Elenco dei giorni dal lunedì alla domenica; per ogni giorno: data, campo pranzo, campo cena.
- All'apertura viene mostrata la settimana corrente.
- In visualizzazione i pulsanti di scorrimento mostrano i menù già presenti nel file.
- Pulsante con icona a matita in basso a destra: attiva la modalità inserimento.
  - In modalità inserimento, se nel file Excel esiste il menù di 52 settimane prima (stessa settimana dell'anno precedente), la app precompila la settimana visualizzata; l'utente può modificare, poi salvare o annullare.
- In modalità inserimento compaiono in basso a destra due icone al posto della matita: annulla e salva.
- I dati sono salvati al momento in un file Excel nella directory `dati` del progetto.

## Architettura

Tre strati isolati e indipendenti:

```
src/
  domain/            logica pura, testabile senza DOM
    types.ts         DayMenu, WeekMenu
    week.ts          funzioni date: startOfWeek, addWeeks, weekOf,
                     formatDate, 52 settimane prima
  data/              persistenza
    MenuRepository.ts      interfaccia repository
    XlsxMenuRepository.ts  implementazione con SheetJS (xlsx)
    FileGateway.ts         interfaccia file (read/write)
    DevHttpFileGateway.ts  gateway HTTP verso il middleware Vite (dev)
    viteDevFilePlugin.ts   plugin Vite dev: serve dati/menu.xlsx
  pages/Home.tsx     schermata unica (UI Ionic)
```

### Modello

```ts
interface DayMenu {
  dayName: string;            // 'Lunedì' … 'Domenica'
  date: string;               // 'yyyy-mm-dd'
  lunch: string;
  dinner: string;
}

interface WeekMenu {
  weekStart: string;          // 'yyyy-mm-dd' (lunedì)
  days: DayMenu[];            // 7 elementi, lun→dom
}
```

### Logica date (domain/week.ts) — funzioni pure

- `startOfWeek(date): Date` — il lunedì della settimana di `date`.
- `weekStartForOffset(offsetWeeks)` — `startOfWeek(today) + offsetWeeks * 7 giorni`. `offsetWeeks = 0` alla apertura, `<0` indietro, `>0` avanti.
- `weekMenuFor(weekStart): WeekMenu` — costruisce i 7 `DayMenu` con data incrementata di 1 giorno.
- `weekRangeLabel(weekStart): string` — "dal 24/02/2026 al 02/03/2026".
- `previousYearWeek(weekStart): string` — `weekStart - 364 giorni` (52 settimane).
- `addDays(date, n)`.
- Data di ogni giorno = `weekStart + i giorni`, formattata ISO `yyyy-mm-dd` (usata anche nella colonna Data dell'Excel → matching esatto senza fusi orari).

### Persistenza (src/data/)

- **MenuRepository** (interfaccia):
  - `loadWeeks(): Promise<DayMenu[]>` — tutte le righe salvate.
  - `saveWeek(week: WeekMenu): Promise<void>` — aggiorna le 7 righe della settimana e riscrive tutto il workbook.
- **XlsxMenuRepository**: legge il workbook dal `FileGateway`, lo mappa in `DayMenu[]` e viceversa. Al salvataggio rilegge il workbook esistente, sostituisce le righe della settimana corrente, mantiene le altre, riscrive l'intero workbook.
- **FileGateway** (interfaccia):
  - `read(): Promise<ArrayBuffer | null>`
  - `write(data: ArrayBuffer): Promise<void>`
- **DevHttpFileGateway**: GET `/api/menu` (bytes del file), POST `/api/menu` (riscrittura del file).
- **viteDevFilePlugin** (solo `vite dev`):
  - GET `/api/menu`: se `dati/menu.xlsx` esiste lo serve; altrimenti crea il file con la sola riga di intestazione e lo serve.
  - POST `/api/menu`: sovrascrive `dati/menu.xlsx` con il body ricevuto.
  - Il path del file è risolto rispetto alla root del progetto.
  - La sostituzione del `FileGateway` con il plugin Capacitor Filesystem consentirà l'esecuzione su dispositivo senza modificare la UI.

### UI (src/pages/Home.tsx)

- `IonHeader` + `IonToolbar` + `IonTitle`: "Weekly Menu".
- Riga navigazione settimana: `<` (chevron-back), etichetta `dal … al …`, `>` (chevron-forward).
- Lista di 7 card (lun→dom); ciascuna con intestazione "Lunedì 24/02" e due campi: **Pranzo** e **Cena**.
  - Vista: testo (vuoto se assente).
  - Modifica: `IonTextarea` modificabili.
- FAB in basso a destra:
  - vista → matita (`pencil`);
  - modifica → `close` (annulla) e `checkmark` (salva).
- Stato componente: `weekOffset: number`, `mode: 'view' | 'edit'`, `draft: WeekMenu | null`.
- Apertura: `weekOffset = 0`, pagina corrente.
- `<`/`>`: cambiano `weekOffset`, aggiornano la settimana mostrata e i valori letti dal repository.
- Matita: se `draft` già attivo, viene ignorato. Altrimenti entra in modifica e precompila con:
  - la settimana di 52 settimane prima (`previousYearWeek(weekStart)`): per ogni giorno della settimana visualizzata, se nel repository esiste una riga con `date = data del giorno − 364 giorni`, pranzo/cena del draft vengono prefilled; altrimenti vuoti.
- Salva: `saveWeek(draft)` sul repository, aggiorna la cache, torna in vista, toast "Salvato".
- Annulla: scarta il draft, torna in vista, nessuna scrittura.

Altre settimane presenti nel file vengono mostrate navigando con `<`/`>`. Nella vista i campi vuoti sono mostrati come testo vuoto/segno.

## Formato Excel `dati/menu.xlsx`

Foglio unico "Menù", prima riga intestazione. Formato riga per giorno (7 righe per settimana).

| Settimana | Giorno | Data | Pranzo | Cena |
|---|---|---|---|---|
| 2026-02-23 | Lunedì | 2026-02-23 | … | … |
| 2026-02-23 | Martedì | 2026-02-24 | … | … |
| … | … | … | … | … |

- `Settimana`: data ISO `yyyy-mm-dd` del lunedì.
- `Giorno`: nome giorno (Lunedì … Domenica).
- `Data`: ISO `yyyy-mm-dd`.
- `Pranzo` / `Cena`: testo libero.

Il file viene creato automaticamente dal middleware al primo avvio con la sola header. `dati/*.xlsx` è in `.gitignore`; nel repository resta `dati/.gitkeep`.

## Gestione errori

- Lettura iniziale fallita (file non raggiungibile, rete): toast "Impossibile caricare il menù", la UI resta funzionante con settimane vuote.
- Salvataggio fallito: toast di errore, si rimane in modalità inserimento senza perdere il draft.
- Doppio commit matita mentre si è in modifica: ignorato.

## Testing

- **Unit (vitest)**: logica date (`startOfWeek`, wrap di fine anno, `offsetWeeks`, 52 settimane prima, formattazione range); roundtrip del repository su un gateway in-memory (creazione, lettura, aggiornamento di una settimana preservando le altre, prefill 52 settimane).
- **Component (vitest + jsdom + Testing Library)**: Home con repository mock — titolo, range dal/al, 7 giorni, navigazione `<`/`>`, matita → inputs prefilled dai dati di 52 settimane prima, salva → chiama il repository e torna in vista, annulla → nessuna scrittura.
- **E2E (Cypress)**: smoke opzionale (apri, matita, scrivi, salva, rileggi).

## Dipendenze

Nuova dipendenza runtime: `xlsx` (SheetJS). Nessun'altra.

## Fuori scope (fasi future)

- Salvataggio su dispositivo reale via Capacitor Filesystem (sostituzione `FileGateway`).
- Piattaforme Android/iOS (niente folder `android`/`ios` per ora).
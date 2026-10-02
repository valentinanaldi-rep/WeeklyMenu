import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonFab, IonFabButton,
  IonHeader, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuButton,
  IonPage, IonTitle, IonToolbar, useIonRouter,
} from '@ionic/react';
import {
  cart, checkmark, chevronBack, chevronDown, chevronForward, close, download,
  pencil, print,
} from 'ionicons/icons';
import { DevHttpFileGateway } from '../data/DevHttpFileGateway';
import type { MenuRepository } from '../data/MenuRepository';
import { XlsxMenuRepository } from '../data/MenuRepository';
import { saveWorkbookToDisk } from '../data/exportWorkbook';
import type { DayMenu, MenuRow, WeekMenu } from '../domain/types';
import {
  dateForDay, offsetForWeekStart, parseIso, previousYearWeekStart, toDisplay, toIso,
  weekMenuFor, weekRangeLabel, weekStartForOffset,
} from '../domain/week';
import './Home.css';

function createDevRepository(): MenuRepository {
  return new XlsxMenuRepository(new DevHttpFileGateway());
}

interface HomeProps {
  repository?: MenuRepository;
  onNavigate?: (url: string) => void;
}

const EMPTY_TEXT = '—';
const TOAST_MS = 3000;
export const WEEK_PICKER_PAST = 260;
export const WEEK_PICKER_FUTURE = 156;

const Home: React.FC<HomeProps> = ({ repository, onNavigate }) => {
  const repo = useMemo(() => repository ?? createDevRepository(), [repository]);
  const router = useIonRouter();
  const menuRef = useRef<HTMLIonMenuElement | null>(null);
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

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const weekStartIso = toIso(weekStartForOffset(weekOffset));
  const week = weekMenuFor(weekStartIso);
  const display = draft ?? week;

  const mealFor = (day: DayMenu, field: 'lunch' | 'dinner') =>
    rows.find(r => r.date === day.date)?.[field] ?? '';

  const shiftWeek = (delta: number) => {
    if (mode === 'edit') {
      return;
    }
    setWeekOffset(w => w + delta);
  };

  const handleWeekPick = (e: ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value;
    if (!target) {
      return;
    }
    setWeekOffset(offsetForWeekStart(target));
  };

  const weekPickerOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    for (let offset = -WEEK_PICKER_PAST; offset <= WEEK_PICKER_FUTURE; offset += 1) {
      const startIso = toIso(weekStartForOffset(offset));
      list.push({ value: startIso, label: weekRangeLabel(startIso) });
    }
    return list;
  }, []);

  const handleEdit = () => {
    if (mode === 'edit') {
      return;
    }
    const prevStart = previousYearWeekStart(weekStartIso);
    const lastYear = new Map(
      rows.filter(r => r.weekStart === prevStart).map(r => [r.date, r]),
    );
    const currentWeek = new Map(
      rows.filter(r => r.weekStart === weekStartIso).map(r => [r.date, r]),
    );
    const nextDraft = weekMenuFor(weekStartIso);
    nextDraft.days = nextDraft.days.map((day, i) => {
      const source = currentWeek.get(day.date) ?? lastYear.get(dateForDay(prevStart, i));
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

  const navigateTo = (url: string) => {
    if (onNavigate) {
      onNavigate(url);
    } else {
      router.push(url);
    }
  };

  const openShoppingList = () => {
    void menuRef.current?.close();
    navigateTo(`/lista/${weekStartIso}`);
  };

  const openPrintView = () => {
    void menuRef.current?.close();
    navigateTo(`/stampa/${weekStartIso}`);
  };

  const handleExportDb = async () => {
    try {
      const buffer = await repo.exportWorkbook();
      await saveWorkbookToDisk(buffer, `WeeklyMenu_${toIso(new Date())}.xlsx`);
    } catch {
      setToast("Errore nell'esportazione");
    }
  };

  return (
    <>
      <IonMenu contentId="main-content" ref={menuRef}>
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
          <IonMenuButton slot="end" data-testid="menu-toggle" />
          <IonTitle data-testid="home-title">
            <img className="toolbar-icon" src="/icon.png" alt="Logo Weekly Menu" />
            <span className="toolbar-brand">Weekly Menu</span>
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="week-nav">
          <IonButton fill="outline" data-testid="prev-week" disabled={mode === 'edit'} onClick={() => shiftWeek(-1)}>
            <IonIcon icon={chevronBack} />
          </IonButton>
          <div className="week-picker">
            <div className="week-nav__label" data-testid="week-range">
              {weekRangeLabel(weekStartIso)}
              <IonIcon icon={chevronDown} />
            </div>
            <select
              className="week-picker__input"
              aria-label="Seleziona settimana"
              data-testid="week-picker"
              value={weekStartIso}
              disabled={mode === 'edit'}
              onChange={handleWeekPick}
            >
              {!weekPickerOptions.some(o => o.value === weekStartIso) && (
                <option value={weekStartIso}>{weekRangeLabel(weekStartIso)}</option>
              )}
              {weekPickerOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <IonButton fill="outline" data-testid="next-week" disabled={mode === 'edit'} onClick={() => shiftWeek(1)}>
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
          <>
            <IonFab slot="fixed" vertical="bottom" horizontal="start">
              <IonFabButton data-testid="edit-cancel" onClick={handleCancel}>
                <IonIcon icon={close} />
              </IonFabButton>
            </IonFab>
            <IonFab slot="fixed" vertical="bottom" horizontal="end">
              <IonFabButton data-testid="edit-save" onClick={() => void handleSave()}>
                <IonIcon icon={checkmark} />
              </IonFabButton>
            </IonFab>
          </>
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
    </>
  );
};

export default Home;
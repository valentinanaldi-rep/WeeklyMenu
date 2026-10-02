import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  IonButton, IonCard, IonCardContent, IonContent, IonFab, IonFabButton,
  IonHeader, IonIcon, IonPage, IonTitle, IonToolbar,
} from '@ionic/react';
import {
  checkmark, chevronBack, chevronDown, chevronForward, close, pencil,
} from 'ionicons/icons';
import { DevHttpFileGateway } from '../data/DevHttpFileGateway';
import type { MenuRepository } from '../data/MenuRepository';
import { XlsxMenuRepository } from '../data/MenuRepository';
import type { DayMenu, MenuRow, WeekMenu } from '../domain/types';
import {
  dateForDay, offsetForWeekStart, parseIso, previousYearWeekStart, toDisplay, toIso,
  toIsoWeekValue, weekMenuFor, weekRangeLabel, weekStartForOffset, weekStartFromIsoWeekValue,
} from '../domain/week';
import './Home.css';

function createDevRepository(): MenuRepository {
  return new XlsxMenuRepository(new DevHttpFileGateway());
}

interface HomeProps {
  repository?: MenuRepository;
}

const EMPTY_TEXT = '—';
const TOAST_MS = 3000;

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

  const weekPickerRef = useRef<HTMLInputElement>(null);

  const openWeekPicker = () => {
    if (mode === 'edit') {
      return;
    }
    const input = weekPickerRef.current;
    if (!input) {
      return;
    }
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        input.focus();
      }
    } else {
      input.focus();
    }
  };

  const handleWeekPick = (e: ChangeEvent<HTMLInputElement>) => {
    const target = weekStartFromIsoWeekValue(e.target.value);
    if (target === null) {
      return;
    }
    setWeekOffset(offsetForWeekStart(target));
  };

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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Weekly Menu</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="week-nav">
          <IonButton fill="outline" data-testid="prev-week" disabled={mode === 'edit'} onClick={() => shiftWeek(-1)}>
            <IonIcon icon={chevronBack} />
          </IonButton>
          <div className="week-picker" onClick={openWeekPicker}>
            <div className="week-nav__label" data-testid="week-range">
              {weekRangeLabel(weekStartIso)}
              <IonIcon icon={chevronDown} />
            </div>
            <input
              type="week"
              ref={weekPickerRef}
              className="week-picker__input"
              aria-label="Seleziona settimana"
              data-testid="week-picker"
              value={toIsoWeekValue(weekStartIso)}
              disabled={mode === 'edit'}
              onChange={handleWeekPick}
            />
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
  );
};

export default Home;
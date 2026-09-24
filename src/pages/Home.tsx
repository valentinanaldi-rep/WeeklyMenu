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
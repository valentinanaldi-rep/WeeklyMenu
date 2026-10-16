import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage,
  IonTitle, IonToolbar,
} from '@ionic/react';
import { createFileGateway } from '../data/createFileGateway';
import { XlsxMenuRepository, type MenuRepository } from '../data/MenuRepository';
import type { MenuRow } from '../domain/types';
import { parseIso, toDisplay, weekRangeLabel } from '../domain/week';
import { printCurrentPage } from '../data/printMenu';
import './PrintMenu.css';

const EMPTY = '—';
const TOAST_MS = 3000;

export interface PrintMenuProps {
  week: string;
  repository?: MenuRepository;
}

export const PrintMenuRoute: React.FC = () => {
  const params = useParams<{ week?: string }>();
  return <PrintMenu week={params.week ?? ''} />;
};

const PrintMenu: React.FC<PrintMenuProps> = ({ week, repository }) => {
  const repo = useMemo(() => repository ?? new XlsxMenuRepository(createFileGateway()), [repository]);
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handlePrint = async () => {
    try {
      await printCurrentPage('Menù settimanale');
    } catch {
      setToast('Errore nella stampa');
    }
  };

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
          <IonButton slot="end" data-testid="print-button" onClick={() => void handlePrint()}>
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
        {toast && <div className="toast" data-testid="toast">{toast}</div>}
      </IonContent>
    </IonPage>
  );
};

export default PrintMenu;
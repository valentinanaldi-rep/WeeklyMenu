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
        <label className="list-label" htmlFor="shopping-items">Elementi (una voce per riga)</label>
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
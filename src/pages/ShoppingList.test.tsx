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
    deleteText: vi.fn(async () => {
      content = null;
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

  it('asks for confirmation before deleting the list', async () => {
    const custom = fakeList(`nota\n\n${LIST_MARKER}\n- farina`);
    render(<ShoppingList week={week} repository={fakeRepo()} textGateway={custom} />);
    await screen.findByText('Lista della spesa');
    fireEvent.click(screen.getByTestId('list-delete'));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent('Sì, cancella');
    expect(screen.getByTestId('delete-cancel')).toBeInTheDocument();
    expect(custom.deleteText).not.toHaveBeenCalled();
  });

  it('cancelling the confirmation keeps the list untouched', async () => {
    const custom = fakeList(`nota\n\n${LIST_MARKER}\n- farina`);
    render(<ShoppingList week={week} repository={fakeRepo()} textGateway={custom} />);
    await screen.findByText('Lista della spesa');
    const ta = screen.getByTestId('shopping-items') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'da tenere' } });
    fireEvent.click(screen.getByTestId('list-delete'));
    fireEvent.click(screen.getByTestId('delete-cancel'));
    expect(custom.deleteText).not.toHaveBeenCalled();
    expect(ta.value).toBe('da tenere');
    expect(screen.queryByTestId('delete-confirm')).not.toBeInTheDocument();
  });

  it('deletes the list, clears the textarea and shows a toast', async () => {
    const custom = fakeList(`nota\n\n${LIST_MARKER}\n- farina`);
    render(<ShoppingList week={week} repository={fakeRepo()} textGateway={custom} />);
    await screen.findByText('Lista della spesa');
    const ta = screen.getByTestId('shopping-items') as HTMLTextAreaElement;
    fireEvent.click(screen.getByTestId('list-delete'));
    fireEvent.click(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(custom.deleteText).toHaveBeenCalledWith(week));
    await waitFor(() => expect(ta.value).toBe(''));
    expect(screen.getByTestId('toast')).toHaveTextContent('Lista cancellata');
  });

  it('shows an error toast when the deletion fails', async () => {
    const custom = fakeList(null);
    custom.deleteText = vi.fn(async () => {
      throw new Error('boom');
    });
    render(<ShoppingList week={week} repository={fakeRepo()} textGateway={custom} />);
    await screen.findByText('Lista della spesa');
    fireEvent.click(screen.getByTestId('list-delete'));
    fireEvent.click(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(screen.getByTestId('toast')).toHaveTextContent('Errore nella cancellazione della lista'));
  });
});
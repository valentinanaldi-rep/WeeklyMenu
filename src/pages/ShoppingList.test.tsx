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
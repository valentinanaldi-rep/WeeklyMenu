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
    importWorkbook: vi.fn(async () => {}),
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
    const emptyRepo: MenuRepository = { loadWeeks: vi.fn(async () => []), saveWeek: vi.fn(), exportWorkbook: vi.fn(), importWorkbook: vi.fn() };
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
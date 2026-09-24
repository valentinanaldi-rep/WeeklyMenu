import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MenuRepository } from '../data/MenuRepository';
import { mergeWeek } from '../data/xlsxWorkbook';
import type { MenuRow, WeekMenu } from '../domain/types';
import {
  previousYearWeekStart, toIso, weekMenuFor, weekRangeLabel, weekStartForOffset,
} from '../domain/week';
import Home from './Home';

function weekRows(week: WeekMenu): MenuRow[] {
  return week.days.map(d => ({ weekStart: week.weekStart, ...d }));
}

function seededStore(rows: MenuRow[]): MenuRepository {
  const store: MenuRow[] = [...rows];
  return {
    loadWeeks: vi.fn(async () => [...store]),
    saveWeek: vi.fn(async (week: WeekMenu) => {
      const merged = mergeWeek(store, week);
      store.length = 0;
      store.push(...merged);
    }),
  };
}

async function renderHome(rows: MenuRow[] = []) {
  const repo = seededStore(rows);
  render(<Home repository={repo} />);
  await screen.findByText('Weekly Menu');
  return repo;
}

describe('Home view', () => {
  it('shows title, week range and 7 day cards', async () => {
    await renderHome();
    expect(screen.getByText('Weekly Menu')).toBeInTheDocument();
    expect(screen.getByTestId('week-range').textContent).toBe(weekRangeLabel(toIso(weekStartForOffset(0))));
    const week = weekMenuFor(toIso(weekStartForOffset(0)));
    for (const day of week.days) {
      expect(screen.getByText(day.dayName)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^lunch-\d$/)).toHaveLength(7);
    expect(screen.getAllByTestId(/^dinner-\d$/)).toHaveLength(7);
  });

  it('shows saved lunch/dinner for the current week', async () => {
    const week = weekMenuFor(toIso(weekStartForOffset(0)));
    week.days[0].lunch = 'Pasta al pomodoro';
    week.days[1].dinner = 'Frittata';
    await renderHome(weekRows(week));
    expect(screen.getByText(/Pasta al pomodoro/)).toBeInTheDocument();
    expect(screen.getByText(/Frittata/)).toBeInTheDocument();
  });

  it('navigates weeks with > and < showing exact ranges', async () => {
    await renderHome();
    fireEvent.click(screen.getByTestId('next-week'));
    expect(screen.getByTestId('week-range').textContent).toBe(weekRangeLabel(toIso(weekStartForOffset(1))));
    fireEvent.click(screen.getByTestId('prev-week'));
    fireEvent.click(screen.getByTestId('prev-week'));
    expect(screen.getByTestId('week-range').textContent).toBe(weekRangeLabel(toIso(weekStartForOffset(-1))));
  });

  it('shows empty state for weeks without data', async () => {
    await renderHome();
    fireEvent.click(screen.getByTestId('next-week'));
    expect(screen.getAllByText(/—/).length).toBeGreaterThanOrEqual(14);
  });
});

const curStart = toIso(weekStartForOffset(0));
const prevStart = previousYearWeekStart(curStart);

function rowsWithPrev(): MenuRow[] {
  const prev = weekMenuFor(prevStart);
  prev.days[0].lunch = 'Minestra di ceci';
  prev.days[0].dinner = 'Tortino';
  prev.days[1].lunch = 'Risotto ai funghi';
  return weekRows(prev);
}

describe('Home edit', () => {
  it('enters edit mode prefilling from 52 weeks before', async () => {
    await renderHome(rowsWithPrev());
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    const lunch0 = screen.getByTestId('lunch-0');
    expect(lunch0.tagName).toBe('TEXTAREA');
    expect((lunch0 as HTMLTextAreaElement).value).toBe('Minestra di ceci');
    expect((screen.getByTestId('dinner-0') as HTMLTextAreaElement).value).toBe('Tortino');
    expect(screen.getByTestId('edit-save')).toBeInTheDocument();
    expect(screen.getByTestId('edit-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('day-date-0').textContent).not.toBe('');
  });

  it('save writes the draft and shows it in view', async () => {
    const repo = await renderHome([]);
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    await userEvent.type(screen.getByTestId('lunch-0'), 'Pasta e patate');
    fireEvent.click(screen.getByTestId('edit-save'));
    expect(vi.mocked(repo.saveWeek)).toHaveBeenCalledTimes(1);
    const draft = vi.mocked(repo.saveWeek).mock.calls[0][0] as WeekMenu;
    expect(draft.days[0].lunch).toBe('Pasta e patate');
    await waitFor(() => {
      expect(screen.getByTestId('lunch-0').textContent).toContain('Pasta e patate');
    });
  });

  it('cancel discards the draft without saving', async () => {
    const repo = await renderHome([]);
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    await userEvent.type(screen.getByTestId('lunch-0'), 'Da buttare');
    fireEvent.click(screen.getByTestId('edit-cancel'));
    expect(repo.saveWeek).not.toHaveBeenCalled();
    expect(screen.queryByTestId('edit-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lunch-0')?.tagName).not.toBe('TEXTAREA');
  });

  it('entering edit mode shows one save/cancel and hides the pencil', async () => {
    await renderHome([]);
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    expect(screen.getAllByTestId('edit-save')).toHaveLength(1);
    expect(screen.getAllByTestId('edit-cancel')).toHaveLength(1);
    expect(screen.queryByTestId('edit-pencil')).not.toBeInTheDocument();
  });
});
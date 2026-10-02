import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MenuRepository } from '../data/MenuRepository';
import { mergeWeek } from '../data/xlsxWorkbook';
import type { MenuRow, WeekMenu } from '../domain/types';
import {
  parseIso, previousYearWeekStart, toDisplay, toIso, toIsoWeekValue, weekMenuFor,
  weekRangeLabel, weekStartForOffset, weekStartFromIsoWeekValue,
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

  it('prefills from the current week when it already has saved meals', async () => {
    const current = weekMenuFor(curStart);
    current.days[0].lunch = 'Polenta e formaggio';
    current.days[1].dinner = 'Tortino';
    await renderHome(weekRows(current));
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    expect((screen.getByTestId('lunch-0') as HTMLTextAreaElement).value).toBe('Polenta e formaggio');
    expect((screen.getByTestId('dinner-1') as HTMLTextAreaElement).value).toBe('Tortino');
  });

  it('keeps the edited week on screen while a draft is open', async () => {
    await renderHome([]);
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    const rangeBeforeEdit = screen.getByTestId('week-range').textContent;
    fireEvent.click(screen.getByTestId('next-week'));
    expect(screen.getByTestId('week-range').textContent).toBe(rangeBeforeEdit);
    expect(screen.getByTestId('day-date-0').textContent).toBe(
      toDisplay(parseIso(weekMenuFor(curStart).days[0].date)),
    );
  });

  it('dismisses the confirmation toast on its own', async () => {
    await renderHome([]);
    fireEvent.click(screen.getByTestId('edit-pencil'));
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByTestId('edit-save'));
      await act(async () => {});
      expect(screen.getByTestId('toast')).toHaveTextContent('Menù salvato');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('entering edit mode shows one save/cancel and hides the pencil', async () => {
    await renderHome([]);
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    expect(screen.getAllByTestId('edit-save')).toHaveLength(1);
    expect(screen.getAllByTestId('edit-cancel')).toHaveLength(1);
    expect(screen.queryByTestId('edit-pencil')).not.toBeInTheDocument();
  });
});

describe('Home week picker', () => {
  it('reflects the shown week and jumps to any selected week', async () => {
    await renderHome();
    const picker = screen.getByTestId('week-picker');
    expect((picker as HTMLInputElement).value).toBe(toIsoWeekValue(toIso(weekStartForOffset(0))));
    fireEvent.change(picker, { target: { value: '2027-W03' } });
    expect(screen.getByTestId('week-range').textContent).toBe(
      weekRangeLabel(weekStartFromIsoWeekValue('2027-W03') as string),
    );
  });

  it('stays in sync with the prev/next arrows', async () => {
    await renderHome();
    fireEvent.click(screen.getByTestId('next-week'));
    expect((screen.getByTestId('week-picker') as HTMLInputElement).value).toBe(
      toIsoWeekValue(toIso(weekStartForOffset(1))),
    );
    fireEvent.click(screen.getByTestId('prev-week'));
    expect((screen.getByTestId('week-picker') as HTMLInputElement).value).toBe(
      toIsoWeekValue(toIso(weekStartForOffset(0))),
    );
  });

  it('lets the user open weeks far in the past without saved data', async () => {
    await renderHome();
    fireEvent.change(screen.getByTestId('week-picker'), { target: { value: '2020-W05' } });
    expect(screen.getByTestId('week-range').textContent).toBe(
      weekRangeLabel(weekStartFromIsoWeekValue('2020-W05') as string),
    );
    expect(screen.getAllByTestId(/^lunch-\d$/)).toHaveLength(7);
  });

  it('is disabled while editing', async () => {
    await renderHome([]);
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    expect(screen.getByTestId('week-picker')).toBeDisabled();
  });

  it('ignores an empty picker value without navigating', async () => {
    await renderHome();
    const before = screen.getByTestId('week-range').textContent;
    fireEvent.change(screen.getByTestId('week-picker'), { target: { value: '' } });
    expect(screen.getByTestId('week-range').textContent).toBe(before);
  });

  it('opens the native picker when the week label is clicked', async () => {
    const showPicker = vi.fn();
    (HTMLInputElement.prototype as unknown as { showPicker: () => void }).showPicker = showPicker;
    await renderHome();
    fireEvent.click(screen.getByTestId('week-range'));
    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('does not open the picker while editing', async () => {
    const showPicker = vi.fn();
    (HTMLInputElement.prototype as unknown as { showPicker: () => void }).showPicker = showPicker;
    await renderHome([]);
    await userEvent.click(await screen.findByTestId('edit-pencil'));
    fireEvent.click(screen.getByTestId('week-range'));
    expect(showPicker).not.toHaveBeenCalled();
  });
});
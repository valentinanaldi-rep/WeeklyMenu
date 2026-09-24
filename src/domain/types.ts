export interface DayMenu {
  dayName: string;
  date: string;
  lunch: string;
  dinner: string;
}

export interface WeekMenu {
  weekStart: string;
  days: DayMenu[];
}

export interface MenuRow {
  weekStart: string;
  dayName: string;
  date: string;
  lunch: string;
  dinner: string;
}
import type { MenuRow, WeekMenu } from '../domain/types';
import type { FileGateway } from './FileGateway';
import { mergeWeek, parseWorkbook, serializeWorkbook } from './xlsxWorkbook';

export interface MenuRepository {
  loadWeeks(): Promise<MenuRow[]>;
  saveWeek(week: WeekMenu): Promise<void>;
}

export class XlsxMenuRepository implements MenuRepository {
  constructor(private readonly gateway: FileGateway) {}

  async loadWeeks(): Promise<MenuRow[]> {
    const buffer = await this.gateway.read();
    return buffer === null ? [] : parseWorkbook(buffer);
  }

  async saveWeek(week: WeekMenu): Promise<void> {
    const buffer = await this.gateway.read();
    const rows = buffer === null ? [] : parseWorkbook(buffer);
    const merged = mergeWeek(rows, week);
    await this.gateway.write(serializeWorkbook(merged));
  }
}
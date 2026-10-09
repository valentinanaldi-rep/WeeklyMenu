import type { MenuRow, WeekMenu } from '../domain/types';
import type { FileGateway } from './FileGateway';
import { emptyWorkbook, mergeWeek, parseWorkbook, serializeWorkbook } from './xlsxWorkbook';

export interface MenuRepository {
  loadWeeks(): Promise<MenuRow[]>;
  saveWeek(week: WeekMenu): Promise<void>;
  exportWorkbook(): Promise<ArrayBuffer>;
  importWorkbook(buffer: ArrayBuffer): Promise<void>;
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

  async exportWorkbook(): Promise<ArrayBuffer> {
    const buffer = await this.gateway.read();
    return buffer ?? emptyWorkbook();
  }

  async importWorkbook(buffer: ArrayBuffer): Promise<void> {
    let rows: MenuRow[];
    try {
      rows = parseWorkbook(buffer);
    } catch {
      throw new Error('Il file selezionato non è un workbook valido');
    }
    if (rows.length === 0) {
      throw new Error('Il file selezionato non contiene dati di menù');
    }
    await this.gateway.write(buffer);
  }
}
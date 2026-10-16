import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { saveWorkbookToDisk } from './exportWorkbook';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE', Documents: 'DOCUMENTS', Data: 'DATA' },
  Filesystem: { writeFile: vi.fn(async () => ({ uri: 'file:///cache/file.xlsx' })) },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn(async () => ({})) },
}));

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type UrlWithObjectUrl = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

describe('saveWorkbookToDisk', () => {
  const buffer = new Uint8Array([1, 2, 3]).buffer as ArrayBuffer;

  beforeEach(() => {
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(false);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    (URL as unknown as UrlWithObjectUrl).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as UrlWithObjectUrl).revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('downloads via anchor when no picker is available', async () => {
    const result = await saveWorkbookToDisk(buffer, 'file.xlsx');
    expect(result).toBe('saved');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe(XLSX_MIME);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it('uses showSaveFilePicker when available and writes the bytes', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const createWritable = vi.fn(async () => ({ write, close }));
    const pick = vi.fn(async () => ({ createWritable }));
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: pick });

    const result = await saveWorkbookToDisk(buffer, 'file.xlsx');
    expect(result).toBe('saved');
    expect(pick).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'file.xlsx' }));
    expect(write).toHaveBeenCalledWith(buffer);
    expect(close).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it('returns cancelled when the user aborts the picker', async () => {
    const pick = vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: pick });
    await expect(saveWorkbookToDisk(buffer, 'file.xlsx')).resolves.toBe('cancelled');
  });

  it('writes to the app cache and opens the share sheet on native', async () => {
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const result = await saveWorkbookToDisk(buffer, 'file.xlsx');

    expect(result).toBe('saved');
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'file.xlsx', directory: 'CACHE', recursive: true }),
    );
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['file:///cache/file.xlsx'] }),
    );
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
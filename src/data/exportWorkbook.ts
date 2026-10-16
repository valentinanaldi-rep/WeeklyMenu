import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type SaveResult = 'saved' | 'cancelled';

interface FileWritable {
  write(data: BufferSource): Promise<void>;
  close(): Promise<void>;
}

interface FilePickHandle {
  createWritable(): Promise<FileWritable>;
}

type ShowSaveFilePicker = (options: unknown) => Promise<FilePickHandle>;

function nativePicker(win: Window): ShowSaveFilePicker | undefined {
  const maybe = win as unknown as { showSaveFilePicker?: unknown };
  return typeof maybe.showSaveFilePicker === 'function'
    ? (maybe.showSaveFilePicker as ShowSaveFilePicker)
    : undefined;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function saveWorkbookToDisk(buffer: ArrayBuffer, filename: string): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    const base64 = arrayBufferToBase64(buffer);
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: filename,
      text: 'Esportazione DB WeeklyMenu',
      files: [uri],
      dialogTitle: 'Salva o condividi il DB',
    });
    return 'saved';
  }

  const picker = nativePicker(window);
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'Excel', accept: { [XLSX_MIME]: ['.xlsx'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
      throw err;
    }
  }

  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return 'saved';
}
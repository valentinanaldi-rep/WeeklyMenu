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

export async function saveWorkbookToDisk(buffer: ArrayBuffer, filename: string): Promise<SaveResult> {
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
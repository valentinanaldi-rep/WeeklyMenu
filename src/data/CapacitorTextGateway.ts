import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { TextFileGateway } from './TextFileGateway';

function listPath(key: string): string {
  return `liste/lista_${key}.txt`;
}

export class CapacitorTextGateway implements TextFileGateway {
  async readText(key: string): Promise<string | null> {
    const path = listPath(key);
    try {
      await Filesystem.stat({ path, directory: Directory.Data });
    } catch {
      return null;
    }
    const result = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
    return typeof result.data === 'string' ? result.data : await result.data.text();
  }

  async writeText(key: string, content: string): Promise<void> {
    await Filesystem.writeFile({
      path: listPath(key),
      directory: Directory.Data,
      data: content,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  async deleteText(key: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: listPath(key), directory: Directory.Data });
    } catch {
      // List already gone: deleting twice is not an error.
    }
  }
}

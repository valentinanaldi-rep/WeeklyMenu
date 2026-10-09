import { Directory, Filesystem } from '@capacitor/filesystem';
import type { FileGateway } from './FileGateway';

const PATH = 'menu.xlsx';

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(data: string): ArrayBuffer {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class CapacitorFileGateway implements FileGateway {
  async read(): Promise<ArrayBuffer | null> {
    try {
      await Filesystem.stat({ path: PATH, directory: Directory.Data });
    } catch {
      return null;
    }
    const result = await Filesystem.readFile({ path: PATH, directory: Directory.Data });
    if (typeof result.data !== 'string') {
      return await result.data.arrayBuffer();
    }
    return fromBase64(result.data);
  }

  async write(data: ArrayBuffer): Promise<void> {
    await Filesystem.writeFile({
      path: PATH,
      directory: Directory.Data,
      data: toBase64(data),
      recursive: true,
    });
  }
}

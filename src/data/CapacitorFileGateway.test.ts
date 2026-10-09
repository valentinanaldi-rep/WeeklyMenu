import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Filesystem } from '@capacitor/filesystem';
import { CapacitorFileGateway } from './CapacitorFileGateway';

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: {
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

const stat = vi.mocked(Filesystem.stat);
const readFile = vi.mocked(Filesystem.readFile);
const writeFile = vi.mocked(Filesystem.writeFile);

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

const existingFile = {
  name: 'menu.xlsx',
  type: 'file' as const,
  size: 3,
  mtime: 0,
  uri: 'file:///data/menu.xlsx',
};

describe('CapacitorFileGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the stored file back as an ArrayBuffer', async () => {
    stat.mockResolvedValue(existingFile);
    readFile.mockResolvedValue({ data: 'AQL6' });
    const gateway = new CapacitorFileGateway();
    const buffer = await gateway.read();
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(buffer!)).toEqual(new Uint8Array([1, 2, 250]));
    expect(readFile).toHaveBeenCalledWith({ path: 'menu.xlsx', directory: 'DATA' });
  });

  it('returns null when the file does not exist', async () => {
    stat.mockRejectedValue(new Error('File does not exist.'));
    const gateway = new CapacitorFileGateway();
    expect(await gateway.read()).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
  });

  it('propagates read failures when the file exists but cannot be read', async () => {
    stat.mockResolvedValue(existingFile);
    readFile.mockRejectedValue(new Error('permission denied'));
    const gateway = new CapacitorFileGateway();
    await expect(gateway.read()).rejects.toThrow('permission denied');
  });

  it('writes the buffer as base64 with recursive creation', async () => {
    writeFile.mockResolvedValue({ uri: 'file:///data/menu.xlsx' });
    const gateway = new CapacitorFileGateway();
    await gateway.write(new Uint8Array([7, 8, 255]).buffer);
    expect(writeFile).toHaveBeenCalledTimes(1);
    const arg = writeFile.mock.calls[0][0];
    expect(arg.path).toBe('menu.xlsx');
    expect(arg.directory).toBe('DATA');
    expect(arg.recursive).toBe(true);
    expect(fromBase64(arg.data as string)).toEqual(new Uint8Array([7, 8, 255]));
  });
});

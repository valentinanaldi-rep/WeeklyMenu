import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Filesystem } from '@capacitor/filesystem';
import { CapacitorTextGateway } from './CapacitorTextGateway';

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

const stat = vi.mocked(Filesystem.stat);
const readFile = vi.mocked(Filesystem.readFile);
const writeFile = vi.mocked(Filesystem.writeFile);
const deleteFile = vi.mocked(Filesystem.deleteFile);

const week = '2026-09-21';
const path = `liste/lista_${week}.txt`;
const existingFile = { name: path, type: 'file' as const, size: 5, mtime: 0, uri: 'file:///data/liste' };

describe('CapacitorTextGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the stored text as UTF8', async () => {
    stat.mockResolvedValue(existingFile);
    readFile.mockResolvedValue({ data: 'nota\npane\nlatte' });
    const gateway = new CapacitorTextGateway();
    expect(await gateway.readText(week)).toBe('nota\npane\nlatte');
    expect(readFile).toHaveBeenCalledWith({ path, directory: 'DATA', encoding: 'utf8' });
  });

  it('returns null when there is no list for the week', async () => {
    stat.mockRejectedValue(new Error('File does not exist.'));
    const gateway = new CapacitorTextGateway();
    expect(await gateway.readText(week)).toBeNull();
    expect(readFile).not.toHaveBeenCalled();
  });

  it('propagates read failures when the file exists', async () => {
    stat.mockResolvedValue(existingFile);
    readFile.mockRejectedValue(new Error('boom'));
    const gateway = new CapacitorTextGateway();
    await expect(gateway.readText(week)).rejects.toThrow('boom');
  });

  it('writes the text as UTF8 creating parent folders', async () => {
    writeFile.mockResolvedValue({ uri: 'file:///data/liste' });
    const gateway = new CapacitorTextGateway();
    await gateway.writeText(week, 'pane');
    expect(writeFile).toHaveBeenCalledWith({
      path,
      directory: 'DATA',
      data: 'pane',
      encoding: 'utf8',
      recursive: true,
    });
  });

  it('deletes the list file', async () => {
    deleteFile.mockResolvedValue(undefined as never);
    const gateway = new CapacitorTextGateway();
    await gateway.deleteText(week);
    expect(deleteFile).toHaveBeenCalledWith({ path, directory: 'DATA' });
  });

  it('tolerates deleting a list that is not there', async () => {
    deleteFile.mockRejectedValue(new Error('File does not exist.'));
    const gateway = new CapacitorTextGateway();
    await expect(gateway.deleteText(week)).resolves.toBeUndefined();
  });
});

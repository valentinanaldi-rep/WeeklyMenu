import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MenuRow } from '../domain/types';
import { DevHttpFileGateway } from './DevHttpFileGateway';
import { createFileMiddleware } from './viteDevFilePlugin';
import { parseWorkbook, serializeWorkbook } from './xlsxWorkbook';

const rows: MenuRow[] = [
  { weekStart: '2026-02-23', dayName: 'Lunedì', date: '2026-02-23', lunch: 'Pasta', dinner: 'Pizza' },
  { weekStart: '2026-02-23', dayName: 'Martedì', date: '2026-02-24', lunch: 'Riso', dinner: '' },
];

describe('dev file server', () => {
  const servers: ReturnType<typeof createServer>[] = [];
  const dirs: string[] = [];

  afterEach(() => {
    for (const s of servers.splice(0)) {
      s.close();
    }
    for (const d of dirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  async function start(): Promise<{ port: number; file: string }> {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-'));
    dirs.push(dir);
    const file = path.join(dir, 'menu.xlsx');
    const handler = createFileMiddleware(file) as unknown as RequestListener;
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    return { port, file };
  }

  it('GET creates the file with headers when missing', async () => {
    const { port, file } = await start();
    const res = await fetch(`http://localhost:${port}/api/menu`);
    expect(res.ok).toBe(true);
    expect(parseWorkbook(await res.arrayBuffer())).toEqual([]);
    expect(existsSync(file)).toBe(true);
  });

  it('POST writes rows and GET returns them', async () => {
    const { port } = await start();
    const post = await fetch(`http://localhost:${port}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: serializeWorkbook(rows),
    });
    expect(post.ok).toBe(true);
    const get = await fetch(`http://localhost:${port}/api/menu`);
    expect(parseWorkbook(await get.arrayBuffer())).toEqual(rows);
  });

  it('POST overwrites previous content', async () => {
    const { port } = await start();
    await fetch(`http://localhost:${port}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: serializeWorkbook(rows),
    });
    await fetch(`http://localhost:${port}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: serializeWorkbook([]),
    });
    const get = await fetch(`http://localhost:${port}/api/menu`);
    expect(parseWorkbook(await get.arrayBuffer())).toEqual([]);
  });

  it('DevHttpFileGateway reads and writes through the server', async () => {
    const { port } = await start();
    const gateway = new DevHttpFileGateway(`http://localhost:${port}`);
    const initial = await gateway.read();
    expect(initial).not.toBeNull();
    await gateway.write(serializeWorkbook(rows));
    const after = await gateway.read();
    expect(parseWorkbook(after as ArrayBuffer)).toEqual(rows);
  });
});
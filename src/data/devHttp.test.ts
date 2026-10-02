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

  async function start(): Promise<{ port: number; file: string; listsDir: string }> {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-'));
    dirs.push(dir);
    const file = path.join(dir, 'menu.xlsx');
    const handler = createFileMiddleware(file, dir) as unknown as RequestListener;
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    return { port, file, listsDir: dir };
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

  describe('text list endpoint', () => {
    it('returns 404 for a missing list', async () => {
      const { port } = await start();
      const res = await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`);
      expect(res.status).toBe(404);
    });

    it('saves and reads back a list for a given week', async () => {
      const { port } = await start();
      const put = await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: 'Menù della settimana: x\n\nLISTA DELLA SPESA\n- farina',
      });
      expect(put.ok).toBe(true);
      const get = await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`);
      expect(get.status).toBe(200);
      expect(await get.text()).toContain('- farina');
    });

    it('keeps lists of different weeks separate', async () => {
      const { port } = await start();
      await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`, { method: 'PUT', body: 'settimana A' });
      await fetch(`http://localhost:${port}/api/lista?week=2026-09-28`, { method: 'PUT', body: 'settimana B' });
      const a = await (await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`)).text();
      const b = await (await fetch(`http://localhost:${port}/api/lista?week=2026-09-28`)).text();
      expect(a).toBe('settimana A');
      expect(b).toBe('settimana B');
    });

    it('rejects invalid or non-Monday week keys with 400', async () => {
      const { port } = await start();
      for (const bad of ['abc', '2026-02-30', '2026-09-20', '2026-09-21T00:00:00', '']) {
        const res = await fetch(`http://localhost:${port}/api/lista?week=${encodeURIComponent(bad)}`);
        expect(res.status).toBe(400);
      }
    });

    it('DELETE removes the list file and the follow-up GET is 404', async () => {
      const { port, listsDir } = await start();
      await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`, { method: 'PUT', body: 'da cancellare' });
      const listFile = path.join(listsDir, 'lista_2026-09-21.txt');
      expect(existsSync(listFile)).toBe(true);
      const del = await fetch(`http://localhost:${port}/api/lista?week=2026-09-21`, { method: 'DELETE' });
      expect(del.ok).toBe(true);
      expect(existsSync(listFile)).toBe(false);
    });

    it('DELETE is idempotent and still rejects invalid weeks with 400', async () => {
      const { port } = await start();
      const delMissing = await fetch(`http://localhost:${port}/api/lista?week=2026-09-28`, { method: 'DELETE' });
      expect(delMissing.ok).toBe(true);
      const delInvalid = await fetch(`http://localhost:${port}/api/lista?week=abc`, { method: 'DELETE' });
      expect(delInvalid.status).toBe(400);
    });

    it('still serves the menu endpoints', async () => {
      const { port } = await start();
      const res = await fetch(`http://localhost:${port}/api/menu`);
      expect(res.ok).toBe(true);
    });
  });
});
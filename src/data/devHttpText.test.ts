import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DevHttpTextGateway } from './DevHttpTextGateway';
import { createFileMiddleware } from './viteDevFilePlugin';

describe('DevHttpTextGateway', () => {
  const servers: ReturnType<typeof createServer>[] = [];
  const dirs: string[] = [];
  let port = 0;

  afterEach(() => {
    for (const s of servers.splice(0)) s.close();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  async function start(): Promise<number> {
    const dir = mkdtempSync(path.join(tmpdir(), 'wm-text-'));
    dirs.push(dir);
    const file = path.join(dir, 'menu.xlsx');
    const handler = createFileMiddleware(file, dir) as unknown as RequestListener;
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    return (server.address() as AddressInfo).port;
  }

  it('returns null for a key that has no file', async () => {
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    expect(await gw.readText('2026-09-21')).toBeNull();
  });

  it('reads back what it wrote', async () => {
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    expect(await gw.readText('2026-09-21')).toBeNull();
    await gw.writeText('2026-09-21', 'contenuto lista');
    expect(await gw.readText('2026-09-21')).toBe('contenuto lista');
  });

  it('rejects on server errors (invalid key)', async () => {
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    await expect(gw.writeText('2026-02-30', 'x')).rejects.toThrow();
  });

  it('deletes a list previously saved', async () => {
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    await gw.writeText('2026-09-21', 'contenuto lista');
    await gw.deleteText('2026-09-21');
    expect(await gw.readText('2026-09-21')).toBeNull();
  });

  it('rejects when deleting with an invalid key', async () => {
    port = await start();
    const gw = new DevHttpTextGateway(`http://localhost:${port}`);
    await expect(gw.deleteText('2026-02-30')).rejects.toThrow();
  });
});
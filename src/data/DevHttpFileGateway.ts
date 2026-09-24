import type { FileGateway } from './FileGateway';

export class DevHttpFileGateway implements FileGateway {
  constructor(private readonly baseUrl: string = '') {}

  async read(): Promise<ArrayBuffer | null> {
    const res = await fetch(`${this.baseUrl}/api/menu`);
    if (!res.ok) {
      throw new Error(`Failed to read menu: ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    return buffer.byteLength === 0 ? null : buffer;
  }

  async write(data: ArrayBuffer): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data,
    });
    if (!res.ok) {
      throw new Error(`Failed to save menu: ${res.status}`);
    }
  }
}
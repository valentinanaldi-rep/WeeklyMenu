import type { TextFileGateway } from './TextFileGateway';

export class DevHttpTextGateway implements TextFileGateway {
  constructor(private readonly baseUrl: string = '') {}

  async readText(key: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/api/lista?week=${encodeURIComponent(key)}`);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`Failed to read list: ${res.status}`);
    }
    return res.text();
  }

  async writeText(key: string, content: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/lista?week=${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: content,
    });
    if (!res.ok) {
      throw new Error(`Failed to write list: ${res.status}`);
    }
  }
}
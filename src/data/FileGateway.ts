export interface FileGateway {
  read(): Promise<ArrayBuffer | null>;
  write(data: ArrayBuffer): Promise<void>;
}

export class InMemoryFileGateway implements FileGateway {
  private data: ArrayBuffer | null;

  constructor(initial?: ArrayBuffer | null) {
    this.data = initial ?? null;
  }

  async read(): Promise<ArrayBuffer | null> {
    return this.data;
  }

  async write(data: ArrayBuffer): Promise<void> {
    this.data = data;
  }
}
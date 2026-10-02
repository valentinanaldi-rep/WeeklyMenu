export interface TextFileGateway {
  readText(key: string): Promise<string | null>;
  writeText(key: string, content: string): Promise<void>;
}
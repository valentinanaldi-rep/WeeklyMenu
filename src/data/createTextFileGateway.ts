import { Capacitor } from '@capacitor/core';
import { CapacitorTextGateway } from './CapacitorTextGateway';
import { DevHttpTextGateway } from './DevHttpTextGateway';
import type { TextFileGateway } from './TextFileGateway';

export function createTextFileGateway(): TextFileGateway {
  return Capacitor.isNativePlatform() ? new CapacitorTextGateway() : new DevHttpTextGateway();
}

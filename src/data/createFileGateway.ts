import { Capacitor } from '@capacitor/core';
import { CapacitorFileGateway } from './CapacitorFileGateway';
import { DevHttpFileGateway } from './DevHttpFileGateway';
import type { FileGateway } from './FileGateway';

export function createFileGateway(): FileGateway {
  return Capacitor.isNativePlatform() ? new CapacitorFileGateway() : new DevHttpFileGateway();
}

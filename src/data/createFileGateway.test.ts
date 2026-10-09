import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { createFileGateway } from './createFileGateway';
import { DevHttpFileGateway } from './DevHttpFileGateway';
import { CapacitorFileGateway } from './CapacitorFileGateway';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

const isNativePlatform = vi.mocked(Capacitor.isNativePlatform);

describe('createFileGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the Capacitor filesystem gateway on native platforms', () => {
    isNativePlatform.mockReturnValue(true);
    expect(createFileGateway()).toBeInstanceOf(CapacitorFileGateway);
  });

  it('returns the dev HTTP gateway on the web', () => {
    isNativePlatform.mockReturnValue(false);
    expect(createFileGateway()).toBeInstanceOf(DevHttpFileGateway);
  });
});

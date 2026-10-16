import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { createTextFileGateway } from './createTextFileGateway';
import { DevHttpTextGateway } from './DevHttpTextGateway';
import { CapacitorTextGateway } from './CapacitorTextGateway';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

const isNativePlatform = vi.mocked(Capacitor.isNativePlatform);

describe('createTextFileGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the Capacitor filesystem gateway on native platforms', () => {
    isNativePlatform.mockReturnValue(true);
    expect(createTextFileGateway()).toBeInstanceOf(CapacitorTextGateway);
  });

  it('returns the dev HTTP gateway on the web', () => {
    isNativePlatform.mockReturnValue(false);
    expect(createTextFileGateway()).toBeInstanceOf(DevHttpTextGateway);
  });
});

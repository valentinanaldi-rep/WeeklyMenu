import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import { printCurrentPage } from './printMenu';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));

vi.mock('@capgo/capacitor-printer', () => ({
  Printer: { printWebView: vi.fn(async () => {}) },
}));

const isNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const printWebView = vi.mocked(Printer.printWebView);

describe('printCurrentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
  });

  it('uses the native print dialog on a device', async () => {
    isNativePlatform.mockReturnValue(true);
    await printCurrentPage('Menù settimanale');
    expect(printWebView).toHaveBeenCalledWith({ name: 'Menù settimanale' });
    expect(window.print).not.toHaveBeenCalled();
  });

  it('uses the browser print dialog on the web', async () => {
    isNativePlatform.mockReturnValue(false);
    await printCurrentPage('Menù settimanale');
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(printWebView).not.toHaveBeenCalled();
  });
});

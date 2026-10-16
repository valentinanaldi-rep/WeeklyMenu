import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';

export async function printCurrentPage(name: string = 'Weekly Menu'): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Printer.printWebView({ name });
    return;
  }
  window.print();
}

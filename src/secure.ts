// غلاف JS لوحدة FLAG_SECURE الأصلية
import { NativeModules } from 'react-native';

const { SecureFlag } = NativeModules;

export function enableSecureFlag(): void {
  try {
    SecureFlag?.enable();
  } catch {}
}

export function disableSecureFlag(): void {
  try {
    SecureFlag?.disable();
  } catch {}
}

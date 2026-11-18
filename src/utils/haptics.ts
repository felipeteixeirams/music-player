/**
 * Safe haptic feedback utility for mobile touch interactions in PWA and browsers.
 * Silently succeeds without error on unsupported devices.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'selection' = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case 'selection':
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'success':
        navigator.vibrate([10, 30, 15]);
        break;
    }
  } catch {
    // Silently ignore if device/browser permissions disallow vibration
  }
}

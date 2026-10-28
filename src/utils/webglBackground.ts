/**
 * Whether the login screen may draw its animated WebGL glow. Not on Android: a person on a Redmi (Chrome) saw the whole
 * screen go black right after asking for the code, on the screen that layers a WebGL canvas (with a blend mode) under a
 * blurred card. Hypothesis: that mix breaks the compositor of low-end Android GPUs; it was never reproduced, so the
 * phones where it is not verified get the static CSS glow, which looks the same, only still.
 */
export const allowsWebGlBackground = (userAgent: string): boolean => !/Android/i.test(userAgent);

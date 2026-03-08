export function waitForInteractions() {
  return new Promise<void>((resolve) => {
    if (typeof globalThis.requestIdleCallback === "function") {
      globalThis.requestIdleCallback(() => resolve(), { timeout: 1200 });
      return;
    }
    setTimeout(resolve, 0);
  });
}

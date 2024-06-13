export function sleepSync(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const now = Date.now();
    sleepLoop();

    function sleepLoop() {
      if (Date.now() - now > ms) resolve();
      else queueMicrotask(sleepLoop);
    }
  });
}

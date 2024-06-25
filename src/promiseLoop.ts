interface Options {
  pollingInterval?: number;
  whenCancel?: (data?: any) => boolean;
}

export function promiseLoop(promiseFn, options?: Options) {
  const { pollingInterval = 1000, whenCancel = (data?: any) => true } = options || {};
  let nextReject;
  let timer;

  function run(...args) {
    return loopRun(...args);
  }

  function cancel() {
    clearTimeout(timer);
    if (nextReject) nextReject(new Error('canceled'));
  }

  return { run, cancel };

  function loopRun(...args) {
    return promiseFn(...args).then((data) => {
      clearTimeout(timer);

      if (whenCancel(data)) return data;

      return new Promise((resolve, reject) => {
        nextReject = reject;
        timer = setTimeout(() => {
          loopRun(...args)
            .then(resolve)
            .catch(reject);
        }, pollingInterval);
      });
    });
  }
}

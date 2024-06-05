import isEqual from 'lodash/isEqual';

export function promiseHijack(promiseFn) {
  const pendingMap = new Map(); // [arguments => [{ resolve, reject }]]

  return function () {
    let [targetArguments, targetValue] =
      Array.from(pendingMap.entries()).find(([key]) => isEqual(key, arguments)) || [];

    if (targetArguments) {
      return new Promise((resolve, reject) => targetValue.push({ resolve, reject }));
    }

    return new Promise((resolve, reject) => {
      pendingMap.set(arguments, [{ resolve, reject }]);
      promiseFn
        .apply(null, arguments)
        .then(
          (value) => {
            const pending = pendingMap.get(arguments);
            pending.forEach(({ resolve }) => resolve(value));
          },
          (error) => {
            const pending = pendingMap.get(arguments);
            pending.forEach(({ reject }) => reject(error));
          }
        )
        .finally(() => {
          pendingMap.delete(arguments);
        });
    });
  };
}

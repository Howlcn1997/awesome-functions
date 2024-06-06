import { isEqual } from 'lodash';
interface Pending {
  resolve: (value: unknown) => void;
  reject: (value: unknown) => void;
}

export function promiseHijack(promiseFn: (...args: any[]) => Promise<any>) {
  const pendingMap = new Map<any[], Pending[]>(); // [arguments => [{ resolve, reject }]]

  return function (...args: any[]) {
    let [targetArguments, targetValue] = Array.from(pendingMap.entries()).find(([key]) => isEqual(key, args)) || [];

    if (targetArguments && targetValue) {
      return new Promise((resolve, reject) => targetValue.push({ resolve, reject }));
    }

    return new Promise((resolve, reject) => {
      pendingMap.set(args, [{ resolve, reject }]);
      promiseFn
        .apply(null, args as any)
        .then(
          (value) => {
            const pending = pendingMap.get(args) as Pending[];
            pending.forEach(({ resolve }) => resolve(value));
          },
          (error) => {
            const pending = pendingMap.get(args) as Pending[];
            pending.forEach(({ reject }) => reject(error));
          }
        )
        .finally(() => {
          pendingMap.delete(args);
        });
    });
  };
}

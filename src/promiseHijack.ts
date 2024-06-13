import { isEqual as lodashIsEqual } from 'lodash';

interface Pending {
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface Options {
  isEqual: (prev: any, cur: any) => boolean;
}

export function promiseHijack(promiseFn: (...args: any[]) => Promise<any>, options: Options = { isEqual: lodashIsEqual }) {
  const pendingMap = new Map<any[], Pending[]>(); // [arguments => [{ resolve, reject }]]

  return function (...args: any[]) {
    let [targetArguments, targetValue] = Array.from(pendingMap.entries()).find(([key]) => options.isEqual(key, args)) || [];

    if (targetArguments && targetValue) {
      return new Promise((resolve, reject) => targetValue.push({ resolve, reject }));
    }

    return new Promise((resolve, reject) => {
      pendingMap.set(args, [{ resolve, reject }]);
      promiseFn.apply(null, args as any).then(
        (value) => {
          (pendingMap.get(args) as Pending[]).forEach(({ resolve }) => resolve(value));
          pendingMap.delete(args);
        },
        (error) => {
          (pendingMap.get(args) as Pending[]).forEach(({ reject }) => reject(error));
          pendingMap.delete(args);
        }
      );
    });
  };
}

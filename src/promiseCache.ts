import { isEqual, debounce } from 'lodash';
import { promiseHijack } from './promiseHijack';

const UNTERMINATED = 0;
const TERMINATED = 1;
const ERRORED = 2;

const NORMAL = 'normal';
const CACHE_FIRST = 'cache-first';

function createCacheStoreValue(e: number) {
  return {
    s: UNTERMINATED, // status
    v: undefined, // value
    e, // expire
  };
}

interface Options {
  ttl?: number;
  gcDebounce?: number;
  mode?: string;
  cacheRejected?: (...args: any[]) => boolean;
  cacheFulfilled?: (...args: any[]) => boolean;
}

/**
 * @param {Function} promiseFn
 * @param {Number} options.ttl 缓存有效时长（ms），默认0，当为Infinity时永久缓存
 * @param {String} options.mode 缓存执行策略 默认normal
 *    - normal:
 *      - 若缓存不存在或缓存过期，则等待promiseFn执行完成后返回结果 并 缓存
 *      - 若缓存存在且未过期，则直接返回缓存结果
 *    - cache-first:
 *      - 若缓存不存在，则等待promiseFn执行完成后返回结果 并 缓存
 *      - 若缓存存在且未过期，则直接返回缓存结果
 *      - 若缓存存在但已过期，先返回缓存结果，再等待promiseFn执行完成后更新缓存
 * @param {Number} options.gcThrottle 垃圾回收节流时间（ms），默认600000，当为Infinity时不进行垃圾回收
 * @param {Function} options.cacheFulfilled 是否缓存正常结果，默认true (...arguments) => boolean
 * @param {Function} options.cacheRejected 是否缓存异常结果，默认true (...arguments) => boolean
 * @returns
 */
export function promiseCache(promiseFn: (...args: any[]) => Promise<any>, options: Options = {}) {
  const { ttl = 0, gcDebounce = 600000, mode = NORMAL, cacheRejected = () => true, cacheFulfilled = () => true } = options;

  const cacheStore = new Map();

  const callGC = debounce(() => {
    const now = Date.now();
    for (const [key, val] of cacheStore.entries()) {
      const isExpired = val.e < now;
      if (isExpired) cacheStore.delete(key);
    }
  }, gcDebounce);

  return promiseHijack(function (...thisArgs: any[]) {
    if (gcDebounce !== Infinity) queueMicrotask(callGC);

    const now = Date.now();
    const expireTime = ttl === Infinity ? Infinity : now + ttl;

    const [currentArgs, result] = Array.from(cacheStore.entries()).find(([args]) => isEqual(args, thisArgs)) || [thisArgs, createCacheStoreValue(expireTime)];

    if (result.s === UNTERMINATED) {
      return runAndSetCache(currentArgs);
    }

    const isExpired = result.e < now;
    if (isExpired && mode === NORMAL) {
      return runAndSetCache(currentArgs);
    }
    if (isExpired && mode === CACHE_FIRST) {
      runAndSetCache(currentArgs);
    }

    if (result.s === TERMINATED) return Promise.resolve(result.v);
    // if (result.s === ERRORED)
    return Promise.reject(result.v);

    async function runAndSetCache(selfArgs: IArguments) {
      result.e = expireTime;
      return promiseFn.apply(null, selfArgs as any).then(
        (value: any) => {
          result.v = value;
          result.s = TERMINATED;
          if (cacheFulfilled(...selfArgs)) cacheStore.set(selfArgs, result);
          return value;
        },
        (error: any) => {
          result.v = error;
          result.s = ERRORED;
          if (cacheRejected(...selfArgs)) cacheStore.set(selfArgs, result);
          throw error;
        }
      );
    }
  });
}

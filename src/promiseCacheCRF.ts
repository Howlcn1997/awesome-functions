import { isEqual, debounce } from 'lodash';
import { promiseHijack } from './promiseHijack';

const UNTERMINATED = 0;
const TERMINATED = 1;
const ERRORED = 2;

function createCacheStoreValue(e) {
  return {
    s: UNTERMINATED, // status
    v: undefined, // value
    e, // expire
  };
}

/**
 * 缓存优先函数
 * - 若缓存不存在，则等待promiseFn执行完成后返回结果 并 缓存
 * - 若缓存存在且未过期，则直接返回缓存结果
 * - 若缓存存在但已过期，先返回缓存结果，再等待promiseFn执行完成后更新缓存
 *
 * @param {Function} promiseFn
 * @param {Number} options.ttl 缓存有效时长（ms），默认0，当为Infinity时永久缓存
 * @param {Number} options.gcThrottle 垃圾回收节流时间（ms），默认600000，当为Infinity时不进行垃圾回收
 * @param {Function} options.cacheFulfilled 是否缓存正常结果，默认true (...arguments) => boolean
 * @param {Function} options.cacheRejected 是否缓存异常结果，默认true (...arguments) => boolean
 * @returns
 */
export function promiseCacheCFR(promiseFn, options) {
  const { ttl = 0, gcDebounce = 600000, cacheRejected = () => true, cacheFulfilled = () => true } = options || {};

  const cacheStore = new Map();

  const callGC = debounce(() => {
    const now = Date.now();
    for (const [key, val] of cacheStore.entries()) {
      const isExpired = val.e < now;
      if (isExpired) cacheStore.delete(key);
    }
  }, gcDebounce);

  return promiseHijack(function () {
    if (gcDebounce !== Infinity) queueMicrotask(callGC);

    const now = Date.now();
    const expireTime = ttl === Infinity ? Infinity : now + ttl;

    const [args, result] = Array.from(cacheStore.entries()).find(([args]) => isEqual(args, arguments)) || [
      arguments,
      createCacheStoreValue(expireTime),
    ];

    if (result.s === UNTERMINATED) {
      return runAndSetCache(args);
    }

    const isExpired = result.e < now;
    if (isExpired) {
      runAndSetCache(args);
    }

    if (result.s === TERMINATED) return Promise.resolve(result.v);
    if (result.s === ERRORED) return Promise.reject(result.v);

    async function runAndSetCache(selfArgs) {
      result.e = expireTime;
      return promiseFn.apply(null, selfArgs).then(
        value => {
          result.v = value;
          result.s = TERMINATED;
          if (cacheFulfilled(...selfArgs)) cacheStore.set(selfArgs, result);
          return value;
        },
        error => {
          result.v = error;
          result.s = ERRORED;
          if (cacheRejected(...selfArgs)) cacheStore.set(selfArgs, result);
          throw error;
        }
      );
    }
  });
}
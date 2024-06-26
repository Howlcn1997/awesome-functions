import { isEqual, throttle } from 'lodash';
import { promiseHijack } from './promiseHijack';

enum Status {
  UNTERMINATED = 0,
  TERMINATED = 1,
  ERRORED = 2,
}

interface CacheNode {
  s: Status;
  v: any; // value
  e: number; // 过期时间
  swr: number; // 缓存过期容忍时长
  sie: number; // 更新错误容忍时长

  _maxAge: number; // 缓存有效时长原始配置
  _swr: number; // 缓存过期容忍时长原始配置
  _sie: number; // 更新错误容忍时长原始配置
}

function createCacheNode(maxAge: number, swr: number = 0, sie: number = 0): CacheNode {
  const now = Date.now();
  return {
    s: Status.UNTERMINATED, // status
    v: undefined,
    e: now + maxAge, // expire
    swr: 0,
    sie: 0,

    _maxAge: maxAge,
    _swr: swr,
    _sie: sie,
  };
}

interface Options {
  maxAge?: number;
  swr?: number;
  sie?: number;
  globalCache?: boolean;
  gcThrottle?: number;

  cacheFulfilled?: (args: any[], value: any) => boolean;
  cacheRejected?: (args: any[], error: any) => boolean;
  argsEqual?: (a: any[], b: any[]) => boolean;
  storeCreator?: (promiseFn: PromiseFn, globalCache?: boolean) => any;
}

type PromiseFn = (...args: any[]) => Promise<any>;

const globalCacheStore = new Map();

function createCacheStore(promiseFn?: PromiseFn, globalCache?: boolean): Map<any, CacheNode> {
  if (globalCache) {
    let cacheStore = globalCacheStore.get(promiseFn);
    if (cacheStore) return cacheStore;

    cacheStore = new Map<any, CacheNode>();
    globalCacheStore.set(promiseFn, cacheStore);
    return cacheStore;
  }
  return new Map<any, CacheNode>();
}

/**
 * @param {Function} promiseFn
 * @param {Number} options.maxAge 缓存有效时长（ms），默认0，当为Infinity时永久缓存
 * @param {Number} options.swr 缓存过期容忍时长（ms），默认0
 * @param {Number} options.sie 更新错误容忍时长（ms），默认Infinity
 * @param {Number} options.gcThrottle 垃圾回收节流时长（ms），默认0，为0时不进行垃圾回收
 *
 * @param {Function} options.cacheFulfilled 是否缓存当前正常结果，默认true (arguments, value) => boolean
 * @param {Function} options.cacheRejected 是否缓存当前异常结果，默认false (arguments, error) => boolean
 * @returns
 */
export function cache(promiseFn: PromiseFn, options: Options = {}) {
  const {
    maxAge = 0,
    swr = 0,
    sie = 0,
    globalCache = false,
    gcThrottle = 0,
    cacheFulfilled = () => true,
    cacheRejected = () => false,
    argsEqual = isEqual,
    storeCreator = createCacheStore,
  } = options;

  const cacheStore = storeCreator(promiseFn, globalCache) as Map<any, CacheNode>;

  promiseFn = promiseHijack(promiseFn);

  const callGC = throttle(() => {
    const now = Date.now();
    for (const [key, val] of cacheStore.entries()) {
      const needClear = val.swr < now && val.sie < now && val.e < now;
      if (needClear) cacheStore.delete(key);
    }
  }, gcThrottle);

  return promiseHijack(function (...args: any[]) {
    if (gcThrottle !== 0) queueMicrotask(callGC);

    const [currentArgs, result] = Array.from(cacheStore.entries()).find(([a]) => argsEqual(a, args)) || [args, createCacheNode(maxAge, swr, sie)];

    if (result.s === Status.UNTERMINATED) {
      return update(currentArgs);
    }

    const now = Date.now();

    const isValid = result.e >= now;
    if (isValid) {
      return response(result);
    }

    const isInSWR = result.swr > now;
    const isInSIE = result.sie > now;

    if (isInSWR || isInSIE) {
      update(currentArgs);
      return response(result);
    }

    // Now in the Block
    return update(currentArgs);

    function response(result: CacheNode): Promise<CacheNode['v']> {
      if (result.s === Status.TERMINATED) return Promise.resolve(result.v);
      if (result.s === Status.ERRORED) return Promise.reject(result.v);
      throw new Error('unknown status');
    }

    async function update(selfArgs: any[]) {
      return promiseFn
        .apply(null, selfArgs)
        .then((value: any) => {
          result.s = Status.TERMINATED;
          result.v = value;
          result.e = Date.now() + result._maxAge;
          result.swr = result.e + result._swr;
          result.sie = 0;

          if (cacheFulfilled(selfArgs, value)) cacheStore.set(selfArgs, result);
          return response(result);
        })
        .catch((error) => {
          const now = Date.now();
          const isInSWR = result.swr > now;
          if (isInSWR) {
            result.swr = 0;
            result.sie = now + result._sie;
            return response(result);
          }

          const isInSIE = result.sie > now;

          if (isInSIE) {
            result.swr = 0;
            return response(result);
          }

          // Now in the Block
          result.s = Status.ERRORED;
          result.v = error;
          result.e = now + result._maxAge;
          result.sie = result.e + result._sie;
          result.sie = 0;

          if (cacheRejected(selfArgs, error)) {
            cacheStore.set(selfArgs, result);
          } else {
            cacheStore.delete(selfArgs);
          }

          return response(result);
        });
    }
  });
}

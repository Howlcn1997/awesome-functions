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
    swr: now,
    sie: now,
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

  cacheFulfilled?: (...args: any[]) => boolean;
}

type PromiseFn = (...args: any[]) => Promise<any>;

const globalCacheStore = new Map();

function createCacheStore<A>(promiseFn?: PromiseFn, globalCache?: boolean): Map<A, CacheNode> {
  if (globalCache) {
    let cacheStore = globalCacheStore.get(promiseFn);
    if (cacheStore) return cacheStore;

    cacheStore = new Map<A, CacheNode>();
    globalCacheStore.set(promiseFn, cacheStore);
    return cacheStore;
  }
  return new Map<A, CacheNode>();
}

/**
 * @param {Function} promiseFn
 * @param {Number} options.maxAge 缓存有效时长（ms），默认0，当为Infinity时永久缓存
 * @param {Number} options.swr 缓存过期容忍时长（ms），默认0
 * @param {Number} options.sie 更新错误容忍时长（ms），默认Infinity
 * @param {Number} options.gcThrottle 垃圾回收节流时长（ms），默认0，为0时不进行垃圾回收
 *
 * @param {Function} options.cacheRejected 是否缓存异常结果，默认true (...arguments) => boolean
 * @returns
 */
export function cache(promiseFn: PromiseFn, options: Options = {}) {
  const { maxAge = 0, swr = 0, sie = 0, globalCache = false, gcThrottle = 0, cacheFulfilled = () => true } = options;

  const cacheStore = createCacheStore<any[]>(promiseFn, globalCache);

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

    const [currentArgs, result] = Array.from(cacheStore.entries()).find(([a]) => isEqual(a, args)) || [args, createCacheNode(maxAge, swr, sie)];

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

    return update(currentArgs).catch((error) => {
      cacheStore.delete(currentArgs);
      throw error;
    });

    function response(result: CacheNode): Promise<CacheNode['v']> {
      if (result.s === Status.TERMINATED) return Promise.resolve(result.v);
      if (result.s === Status.ERRORED) return Promise.reject(result.v);
      throw new Error('unknown status');
    }

    async function update(selfArgs: any[]) {
      return promiseFn.apply(null, selfArgs).then((value: any) => {
        result.s = Status.TERMINATED;
        result.v = value;
        result.e = Date.now() + result._maxAge;
        result.swr = result.e + result._swr;
        result.sie = 0;

        if (cacheFulfilled(...selfArgs)) cacheStore.set(selfArgs, result);
        return response(result);
      });
    }
  });
}

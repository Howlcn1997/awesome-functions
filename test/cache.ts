import { cache } from '../src/cache';

let id = 0;
function mockApi() {
  return new Promise((resolve) => {
    console.log('🚀 ~ mockApi', id, Date.now());
    setTimeout(() => {
      resolve('mockApi ' + id++);
    }, 500);
  });
}

const mockApiCache = cache(mockApi, { maxAge: 1000, swr: Infinity, sie: 0 });

// 0  --- request --- 500 --- maxAge --- 1500 --- swr --- 3500
// 2000 --- request --- 2500 --- maxAge --- 3500 --- swr --- 5500
// 6000 --- request --- 6500 --- maxAge --- 7500 --- swr --- 9500

(() => {
  console.time('首次 [耗时]');
  mockApiCache().then((v) => {
    console.timeEnd('首次 [耗时]');
    console.log('首次:', v);
  });
  setTimeout(() => {
    console.time('命中有效 [耗时]');
    mockApiCache().then((v) => {
      console.timeEnd('命中有效 [耗时]');
      console.log('命中有效:', v);
    });
  }, 1000);
  setTimeout(() => {
    console.time('不命中有效,命中swr [耗时]');
    mockApiCache().then((v) => {
      console.timeEnd('不命中有效,命中swr [耗时]');
      console.log('不命中有效,命中swr:', v);
    });
  }, 2000);
  setTimeout(() => {
    console.time('不命中有效,不命中swr [耗时]');
    mockApiCache().then((v) => {
      console.timeEnd('不命中有效,不命中swr [耗时]');
      console.log('不命中有效,不命中swr:', v);
    });
  }, 6000);
  setTimeout(() => {
    console.time('命中第二次有效 [耗时]');
    mockApiCache().then((v) => {
      console.timeEnd('命中第二次有效 [耗时]');
      console.log('命中第二次有效:', v);
    });
  }, 7000);
})();

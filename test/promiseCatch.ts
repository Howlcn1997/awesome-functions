import { promiseCache } from '../src/promiseCache';

function mockApi() {
  return new Promise((resolve) => {
    console.log('🚀 ~ mockApi');
    setTimeout(() => {
      resolve('mockApi');
    }, 1000);
  });
}

const mockApiCache = promiseCache(mockApi, { ttl: 2000 });

(() => {
  mockApiCache().then(console.log);
  mockApiCache().then(console.log);
  mockApiCache().then(console.log);
  setTimeout(() => {
    mockApiCache().then(console.log);
  }, 3000);
})();

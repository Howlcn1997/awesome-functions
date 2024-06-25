import { cache } from '../src/cache';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// let count = 0;
// const mockRequest = async () => {
//   await delay(200);
//   return count++;
// };

// (async () => {
//   await mockRequest().then(console.log);
//   await mockRequest().then(console.log);

//   count = 0;
//   const requestCache = cache(mockRequest, { maxAge: 500, swr: 0, sie: 0, gcThrottle: 0 });
//   // 下一行执行完毕时便会产生缓存，缓存的窗口期如下
//   // 0 -- [maxAge] -- 500 -- [block] -- Infinity
//   await requestCache().then(console.log); // 0
//   // 在maxAge内，则输出0
//   await requestCache().then(console.log);
//   await delay(200);
//   // 0 < 200 < 500，在maxAge内，则输出0
//   await requestCache().then(console.log);
//   await delay(400);
//   // 500 < 600(200 + 400)，在maxAge外，缓存失效，重新执行mockRequest，输出1
//   await requestCache().then(console.log);
// })();

// (async () => {
//   count = 0;
//   const requestCache = cache(mockRequest, { maxAge: 500, swr: 1000, sie: 0, gcThrottle: 0 });
//   // 下一行执行完毕时便会产生缓存，缓存的窗口期如下
//   // 0 -- [maxAge] -- 500 -- [swr] -- 1500 -- [block] -- Infinity
//   await requestCache().then(console.log); // 0
//   // 在maxAge内，则输出0
//   await requestCache().then(console.log);
//   await delay(200);
//   // 0 < 200 < 500，在maxAge内，则输出0
//   await requestCache().then(console.log);
//   await delay(400);
//   // 500 < 600(200 + 400)，在maxAge外，缓存失效
//   await requestCache().then(console.log);
//   await delay(100);
//   await requestCache().then(console.log);
// })();
const mockRequest = async (params) => {
  return `${JSON.stringify(params)}-${Date.now()}`;
};

(async () => {
  const requestCache = cache(mockRequest, { maxAge: 500 });
  // 缓存命中
  await requestCache({ name: 'neno' }).then(console.log);
  await requestCache({ name: 'neno' }).then(console.log);

  // 缓存不命中
  await requestCache({ name: 'neno' }).then(console.log);
  await requestCache({ name: 'nenoless' }).then(console.log);

  // { name: "nenoless" } 对应的块再次命中
  await requestCache({ name: 'nenoless' }).then(console.log);
})();

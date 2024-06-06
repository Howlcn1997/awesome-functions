import { promiseHijack } from '../src/promiseHijack';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let count = 0;

async function asyncMockFn(params?: any) {
  await delay(1000);
  return 'asyncMockFn count:' + ++count + ' params:' + params;
}

// without promiseHijack
asyncMockFn().then(console.log);
asyncMockFn().then(console.log);
asyncMockFn().then(console.log);

// with promiseHijack ,same arguments
const hijackedAsyncMockFn = promiseHijack(asyncMockFn);

hijackedAsyncMockFn().then(console.log);
hijackedAsyncMockFn().then(console.log);
hijackedAsyncMockFn().then(console.log);

// with promiseHijack, different arguments
const hijackedAsyncMockFn2 = promiseHijack(asyncMockFn);

hijackedAsyncMockFn2(1).then(console.log);
hijackedAsyncMockFn2(1).then(console.log);
hijackedAsyncMockFn2({ a: 1 }).then(console.log);
hijackedAsyncMockFn2({ a: 1 }).then(console.log);

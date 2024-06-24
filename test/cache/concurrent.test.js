import { cache } from '@/cache';

let count = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => (count = 0));

describe('concurrent', () => {
  describe('resolve', () => {
    const successMockApi = async () => {
      await delay(100);
      return ++count;
    };
    const successMockApiCache = cache(successMockApi);

    test('no cache', () => {
      expect(successMockApi()).resolves.toBe(1);
      expect(successMockApi()).resolves.toBe(2);
    });

    test('cache', () => {
      expect(successMockApiCache()).resolves.toBe(1);
      // expect(successMockApiCache()).resolves.toBe(1);
    });
  });

  //   describe('reject', () => {
  //     const errorMockApi = async () => {
  //       await delay(100);
  //       throw ++count;
  //     };
  //     const errorMockApiCache = cache(errorMockApi);

  //     test('no cache', () => {
  //       expect(errorMockApi()).rejects.toBe(1);
  //       expect(errorMockApi()).rejects.toBe(2);
  //     });
  //     test('cache', () => {
  //       expect(errorMockApiCache()).rejects.toBe(1);
  //       expect(errorMockApiCache()).rejects.toBe(1);
  //     });
  //   });
});

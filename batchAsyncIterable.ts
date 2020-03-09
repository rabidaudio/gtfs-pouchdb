// loosely adapted from https://github.com/wtgtybhertgeghgtwtg/batch-async-iterator
export function batchAsyncIterable <T> (src: AsyncIterable<T>, batchSize: number): AsyncIterable<T[]> {
  const iterator: AsyncIterator<T> = src[Symbol.asyncIterator]()
  const asyncIterator: AsyncIterator<T[]> = {
    next: async () => {
      const batch: T[] = []
      while (true) {
        const { done, value } = await iterator.next()
        if (done) {
          return { done: true, value: batch }
        }
        batch.push(value)
        if (batch.length === batchSize) {
          return { done: false, value: batch }
        }
      }
    }
  }
  return {
    [Symbol.asyncIterator]: (() => asyncIterator)
  }
}

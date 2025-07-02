declare global {
    const describe: (name: string, fn: () => void) => void;
    const beforeEach: (fn: () => void) => void;
    const afterEach: (fn: () => void) => void;
    const test: (name: string, fn: () => void) => void;
    const expect: any;
    namespace jest {
      function useFakeTimers(): void;
      function useRealTimers(): void;
      function setSystemTime(date: Date): void;
      function fn(): any;
    }
  }
  export {};
declare module 'vitest' {
  type Test = (name: string, callback: () => void) => void;
  export const describe: Test;
  export const it: Test & { only: Test };
  export const expect: (value: unknown, message?: string) => {
    toBe: (value: unknown) => void;
    toEqual: (value: unknown) => void;
    toStrictEqual: (value: unknown) => void;
    toHaveBeenCalledTimes: (count: number) => void;
    toHaveBeenCalledOnce: () => void;
  };
}

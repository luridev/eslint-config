import { describe, expect, it } from 'vitest';

describe('fixture', () => {
  it('compares values', () => {
    expect({ value: 1 }).toEqual({ value: 1 });
  });
});

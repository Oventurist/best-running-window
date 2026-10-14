import { describe, it, expect } from 'vitest';
import { parseRunLengthMinutes, isValidRunLength } from '../js/run-length.js';

describe('shared run-length rule (1-600 minutes)', () => {
  it('rejects 0h 0m', () => {
    expect(isValidRunLength('0', '0')).toBe(false);
    expect(parseRunLengthMinutes('0', '0')).toBe(0);
  });

  it('rejects empty fields (treated as 0)', () => {
    expect(isValidRunLength('', '')).toBe(false);
    expect(parseRunLengthMinutes('', '')).toBe(0);
  });

  it('accepts 1 minute', () => {
    expect(isValidRunLength('0', '1')).toBe(true);
  });

  it('accepts 600 minutes (10h 0m)', () => {
    expect(isValidRunLength('10', '0')).toBe(true);
    expect(parseRunLengthMinutes('10', '0')).toBe(600);
  });

  it('rejects 601 minutes', () => {
    expect(isValidRunLength('10', '1')).toBe(false);
  });
});

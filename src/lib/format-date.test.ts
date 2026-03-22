import { describe, it, expect } from 'vitest';
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('formats ISO date string to "Mon DD, YYYY" format', () => {
    const result = formatDate('2025-03-15T10:30:00Z');
    expect(result).toBe('Mar 15, 2025');
  });

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  sanitizeAdditionalInfoValue,
  isValidAdditionalInfoValue,
  buildAdditionalInfo,
  validateAdditionalInfo,
} from '../../lib/billdesk-additional-info';

describe('BillDesk Additional Info character sanitization and validation', () => {
  it('allows alphanumeric characters, @, comma, period, and hyphen', () => {
    const valid = 'user@example.com,course-id.123';
    expect(sanitizeAdditionalInfoValue(valid)).toBe(valid);
    expect(isValidAdditionalInfoValue(valid)).toBe(true);
  });

  it('replaces disallowed characters (spaces, underscores, quotes, colons, slashes) with hyphen', () => {
    expect(sanitizeAdditionalInfoValue('John Doe')).toBe('John-Doe');
    expect(sanitizeAdditionalInfoValue('user_name#123!')).toBe('user-name-123');
    expect(sanitizeAdditionalInfoValue('course:advanced/cooking')).toBe('course-advanced-cooking');
  });

  it('returns NA for empty, null, undefined, or whitespace-only inputs', () => {
    expect(sanitizeAdditionalInfoValue('')).toBe('NA');
    expect(sanitizeAdditionalInfoValue('   ')).toBe('NA');
    expect(sanitizeAdditionalInfoValue(null)).toBe('NA');
    expect(sanitizeAdditionalInfoValue(undefined)).toBe('NA');
    expect(sanitizeAdditionalInfoValue(12345)).toBe('NA');
  });

  it('returns NA if sanitized output collapses into pure punctuation or empty', () => {
    expect(sanitizeAdditionalInfoValue('   ***   ')).toBe('NA');
    expect(sanitizeAdditionalInfoValue('///')).toBe('NA');
  });

  it('builds all 7 fields with at least 3 populated non-NA values', () => {
    const info = buildAdditionalInfo([
      'fixture-one', 'fixture-two', 'fixture-three', 'fixture-four', 'fixture-five', undefined, undefined,
    ]);

    expect(info.additional_info1).toBe('fixture-one');
    expect(info.additional_info2).toBe('fixture-two');
    expect(info.additional_info3).toBe('fixture-three');
    expect(info.additional_info4).toBe('fixture-four');
    expect(info.additional_info5).toBe('fixture-five');
    expect(info.additional_info6).toBe('NA');
    expect(info.additional_info7).toBe('NA');

    expect(validateAdditionalInfo(info)).toBe(true);
  });

  it('populates NA for missing optional fields and maintains all 7 fields', () => {
    const info = buildAdditionalInfo(['first', 'second', 'third', undefined, undefined, undefined, undefined]);

    expect(info.additional_info1).toBe('first');
    expect(info.additional_info2).toBe('second');
    expect(info.additional_info3).toBe('third');
    expect(info.additional_info4).toBe('NA');
    expect(info.additional_info5).toBe('NA');
    expect(info.additional_info6).toBe('NA');
    expect(info.additional_info7).toBe('NA');

    expect(validateAdditionalInfo(info)).toBe(true);
  });

  it('does not invent populated fields when values are unavailable', () => {
    const info = buildAdditionalInfo(Array(7).fill(undefined));
    expect(Object.values(info)).toEqual(Array(7).fill('NA'));
    expect(validateAdditionalInfo(info)).toBe(false);
  });

  it('requires exactly seven slots and rejects extra payload keys', () => {
    expect(() => buildAdditionalInfo(Array(6).fill('fixture'))).toThrow();
    expect(() => buildAdditionalInfo(Array(8).fill('fixture'))).toThrow();
    const info = buildAdditionalInfo(Array(7).fill('fixture'));
    expect(validateAdditionalInfo({ ...info, additional_info8: 'extra' })).toBe(false);
    expect(validateAdditionalInfo({ ...info, additional_info7: 'x'.repeat(101) })).toBe(false);
  });

  it('validateAdditionalInfo rejects payloads with fewer than 3 non-NA fields', () => {
    const invalidInfo = {
      additional_info1: 'user@example.com',
      additional_info2: 'NA',
      additional_info3: 'NA',
      additional_info4: 'NA',
      additional_info5: 'NA',
      additional_info6: 'NA',
      additional_info7: 'NA',
    };
    expect(validateAdditionalInfo(invalidInfo)).toBe(false);
  });

  it('validateAdditionalInfo rejects payloads with blank strings or disallowed characters', () => {
    const withBlank = {
      additional_info1: 'user@example.com',
      additional_info2: 'course-123',
      additional_info3: '', // blank is forbidden
      additional_info4: 'NA',
      additional_info5: 'NA',
      additional_info6: 'NA',
      additional_info7: 'NA',
    };
    expect(validateAdditionalInfo(withBlank)).toBe(false);

    const withDisallowed = {
      additional_info1: 'user@example.com',
      additional_info2: 'course-123',
      additional_info3: 'Chef Guest', // space is disallowed
      additional_info4: 'NA',
      additional_info5: 'NA',
      additional_info6: 'NA',
      additional_info7: 'NA',
    };
    expect(validateAdditionalInfo(withDisallowed)).toBe(false);
  });
});

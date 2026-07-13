import { describe, expect, it } from 'vitest';
import { compareVersions } from '../src/main/updater';

describe('compareVersions', () => {
  it('detects a newer version', () => {
    expect(compareVersions('0.4.0', '0.3.0')).toBe(1);
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1);
    expect(compareVersions('0.3.1', '0.3.0')).toBe(1);
  });

  it('detects an older version', () => {
    expect(compareVersions('0.2.0', '0.3.0')).toBe(-1);
    expect(compareVersions('0.3.0', '0.3.1')).toBe(-1);
  });

  it('treats equal versions as equal', () => {
    expect(compareVersions('0.3.0', '0.3.0')).toBe(0);
  });

  it('tolerates missing patch segments', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.3', '1.2.9')).toBe(1);
  });
});

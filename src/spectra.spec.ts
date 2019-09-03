import { encodeObject } from './spectra';

describe('spectra', () => {
  it('should encode the given object in Spectra format', () => {
    expect(encodeObject(['foo', 'bar'])).toEqual('(foo bar)');
  });

  it('should ignore null values', () => {
    expect(encodeObject(['foo', null, 'bar'])).toEqual('(foo bar)');
  });
});

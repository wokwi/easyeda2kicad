import { encodeObject, parseObject } from './spectra';

describe('spectra', () => {
  describe('encodeObject', () => {
    it('should encode the given object in Spectra format', () => {
      expect(encodeObject(['foo', 'bar'])).toEqual('(foo bar)');
    });

    it('should ignore null values', () => {
      expect(encodeObject(['foo', null, 'bar'])).toEqual('(foo bar)');
    });
  });

  describe('parseObject', () => {
    it('should parse a simple object', () => {
      expect(parseObject('(foo bar)')).toEqual(['foo', 'bar']);
    });

    it('should parse nested objects with strings and numbers', () => {
      expect(
        parseObject(
          '(fp_text user gge464 (at 0 0) (layer "Cmts.User") (effects (font (size 1 1) (thickness 0.15)))))'
        )
      ).toEqual([
        'fp_text',
        'user',
        'gge464',
        ['at', 0, 0],
        ['layer', 'Cmts.User'],
        ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
      ]);
    });

    it('should parse embedded quotes in strings', () => {
      expect(
        parseObject(`(test "this string has embedded "" quotes inside" "this one doesn't")`)
      ).toEqual(['test', 'this string has embedded " quotes inside', `this one doesn't`]);
    });
  });
});

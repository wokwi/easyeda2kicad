import { convertArc } from './board';

describe('convertArc', () => {
  it('should convert arcs', () => {
    expect(
      convertArc(['1', '10', '', 'M4000,3000 A46.9945,46.9945 0 1 1 4050,2950', '', 'gge276', '0'])
    ).toEqual([
      'gr_arc',
      ['start', 6.35, -6.35],
      ['end', 0, 0],
      ['angle', 180],
      ['width', 0.254],
      ['layer', 'Edge.Cuts']
    ]);
  });

  it('should parse different path formats', () => {
    expect(
      convertArc(['1', '10', '', 'M4000 3000A10 10 0 0 1 4050 3050', '', 'gge170', '0'])
    ).toEqual([
      'gr_arc',
      ['start', 6.35, 6.35],
      ['end', 0, 0],
      ['angle', 180],
      ['width', 0.254],
      ['layer', 'Edge.Cuts']
    ]);
  });
});

import { convertArc, convertCopperArea } from './board';

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

describe('convertCopperArea', () => {
  it('should correctly parse the given SVG path', () => {
    expect(
      convertCopperArea(
        [
          '1',
          '2',
          'GND',
          'M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z',
          '1',
          'solid',
          'gge221',
          'spoke',
          'none',
          '',
          '0',
          '',
          '2',
          '1',
          '1',
          '0',
          'yes'
        ],
        []
      )
    ).toEqual([
      'zone',
      ['net', -1],
      ['net_name', 'GND'],
      ['layer', 'B.Cu'],
      ['hatch', 'edge', 0.508],
      ['connect_pads', ['clearance', 0.254]],
      [
        'polygon',
        ['pts', ['xy', 12.7, 12.7], ['xy', 41.656, 12.7], ['xy', 40.64, 30.48], ['xy', 12.7, 25.4]]
      ]
    ]);
  });
});

import { convertArc, convertCopperArea, convertTrack } from './board';
import { encodeObject } from './spectra';

function removeNulls(a: string[]) {
  return a.filter((e) => e != null);
}

describe('convertTrack', () => {
  it('should convert copper tracks into segments', () => {
    const result = convertTrack(
      ['0.63', '1', 'GND', '4000 3000 4000 3030', 'gge606', '0'],
      ['', 'GND']
    );
    expect(result.map(removeNulls)).toEqual([
      [
        'segment',
        ['start', 0, 0],
        ['end', 0, 7.62],
        ['width', 0.16002],
        ['layer', 'F.Cu'],
        ['net', 1]
      ]
    ]);
  });

  it('should convert non-copper layer tracks into gr_lines', () => {
    const result = convertTrack(['0.63', '10', 'GND', '4000 3000 4000 3030', 'gge606', '0'], ['']);
    expect(result.map(removeNulls)).toEqual([
      ['gr_line', ['start', 0, 0], ['end', 0, 7.62], ['width', 0.16002], ['layer', 'Edge.Cuts']]
    ]);
  });
});

describe('convertArc', () => {
  it('should convert arcs', () => {
    expect(
      encodeObject(
        convertArc(['1', '10', '', 'M4050,3060 A10,10 0 0 1 4060,3050', '', 'gge276', '0'])
      )
    ).toEqual(
      '(gr_arc (start 15.24 15.24) (end 12.7 15.24) (angle 90) (width 0.254) (layer "Edge.Cuts"))'
    );
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

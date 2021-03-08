import {
  IConversionState,
  convertVia,
  convertTrack,
  convertText,
  convertArc,
  convertCopperArea,
  convertSolidRegion,
  convertCircle,
  convertHole,
  convertBoardPad,
  convertRect,
  convertBoardToArray,
} from './board-v6';
import { convertFp } from './footprint-v6';
import { encodeObject, ISpectraList } from './spectra';

function removeNullsAndFormating(a: ISpectraList): ISpectraList {
  return a
    .map((item) => (item instanceof Array ? removeNullsAndFormating(item) : item))
    .filter((e) => e != null)
    .filter((e) => e != '_LF_')
    .filter((e) => e != '_LF1_')
    .filter((e) => e != '_LF2_')
    .filter((e) => e != '_LF3_')
    .filter((e) => e != '_LF4_');
}

function round(obj: ISpectraList | string | number, precision = 3): ISpectraList | string | number {
  if (obj instanceof Array) {
    return obj.map((item) => round(item, precision));
  }
  if (typeof obj === 'number') {
    const result = parseFloat(obj.toFixed(precision));
    if (result > -Number.EPSILON && result < Number.EPSILON) {
      return 0;
    }
    return result;
  }
  return obj;
}

function normalize(obj: ISpectraList) {
  return round(removeNullsAndFormating(obj));
}

function conversionState(nets: string[] = []): IConversionState {
  return {
    nets,
    innerLayers: 0,
    fpValue: '',
    msgRepCnt: 0,
    msgReports: [],
    msgReportsPosition: 0,
    pcbCuZoneCount: 0,
    pcbKeepoutZoneCount: 0,
  };
}
// standin function for convertModule from footprint-v6.ts
function convertShape(shape: string, conversionState: any) {
  const [type, ...args] = shape.split('~');
  switch (type) {
    case 'VIA':
      return [convertVia(args, conversionState)];
    case 'TRACK':
      return convertTrack(args, conversionState);
    case 'TEXT':
      return [convertText(args, conversionState)];
    case 'ARC':
      return [convertArc(args, conversionState)];
    case 'COPPERAREA':
      return [convertCopperArea(args, conversionState)];
    case 'SOLIDREGION':
      return [convertSolidRegion(args, conversionState)];
    case 'CIRCLE':
      return [convertCircle(args, conversionState)];
    case 'HOLE':
      return [convertHole(args)];
    case 'LIB':
      return [convertFp(args.join('~'), conversionState)];
    case 'PAD':
      return [convertBoardPad(args, conversionState)];
    case 'RECT':
      return [convertRect(args, conversionState)];
    default:
      console.warn(`Warning: unsupported shape ${type}`);
      return null;
  }
}
describe('convertTrack', () => {
  it('should convert copper tracks into segments', () => {
    const input = 'TRACK~0.63~1~GND~4000 3000 4000 3030~gge606~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        'segment',
        ['start', 0, 0],
        ['end', 0, 7.62],
        ['width', 0.16],
        ['layer', 'F.Cu'],
        ['net', 1],
      ],
    ]);
  });

  it(`should return [] if the given layer number doesn't exist`, () => {
    const input = 'TRACK~0.63~999~GND~4000 3000 4000 3030~gge606~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([]);
  });

  it('should convert non-copper layer tracks into gr_lines', () => {
    const input = 'TRACK~0.63~3~GND~4000 3000 4000 3030~gge606~0';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      ['gr_line', ['start', 0, 0], ['end', 0, 7.62], ['width', 0.16], ['layer', 'F.SilkS']],
    ]);
  });

  it('should convert to only one decimal place for boardlayout; hopefully solving (issue #45)', () => {
    const input = 'TRACK~0.63~10~GND~4150 3073 4000 3030~gge606~0';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      ['gr_line', ['start', 38.1, 18.5], ['end', 0, 7.6], ['width', 0.16], ['layer', 'Edge.Cuts']],
    ]);
  });

  it('should add missing nets into the netlist (issue #29)', () => {
    const input = 'TRACK~0.63~1~5V~4000 3000 4000 3030~gge606~0';
    const nets = ['', 'GND'];
    expect(normalize(convertShape(input, conversionState(nets)))).toEqual([
      [
        'segment',
        ['start', 0, 0],
        ['end', 0, 7.62],
        ['width', 0.16],
        ['layer', 'F.Cu'],
        ['net', 2],
      ],
    ]);
    expect(nets).toEqual(['', 'GND', '5V']);
  });

  it('should support inner layers (issue #33)', () => {
    const input = 'TRACK~0.63~21~GND~4000 3000 4000 3030~gge606~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        'segment',
        ['start', 0, 0],
        ['end', 0, 7.62],
        ['width', 0.16],
        ['layer', 'In1.Cu'],
        ['net', 1],
      ],
    ]);
  });
});

describe('convertBoardPad', () => {
  it('should wrap layer 11 plated ELLIPSE pad in KiCad THT Footprint (issue #55)', () => {
    const input = 'PAD~ELLIPSE~4150~3071.5~6~6~11~VCC~1~1.8~~0~gge196~0~~Y~0~~~4150,3071.5';
    expect(normalize(convertShape(input, conversionState(['', 'VCC'])))).toEqual([
      [
        [
          'footprint',
          'AutoGenerated:TH_pad_gge196',
          ['layer', 'F.Cu'],
          ['at', 38.1, 18.161],
          ['attr', 'through_hole', 'board_only', 'exclude_from_pos_files', 'exclude_from_bom'],
          ['fp_text', 'reference', 'gge196', ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
          ['fp_text', 'value', 'hole_0.91_mm', ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
          [
            'pad',
            1,
            'thru_hole',
            'circle',
            ['at', 0, 0, 0],
            ['size', 1.524, 1.524],
            ['layers', '*.Cu', '*.Paste', '*.Mask'],
            ['drill', 0.914],
            ['net', 1, 'VCC'],
          ],
        ],
      ],
    ]);
  });
  it('should wrap layer 11 non plated pad in KiCad NPTH Footprint', () => {
    const input = 'PAD~ELLIPSE~4150~3071.5~6~6~11~~1~1.8~~0~gge196~0~~N~0~~~4150,3071.5';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'AutoGenerated:NPTH_pad_gge196',
          ['layer', 'F.Cu'],
          ['at', 38.1, 18.161],
          ['attr', 'board_only', 'exclude_from_pos_files', 'exclude_from_bom'],
          ['fp_text', 'reference', 'gge196', ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
          ['fp_text', 'value', 'hole_0.91_mm', ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
          [
            'pad',
            1,
            'np_thru_hole',
            'circle',
            ['at', 0, 0, 0],
            ['size', 1.524, 1.524],
            ['layers', 'F&B.Cu', '*.Mask'],
            ['drill', 0.914],
          ],
        ],
      ],
    ]);
  });

  it('should wrap layer 1 (and 2) pad in KiCad SMD Footprint', () => {
    const input = 'PAD~RECT~4150~3071.5~6~6~1~VCC~1~1.8~~0~gge196~0~~Y~0~~~4150,3071.5';
    expect(normalize(convertShape(input, conversionState(['', 'VCC'])))).toEqual([
      [
        [
          'footprint',
          'AutoGenerated:SMD_pad_gge196',
          ['layer', 'F.Cu'],
          ['at', 38.1, 18.161],
          ['attr', 'smd', 'board_only', 'exclude_from_pos_files', 'exclude_from_bom'],
          ['fp_text', 'reference', 'gge196', ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
          ['fp_text', 'value', '', ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
          [
            'pad',
            1,
            'smd',
            'rect',
            ['at', 0, 0, 0],
            ['size', 1.524, 1.524],
            ['layers', 'F.Cu', 'F.Paste', 'F.Mask'],
            ['net', 1, 'VCC'],
          ],
        ],
      ],
    ]);
  });
});

describe('convertArc', () => {
  it('should convert arcs', () => {
    const input = 'ARC~1~3~~M4050,3060 A10,10 0 0 1 4060,3050~~gge276~0';
    expect(encodeObject(removeNullsAndFormating(convertShape(input, conversionState())))).toEqual(
      '(((gr_arc (start 15.24 15.24) (end 12.7 15.24) (angle 90) (width 0.254) (layer "F.SilkS"))))'
    );
  });

  it('should convert arcs to only one decimal place for boardlayout; hopefully solving (issue #45)', () => {
    const input = 'ARC~1~10~~M4050,3060 A10,10 0 0 1 4060,3050~~gge276~0';
    expect(encodeObject(removeNullsAndFormating(convertShape(input, conversionState())))).toEqual(
      '(((gr_arc (start 15.2 15.2) (end 12.7 15.2) (angle 90) (width 0.254) (layer "Edge.Cuts"))))'
    );
  });

  it('should parse different path formats', () => {
    const input = 'ARC~1~2~~M4000 3000A10 10 0 0 1 4050 3050~~gge170~0';
    expect(encodeObject(removeNullsAndFormating(convertShape(input, conversionState())))).toEqual(
      '(((gr_arc (start 6.35 6.35) (end 0 0) (angle 180) (width 0.254) (layer "B.Cu"))))'
    );
  });

  it('should support negative numbers in arc path', () => {
    const input =
      'ARC~0.6~4~~M 3977.3789 3026.2151 A 28.4253 28.4253 -150 1 1 3977.6376 3026.643~~gge66~0';
    expect(encodeObject(removeNullsAndFormating(convertShape(input, conversionState())))).toEqual(
      '(((gr_arc (start 0.465 2.978) (end -5.746 6.659) (angle 358.992) (width 0.152) (layer "B.SilkS"))))'
    );
  });

  it('should correctly determine the arc start and end point (issue #16)', () => {
    const input = 'ARC~1~1~S$9~M4262.5,3279.5 A33.5596,33.5596 0 0 0 4245.5921,3315.5816~~gge8~0';
    expect(encodeObject(removeNullsAndFormating(convertShape(input, conversionState())))).toEqual(
      '(((gr_arc (start 70.739 78.486) (end 62.38 80.158) (angle 72.836) (width 0.254) (layer "F.Cu"))))'
    );
  });
});

describe('convertCopperArea', () => {
  it('should correctly parse the given SVG path', () => {
    const input =
      'COPPERAREA~1~2~GND~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~1~solid~gge221~spoke~none~~0~~2~1~1~0~yes';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        [
          'zone',
          ['net', 1],
          ['net_name', 'GND'],
          ['layer', 'B.Cu'],
          ['hatch', 'edge', 0.508],
          ['priority', 0],
          ['connect_pads', ['clearance', 0.254]],
          ['fill', 'yes', ['thermal_gap', 0.254], ['thermal_bridge_width', 0.254]],
          [
            'polygon',
            [
              'pts',
              ['xy', 12.7, 12.7],
              ['xy', 41.656, 12.7],
              ['xy', 40.64, 30.48],
              ['xy', 12.7, 25.4],
            ],
          ],
        ],
      ],
    ]);
  });
});

it('should correctly add area name and zone priority', () => {
  const input =
    'COPPERAREA~1~2~V+~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~1~solid~gge222~spoke~none~~0~power+~2~1~1~0~yes';
  expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
    [
      [
        'zone',
        ['net', 2],
        ['net_name', 'V+'],
        ['layer', 'B.Cu'],
        ['name', 'power+'],
        ['hatch', 'edge', 0.508],
        ['priority', 1],
        ['connect_pads', ['clearance', 0.254]],
        ['fill', 'yes', ['thermal_gap', 0.254], ['thermal_bridge_width', 0.254]],
        [
          'polygon',
          [
            'pts',
            ['xy', 12.7, 12.7],
            ['xy', 41.656, 12.7],
            ['xy', 40.64, 30.48],
            ['xy', 12.7, 25.4],
          ],
        ],
      ],
    ],
  ]);
});

it('should correctly create a hatched fill of zone', () => {
  const input =
    'COPPERAREA~1~2~V+~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~1~grid~gge222~spoke~none~~0~power+~1~1~2~0~yes';
  expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
    [
      [
        'zone',
        ['net', 2],
        ['net_name', 'V+'],
        ['layer', 'B.Cu'],
        ['name', 'power+'],
        ['hatch', 'edge', 0.508],
        ['priority', 1],
        ['connect_pads', ['clearance', 0.254]],
        [
          'fill',
          'yes',
          ['mode', 'hatch'],
          ['thermal_gap', 0.254],
          ['thermal_bridge_width', 0.254],
          ['hatch_thickness', 0.254],
          ['hatch_gap', 0.508],
          ['hatch_orientation', 0],
        ],
        [
          'polygon',
          [
            'pts',
            ['xy', 12.7, 12.7],
            ['xy', 41.656, 12.7],
            ['xy', 40.64, 30.48],
            ['xy', 12.7, 25.4],
          ],
        ],
      ],
    ],
  ]);
});

describe('convert Rectangle on pcb copperlayer ', () => {
  it('should correctly convert rectangle without net to filled rect', () => {
    const input = 'RECT~4072.953~3480.854~5.709~7.087~2~gge5971~0~0~~~';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'gr_rect',
          ['start', 18.53, 122.137],
          ['end', 19.98, 123.937],
          ['layer', 'B.Cu'],
          ['width', 0.1],
          ['fill', 'solid'],
        ],
      ],
    ]);
  });

  it('should correctly convert rectangle with net to copper zone', () => {
    const input = 'RECT~4072.953~3480.854~5.709~7.087~2~gge5971~0~0~~~Q4_8';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        [
          'zone',
          ['net', 2],
          ['net_name', 'Q4_8'],
          ['layer', 'B.Cu'],
          ['name', 'gge5971'],
          ['hatch', 'edge', 0.508],
          ['priority', 1],
          ['connect_pads', 'yes', ['clearance', 0]],
          ['fill', 'yes', ['thermal_gap', 0], ['thermal_bridge_width', 0.254]],
          [
            'polygon',
            [
              'pts',
              ['xy', 18.53, 122.137],
              ['xy', 18.53, 123.937],
              ['xy', 19.98, 123.937],
              ['xy', 19.98, 122.137],
              ['xy', 18.53, 122.137],
            ],
          ],
        ],
      ],
    ]);
  });
});

describe('convertSolidRegion', () => {
  it('should ignore solid regions with arcs (issue #12) and return []', () => {
    const input =
      'SOLIDREGION~1~~M 4367 3248 A 33.8 33.8 0 1 0 4366.99 3248 Z ~cutout~gge1953~~~~0';
    expect(normalize(convertShape(input, conversionState()))).toEqual([[]]);
  });

  it('should ignore solid regions type "none"  and return []', () => {
    const input =
      'SOLIDREGION~1~~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~none~gge1953~~~~0';
    expect(normalize(convertShape(input, conversionState()))).toEqual([[]]);
  });

  it('should create a keepout zone for type "cutout"', () => {
    const input =
      'SOLIDREGION~1~~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~cutout~gge1953~~~~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        [
          'zone',
          ['net', 0],
          ['net_name', ''],
          ['hatch', 'edge', 0.508],
          ['layer', 'F.Cu'],
          ['name', 'gge1953'],
          [
            'keepout',
            ['tracks', 'allowed'],
            ['vias', 'allowed'],
            ['pads', 'allowed'],
            ['copperpour', 'not_allowed'],
            ['footprints', 'allowed'],
          ],
          [
            'polygon',
            [
              'pts',
              ['xy', 12.7, 12.7],
              ['xy', 41.656, 12.7],
              ['xy', 40.64, 30.48],
              ['xy', 12.7, 25.4],
            ],
          ],
        ],
      ],
    ]);
  });

  it('should convert a solidregion on copper with net to Kicad zone', () => {
    const input =
      'SOLIDREGION~2~GND~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~solid~gge1953~~~~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        [
          'zone',
          ['net', 1],
          ['net_name', 'GND'],
          ['layer', 'B.Cu'],
          ['hatch', 'edge', 0.508],
          ['priority', 1],
          ['connect_pads', 'yes', ['clearance', 0]],
          ['fill', 'yes', ['thermal_gap', 0], ['thermal_bridge_width', 0.254]],
          [
            'polygon',
            [
              'pts',
              ['xy', 12.7, 12.7],
              ['xy', 41.656, 12.7],
              ['xy', 40.64, 30.48],
              ['xy', 12.7, 25.4],
            ],
          ],
        ],
      ],
    ]);
  });

  it('should convert a solidregion on copper without net to Kicad filled polyline', () => {
    const input =
      'SOLIDREGION~2~~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~solid~gge1953~~~~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        [
          'gr_poly',
          [
            'pts',
            ['xy', 12.7, 12.7],
            ['xy', 41.656, 12.7],
            ['xy', 40.64, 30.48],
            ['xy', 12.7, 25.4],
          ],
          ['layer', 'B.Cu'],
          ['width', 0],
          ['fill', 'solid'],
        ],
      ],
    ]);
  });

  it('should convert a solidregion on copper without net to Kicad filled polyline', () => {
    const input =
      'SOLIDREGION~2~~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~solid~gge1953~~~~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        [
          'gr_poly',
          [
            'pts',
            ['xy', 12.7, 12.7],
            ['xy', 41.656, 12.7],
            ['xy', 40.64, 30.48],
            ['xy', 12.7, 25.4],
          ],
          ['layer', 'B.Cu'],
          ['width', 0],
          ['fill', 'solid'],
        ],
      ],
    ]);
  });

  it('should create a board cutout for type "npth"', () => {
    const input =
      'SOLIDREGION~11~~M 4050 3050 L 4164 3050 L 4160 3120 L4050,3100 Z~npth~gge1953~~~~0';
    expect(normalize(convertShape(input, conversionState(['', 'GND'])))).toEqual([
      [
        [
          'gr_poly',
          [
            'pts',
            ['xy', 12.7, 12.7],
            ['xy', 41.656, 12.7],
            ['xy', 40.64, 30.48],
            ['xy', 12.7, 25.4],
          ],
          ['layer', 'Edge.Cuts'],
          ['width', 0.254],
        ],
      ],
    ]);
  });
});

describe('convertHole()', () => {
  it('should convert HOLE into KiCad footprint', () => {
    const input = 'HOLE~4475.5~3170.5~2.9528~gge1205~1';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'AutoGenerated:MountingHole_1.50mm',
          'locked',
          ['layer', 'F.Cu'],
          ['at', 120.777, 43.307],
          ['attr', 'virtual'],
          ['fp_text', 'reference', '', ['at', 0, 0], ['layer', 'F.SilkS']],
          ['fp_text', 'value', '', ['at', 0, 0], ['layer', 'F.SilkS']],
          [
            'pad',
            '',
            'np_thru_hole',
            'circle',
            ['at', 0, 0],
            ['size', 1.5, 1.5],
            ['drill', 1.5],
            ['layers', '*.Cu', '*.Mask'],
          ],
        ],
      ],
    ]);
  });
});

describe('convert circle', () => {
  it('should correctly determine the end point according to radius', () => {
    const input = 'CIRCLE~4000~3000~12.4~1~3~gge635~0~';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [['gr_circle', ['center', 0, 0], ['end', 3.15, 0], ['layer', 'F.SilkS'], ['width', 0.254]]],
    ]);
  });
});

describe('convert rect', () => {
  it('should correctly determine the end point according to width/height', () => {
    const input = 'RECT~4000~3000~50~10~3~gge535~0~';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'gr_rect',
          ['start', 0, 0],
          ['end', 12.7, 2.54],
          ['layer', 'F.SilkS'],
          ['width', 0.1],
          ['fill', 'solid'],
        ],
      ],
    ]);
  });
});

describe('convertLib()', () => {
  it('should include the footprint name in the exported module', () => {
    const input =
      'LIB~4228~3187.5~package`1206`~270~~gge12~2~a8f323e85d754372811837f27f204a01~1564555550~0';
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:1206',
          ['layer', 'F.Cu'],
          ['at', 57.912, 47.625, -90],
          [
            'fp_text',
            'user',
            'gge12',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
        ],
      ],
    ]);
  });

  it('should correctly orient footprint elements', () => {
    const lib =
      'LIB~4228~3187.5~package`1206`~270~~gge12~2~a8f323e85d754372811837f27f204a01~1564555550~0';
    const pad =
      '#@$PAD~ELLIPSE~4010~3029~4~4~11~SEG1C~4~1.5~~270~gge181~0~~Y~0~0~0.4~4010.05,3029.95';
    const input = lib + pad;
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:1206',
          ['layer', 'F.Cu'],
          ['at', 57.912, 47.625, -90],
          [
            'fp_text',
            'user',
            'gge12',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
          [
            'pad',
            4,
            'thru_hole',
            'circle',
            ['at', -40.259, 55.372, -90],
            ['size', 1.016, 1.016],
            ['layers', '*.Cu', '*.Paste', '*.Mask'],
            ['drill', 0.762],
          ],
        ],
      ],
    ]);
  });

  it('should correctly orient text inside footprints', () => {
    const lib =
      'LIB~4228~3187.5~package`1206`~270~~gge12~2~a8f323e85d754372811837f27f204a01~1564555550~0';
    const text =
      '#@$TEXT~N~4363~3153~0.6~90~~3~~4.5~0.5pF~M 4359.51 3158.63 L 4359.71 3159.25~none~gge188~~0~';
    const input = lib + text;
    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:1206',
          ['layer', 'F.Cu'],
          ['at', 57.912, 47.625, -90],
          [
            'fp_text',
            'value',
            '0.5pF',
            ['at', -8.763, -34.29, 90],
            ['layer', 'F.Fab'],
            'hide',
            [
              'effects',
              ['font', ['size', 1.029, 0.857], ['thickness', 0.122]],
              ['justify', 'left'],
            ],
          ],
          [
            'fp_text',
            'user',
            'gge12',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
        ],
      ],
    ]);
  });

  it('should correctly convert pad offsets (issue #11)', () => {
    const input =
      'LIB~4177~3107~package`0402`3DModel`R_0603_1608Metric`~90~~gge464~1~405bb71866794ab59459d3b2854a4d33~1541687137~0~#@$TEXT~P~4173.31~3108.77~0.5~90~0~3~~2.4~R2~M 4172.0001 3108.77 L 4174.2901 3108.77 M 4172.0001 3108.77 L 4172.0001 3107.79 L 4172.1101 3107.46 L 4172.2201 3107.35 L 4172.4401 3107.24 L 4172.6601 3107.24 L 4172.8701 3107.35 L 4172.9801 3107.46 L 4173.0901 3107.79 L 4173.0901 3108.77 M 4173.0901 3108.01 L 4174.2901 3107.24 M 4172.5501 3106.41 L 4172.4401 3106.41 L 4172.2201 3106.3 L 4172.1101 3106.2 L 4172.0001 3105.98 L 4172.0001 3105.54 L 4172.1101 3105.32 L 4172.2201 3105.21 L 4172.4401 3105.1 L 4172.6601 3105.1 L 4172.8701 3105.21 L 4173.2001 3105.43 L 4174.2901 3106.52 L 4174.2901 3105~~gge467~~0~#@$TEXT~N~4160~3102.72~0.5~90~0~3~~4.5~2K2~M 4158.57 3102.52 L 4158.36 3102.52 L 4157.95 3102.31 L 4157.75 3102.11 L 4157.55 3101.7 L 4157.55 3100.88 L 4157.75 3100.47 L 4157.95 3100.27 L 4158.36 3100.06 L 4158.77 3100.06 L 4159.18 3100.27 L 4159.8 3100.67 L 4161.84 3102.72 L 4161.84 3099.86 M 4157.55 3098.51 L 4161.84 3098.51 M 4157.55 3095.64 L 4160.41 3098.51 M 4159.39 3097.48 L 4161.84 3095.64 M 4158.57 3094.09 L 4158.36 3094.09 L 4157.95 3093.88 L 4157.75 3093.68 L 4157.55 3093.27 L 4157.55 3092.45 L 4157.75 3092.04 L 4157.95 3091.84 L 4158.36 3091.63 L 4158.77 3091.63 L 4159.18 3091.84 L 4159.8 3092.25 L 4161.84 3094.29 L 4161.84 3091.43~none~gge468~~0~#@$PAD~RECT~4177~3108.67~2.362~2.559~1~SWCLK~1~0~4175.72 3109.85 4175.72 3107.49 4178.28 3107.49 4178.28 3109.85~90~gge466~0~~Y~0~0~0.4~4177,3108.67';
    expect(normalize(convertShape(input, conversionState(['', '+3V3', 'SWCLK'])))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:0402',
          ['layer', 'F.Cu'],
          ['at', 44.958, 27.178, 90],
          ['attr', 'smd'],
          [
            'fp_text',
            'reference',
            'R2',
            ['at', -0.45, -0.937, 90],
            ['layer', 'F.SilkS'],
            [
              'effects',
              ['font', ['size', 0.549, 0.457], ['thickness', 0.102]],
              ['justify', 'left'],
            ],
          ],
          [
            'fp_text',
            'value',
            '2K2',
            ['at', 1.087, -4.318, 90],
            ['layer', 'F.Fab'],
            'hide',
            [
              'effects',
              ['font', ['size', 1.029, 0.857], ['thickness', 0.102]],
              ['justify', 'left'],
            ],
          ],
          [
            'fp_text',
            'user',
            'gge464',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
          [
            'pad',
            1,
            'smd',
            'rect',
            ['at', -0.424, 0, 90],
            ['size', 0.6, 0.65],
            ['layers', 'F.Cu', 'F.Paste', 'F.Mask'],
            ['net', 2, 'SWCLK'],
          ],
        ],
      ],
    ]);
  });

  it('should convert polygons inside footprints (issue #15)', () => {
    const input =
      'LIB~4401~3164~package`IEC_HIGHVOLTAGE_SMALL`~~~gge846~1~~~0~#@$SOLIDREGION~3~~M 4400.3 3160.5 L 4401.8 3160.5 L 4399.1 3165.8 L 4402.9 3164.7 L 4400.9 3169.3 L 4401.7 3169.1 L 4400.1 3170.9 L 4399.8 3168.8 L 4400.3 3169.2 L 4401.3 3165.9 L 4397.6 3167.1 Z ~solid~gge849~~~~0';

    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:IEC_HIGHVOLTAGE_SMALL',
          ['layer', 'F.Cu'],
          ['at', 101.854, 41.656],
          [
            'fp_text',
            'user',
            'gge846',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
          [
            'fp_poly',
            [
              'pts',
              ['xy', -0.178, -0.889],
              ['xy', 0.203, -0.889],
              ['xy', -0.483, 0.457],
              ['xy', 0.483, 0.178],
              ['xy', -0.025, 1.346],
              ['xy', 0.178, 1.295],
              ['xy', -0.229, 1.753],
              ['xy', -0.305, 1.219],
              ['xy', -0.178, 1.321],
              ['xy', 0.076, 0.483],
              ['xy', -0.864, 0.787],
            ],
            ['layer', 'F.SilkS'],
            ['width', 0],
          ],
        ],
      ],
    ]);
  });

  it('should not crash if SOLIDREGION contains an arc (issue #15)', () => {
    const input =
      'LIB~4401~3164~package`IEC_HIGHVOLTAGE_SMALL`~~~gge846~1~~~0~#@$SOLIDREGION~3~~M 4513.5 3294 A 12.125 12.125 0 0 1 4495.5 3294 Z ~solid~gge636~~~~0';

    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:IEC_HIGHVOLTAGE_SMALL',
          ['layer', 'F.Cu'],
          ['at', 101.854, 41.656],
          [
            'fp_text',
            'user',
            'gge846',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
        ],
      ],
    ]);
  });

  it('should not respected the locked attribute (issue #23)', () => {
    const input = 'LIB~4050~3050~package`Test`~~~gge123~1~~~1~';

    expect(normalize(convertShape(input, conversionState()))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:Test',
          'locked',
          ['layer', 'F.Cu'],
          ['at', 12.7, 12.7],
          [
            'fp_text',
            'user',
            'gge123',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
        ],
      ],
    ]);
  });

  it('should correctly convert non-rectangular polygon-shaped pads (issue #28)', () => {
    const input =
      'LIB~612.25~388.7~package`0603`value`1.00k~~~rep30~1~c25f29e5d54148509f1fe8ecc29bd248~1549637911~0~#@$PAD~POLYGON~613.999~396.939~3.9399~3.14~1~GND~1~0~612.03 398.51 612.03 395.37 615.97 398.51~90~rep28~0~~Y~0~0~0.4~613.999,396.939';
    const nets = ['', 'GND', 'B-IN'];
    expect(normalize(convertShape(input, conversionState(nets)))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:0603',
          ['layer', 'F.Cu'],
          ['at', -860.489, -663.27],
          ['attr', 'smd'],
          [
            'fp_text',
            'user',
            'rep30',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
          [
            'pad',
            1,
            'smd',
            'custom',
            ['at', 0.444, 2.093, 90],
            ['size', 0.025, 0.025],
            ['layers', 'F.Cu', 'F.Paste', 'F.Mask'],
            ['net', 1, 'GND'],
            [
              'primitives',
              [
                'gr_poly',
                ['pts', ['xy', -0.399, -0.5], ['xy', 0.399, -0.5], ['xy', -0.399, 0.501]],
                ['width', 0.1],
              ],
            ],
          ],
        ],
      ],
    ]);
  });

  it('should enforce minimal width and height for polygon pads', () => {
    const input =
      'LIB~585.7~338.9~package`0603`value`1.00k~90~~gge35720~1~c25f29e5d54148509f1fe8ecc29bd248~1549637911~0~#@$PAD~POLYGON~593.939~338.901~0~0~1~SYNC-OUT~1~0~595.51 340.87 592.37 340.87 595.51 336.93~180~gge35721~0~~Y~0~0~0.4~593.939,338.901';
    const nets = ['', 'GND', 'B-IN'];
    expect(normalize(convertShape(input, conversionState(nets)))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:0603',
          ['layer', 'F.Cu'],
          ['at', -867.232, -675.919, 90],
          ['attr', 'smd'],
          [
            'fp_text',
            'user',
            'gge35720',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
          [
            'pad',
            1,
            'smd',
            'custom',
            ['at', 0, 2.093, 180],
            ['size', 0.025, 0.025],
            ['layers', 'F.Cu', 'F.Paste', 'F.Mask'],
            ['net', 3, 'SYNC-OUT'],
            [
              'primitives',
              [
                'gr_poly',
                ['pts', ['xy', -0.399, -0.5], ['xy', 0.399, -0.5], ['xy', -0.399, 0.501]],
                ['width', 0.1],
              ],
            ],
          ],
        ],
      ],
    ]);
  });

  it('should automatically detect rectangular pads that are defined as polygons (issue #28)', () => {
    const input =
      'LIB~585.7~338.9~package`0603`value`1.00k~90~~gge35720~1~c25f29e5d54148509f1fe8ecc29bd248~1549637911~0~#@$PAD~POLYGON~593.939~338.901~0~0~1~SYNC-OUT~1~0~595.51 340.87 592.37 340.87 592.37 336.93 595.51 336.93~180~gge35721~0~~Y~0~0~0.4~593.939,338.901#@$PAD~POLYGON~586.459~338.901~3.15~3.94~1~SYNC-OUT~2~0~588.03 340.87 584.88 340.87 584.88 336.93 588.03 336.93~180~gge35727~0~~Y~0~0~0.4~586.459,338.901';
    const nets = ['', 'GND', 'B-IN'];
    expect(normalize(convertShape(input, conversionState(nets)))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:0603',
          ['layer', 'F.Cu'],
          ['at', -867.232, -675.919, 90],
          ['attr', 'smd'],
          [
            'fp_text',
            'user',
            'gge35720',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
          [
            'pad',
            1,
            'smd',
            'rect',
            ['at', 0, 2.093, 180],
            ['size', 0.798, 1.001],
            ['layers', 'F.Cu', 'F.Paste', 'F.Mask'],
            ['net', 3, 'SYNC-OUT'],
          ],
          [
            'pad',
            2,
            'smd',
            'rect',
            ['at', 0, 0.193, 180],
            ['size', 0.8, 1.001],
            ['layers', 'F.Cu', 'F.Paste', 'F.Mask'],
            ['net', 3, 'SYNC-OUT'],
          ],
        ],
      ],
    ]);
  });

  it('should convert via with no net assigned to np_thru_hole', () => {
    const input =
      'LIB~585.7~338.9~package`usb_mini`value`mini~90~~gge35720~1~c25f~0~#@$VIA~4826.69~2924.02~5.9055~~2.55905~gge3995~';
    const nets = ['', 'GND', 'B-IN'];
    expect(normalize(convertShape(input, conversionState(nets)))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:usb_mini',
          ['layer', 'F.Cu'],
          ['at', -867.232, -675.919, 90],
          [
            'fp_text',
            'user',
            'gge35720',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
          [
            'pad',
            '',
            'np_thru_hole',
            'circle',
            ['at', -656.62, 1077.211],
            ['size', 1.3, 1.3],
            ['drill', 1.3],
            ['layers', '*.Cu', '*.Mask'],
          ],
        ],
      ],
    ]);
  });

  it('should convert via with net assigned to pcb via', () => {
    const input =
      'LIB~585.7~338.9~package`usb_mini`value`mini~90~~gge35720~1~c25f~0~#@$VIA~4826.69~2924.02~5.9055~GND~2.55905~gge3995~';
    const nets = ['', 'GND', 'B-IN'];
    expect(normalize(convertShape(input, conversionState(nets)))).toEqual([
      [
        [
          'footprint',
          'EasyEDA:usb_mini',
          ['layer', 'F.Cu'],
          ['at', -867.232, -675.919, 90],
          [
            'fp_text',
            'user',
            'gge35720',
            ['at', 0, 0],
            ['layer', 'Cmts.User'],
            ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
          ],
        ],
        [
          'via',
          ['at', 209.979, -19.299],
          ['size', 1.5],
          ['drill', 1.3],
          ['layers', 'F.Cu', 'B.Cu'],
          ['net', 1],
        ],
      ],
    ]);
  });
});

describe('integration', () => {
  it('should successfully convert a simple 4-layer board (issue #33)', () => {
    const input = {
      head: {
        docType: '3',
        editorVersion: '6.4.3',
        newgId: true,
        c_para: {},
        hasIdFlag: true,
        x: '4020',
        y: '3438.5',
        importFlag: 0,
        transformList: '',
      },
      canvas: '',
      shape: ['TRACK~0.6~22~S$3354~4344.6 3172.8 4344.5 3225~gge2291~0'],
      layers: [] as string[],
      objects: [] as string[],
      BBox: { x: 4246, y: 3014, width: 227.5, height: 251 },
      preference: { hideFootprints: '', hideNets: '' },
      DRCRULE: {
        Default: {
          trackWidth: 1,
          clearance: 0.6,
          viaHoleDiameter: 2.4,
          viaHoleD: 1.2,
        },
        isRealtime: true,
        isDrcOnRoutingOrPlaceVia: false,
        checkObjectToCopperarea: true,
        showDRCRangeLine: true,
      },
      netColors: {},
    };
    expect(removeNullsAndFormating(convertBoardToArray(input))).toEqual([
      'kicad_pcb',
      ['version', 20210220],
      ['generator', 'pcbnew'],
      ['general', ['thickness', 1.6]],
      ['paper', 'A4'],
      [
        'layers',
        [0, 'F.Cu', 'signal'],
        [1, 'In1.Cu', 'signal'],
        [2, 'In2.Cu', 'signal'],
        [31, 'B.Cu', 'signal'],
        [32, 'B.Adhes', 'user'],
        [33, 'F.Adhes', 'user'],
        [34, 'B.Paste', 'user'],
        [35, 'F.Paste', 'user'],
        [36, 'B.SilkS', 'user'],
        [37, 'F.SilkS', 'user'],
        [38, 'B.Mask', 'user'],
        [39, 'F.Mask', 'user'],
        [40, 'Dwgs.User', 'user'],
        [41, 'Cmts.User', 'user'],
        [42, 'Eco1.User', 'user'],
        [43, 'Eco2.User', 'user'],
        [44, 'Edge.Cuts', 'user'],
        [45, 'Margin', 'user'],
        [46, 'B.CrtYd', 'user'],
        [47, 'F.CrtYd', 'user'],
        [48, 'B.Fab', 'user', 'hide'],
        [49, 'F.Fab', 'user', 'hide'],
      ],
      ['net', 0, ''],
      ['net', 1, 'S$3354'],
      [
        'segment',
        ['start', 87.52840000000009, 43.89120000000005],
        ['end', 87.503, 57.15],
        ['width', 0.1524],
        ['layer', 'In2.Cu'],
        ['net', 1],
      ],
      [
        'gr_text',
        '#1: Info: below are the conversion remarks. The conversion may contain errors.\\nPlease read the remarks carefully and run the DRC check to solve issues.\\nTo find a component mentioned in the remarks go to:\\nKicad menu Edit > Find and enter the EDA_id (gge....); search for other text items.\\nOnly the id of the footprint can be found; the id of the shape is in the input json.\\nYou can export the footprints to a library by Kicad menu File > Export > Export Fps to (new) Library',
        ['at', -200, 16.2, 0],
        ['layer', 'Cmts.User'],
        ['effects', ['font', ['size', 2, 2], ['thickness', 0.4]], ['justify', 'left']],
      ],
    ]);
  });
});

import * as fixtureJSON from './fixtures/testingSchematic-v6.json';
import {
  convertBus,
  convertBusEntry,
  convertNetflag,
  convertJunction,
  convertNetlabel,
  convertNoConnect,
  convertPolyline,
  convertText,
  convertWire,
  convertSchematicV6,
} from './schematic-v6';
import { ISpectraList } from './spectra';

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

function convertShape(shape: string) {
  const [type, ...args] = shape.split('~');
  switch (type) {
    case 'B':
      return convertBus(args);
    case 'BE':
      return convertBusEntry(args);
    case 'J':
      return convertJunction(args);
    case 'N':
      return convertNetlabel(args);
    case 'O':
      return convertNoConnect(args);
    case 'PL':
      return convertPolyline(args);
    case 'T':
      return convertText(args);
    case 'W':
      return convertWire(args);
    default:
      console.warn(`Warning: unsupported shape ${type}`);
      return null;
  }
}

describe('convertShape as standin for conversions from function convertSchematicV6ToArray', () => {
  it('should convert B (bus) into Kicad bus', () => {
    const input = 'B~435 -295 770 -295~#008800~2~0~none~gge277~0';
    expect(normalize(convertShape(input))).toEqual([
      ['bus', ['pts', ['xy', 110.49, -74.93], ['xy', 195.58, -74.93]]],
    ]);
  });

  it('should convert BE (bus entry) into Kicad bus entry with correct length', () => {
    const input = 'BE~270~435~-295~445~-285~gge298~0';
    expect(normalize(convertShape(input))).toEqual([
      ['bus_entry', ['at', 110.49, -74.93], ['size', 2.54, 2.54]],
    ]);
  });

  it('should convert W (wire) into Kicad wires with color enabled', () => {
    const input = 'W~335 -515 335 -545 470 -545~#00FF88~1~0~none~gge934~0';
    expect(normalize(convertShape(input))).toEqual([
      [
        'wire',
        ['pts', ['xy', 85.09, -130.81], ['xy', 85.09, -138.43]],
        ['stroke', ['width', 0], ['type', 'solid'], ['color', 0, 255, 136, 1]],
      ],
      [
        'wire',
        ['pts', ['xy', 85.09, -138.43], ['xy', 119.38, -138.43]],
        ['stroke', ['width', 0], ['type', 'solid'], ['color', 0, 255, 136, 1]],
      ],
    ]);
  });

  it('should convert J (junction) into Kicad junction with correct diameter and color', () => {
    const input = 'J~315~-475~3~#CC0000~gge932~0';
    expect(normalize(convertShape(input))).toEqual([
      ['junction', ['at', 80.01, -120.65], ['diameter', 1.219], ['color', 204, 0, 0, 1]],
    ]);
  });

  it('should convert O (no-connect) into Kicad no-connect', () => {
    const input = 'O~270~-495~gge467~M 266 -499 L 274 -491 M 274 -499 L 266 -491~#33cc33~0';
    expect(normalize(convertShape(input))).toEqual([['no_connect', ['at', 68.58, -125.73]]]);
  });

  it('should convert F (netlabel) into Kicad local label', () => {
    const input = 'N~250~-530~0~#0000ff~CLK~gge471~start~252~-532.5~Times New Roman~7pt~0';
    expect(normalize(convertShape(input))).toEqual([
      ['label', 'CLK', ['at', 63.5, -134.62, 180], ['effects', ['font', ['size', 1.27, 1.27]]]],
    ]);
  });
});
// this test will fail on the changed uuid; at least a check all other items are OK.
describe('convertSchematic full test', () => {
  it('should convert an EasyEDA schematic file to a Kicad schematic file', () => {
    const schRes = convertSchematicV6(fixtureJSON, 1);
    expect(schRes).toMatchSnapshot();
  });
});

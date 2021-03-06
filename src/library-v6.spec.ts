import * as fixtureJSON from './fixtures/testingLibrary-v6.json';
import { IProperties, convertLibrary, convertPin, convertText } from './library-v6';
import { IConversionState } from './schematic-v6';

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

const compProp: IProperties = {
  ref: '',
  value: '',
  pre: '',
  lib: '',
  rotation: 0,
  package: '',
  pinNameShowCount: 0,
  pinNameHideCount: 0,
  pinNumberShowCount: 0,
  pinNumberHideCount: 0,
  component: [],
};
const conversionState: IConversionState = {
  schRepCnt: 0,
  schReports: [],
  schReportsPosition: 0,
  libTypes: {},
  savedLibs: [],
  savedLibMsgs: [],
  convertingSymFile: true,
};
const transform = { x: 400, y: 300 };
const CRCTable: number[] = [];

function convertShape(shape: string) {
  const [type, ...args] = shape.split('~');
  switch (type) {
    case 'P':
      return convertPin(args, transform, compProp, conversionState);
    case 'T':
      return convertText(args, transform);
    default:
      console.warn(`Warning: unsupported shape ${type}`);
      return null;
  }
}
describe('convertShape as standin for conversions from function convertLibrary', () => {
  it('should convert P (pin) into Kicad pin', () => {
    const input =
      'P~show~3~3~450~310~0~gge25~0^^450~310^^M 450 310 h -14~#880000^^0~428~313~0~VCC~end~~5.5pt~#0000FF^^1~435~309~0~3~start~~5.5pt~#0000FF^^1~433~310^^0~M 430 307 L 427 310 L 430 313';
    expect(normalize(convertShape(input))).toEqual([
      [
        'pin',
        'bidirectional',
        'inverted',
        ['at', 12.7, -2.54, 180],
        ['length', 5.08],
        ['name', 'VCC', ['effects', ['font', ['size', 1.27, 1.27]]]],
        ['number', '3', ['effects', ['font', ['size', 1.27, 1.27]]]],
      ],
    ]);
  });
});

describe('convertLibrary full test', () => {
  it('should convert an EasyEDA library file to a Kicad symbol file', () => {
    const schRes = convertLibrary(null, fixtureJSON, conversionState, CRCTable);
    expect(schRes).toMatchSnapshot();
  });
});

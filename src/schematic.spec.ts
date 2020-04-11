import * as fixtureJSON from './fixtures/testingEasyEDA.json';
import { convertSchematic, convertShape } from './schematic';

describe('convertShape', () => {
  it('should convert wires', () => {
    const result = convertShape('W~650 305 650 300 800 300 800 255~#FF0000~1~0~none~gge1263~0');
    expect(result).toEqual([
      'Wire Wire Line',
      '    7150 3355 7150 3300',
      'Wire Wire Line',
      '    7150 3300 8800 3300',
      'Wire Wire Line',
      '    8800 3300 8800 2805',
    ]);
  });

  it('should convert junctions', () => {
    const result = convertShape('J~785~210~2.5~#CC0000~gge1272~0');
    expect(result).toEqual(['Connection ~ 8635 2310']);
  });

  it('should convert No-Connect Flag', () => {
    const result = convertShape(
      'O~510~495~gge1388~M 506 491 L 514 499 M 514 491 L 506 499~#33cc33~0'
    );
    expect(result).toEqual(['NoConn ~ 5610 5445']);
  });

  it('should return an empty array given an unsupported command', () => {
    const result = convertShape('Karin~was~here');
    expect(result).toEqual([]);
  });
});

describe('convertSchematic', () => {
  it('should convert an EasyEDA schematic file', () => {
    const schRes = convertSchematic(fixtureJSON);
    expect(schRes).toMatchSnapshot();
  });
});

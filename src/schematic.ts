// Doc: https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/index.html
import { flatten, kiAngle, kiUnits, uuid } from './common';
import { IEasyEDASchematic, IEasyEDASchematicCollection } from './easyeda-types';
import { encodeObject } from './spectra';

/// special implementation as the offset are different
export function kiAt(x: string | number, y: string | number, angle?: string | number) {
  return ['at', kiUnits(x), kiUnits(y), kiAngle(angle)];
}

function convertNoConnect(args: string[]) {
  const [pinDotX, pinDotY, id, pathStr, color, locked] = args;
  return ['no_connect', kiAt(pinDotX, pinDotY), uuid(id)];
}

function convertJunction(args: string[]) {
  const [pinDotX, pinDotY, junctionCircleRadius, fillColor, id, locked] = args;
  return ['junction', kiAt(pinDotX, pinDotY), ['diameter', 0], ['color', 0, 0, 0, 0], uuid(id)];
}

function convertWire(args: string[]) {
  const [points, strokeColor, strokeWidth, strokeStyle, fillColor, id, locked] = args;
  const coordList = points.split(' ');
  const result = [];
  for (let i = 0; i + 2 < coordList.length; i += 2) {
    result.push([
      'wire',
      [
        'pts',
        ['xy', kiUnits(coordList[i]), kiUnits(coordList[i + 1])],
        ['xy', kiUnits(coordList[i + 2]), kiUnits(coordList[i + 3])],
      ],
      [
        'stroke',
        ...[
          ['width', 0],
          ['type', 'default'],
          ['color', 0, 0, 0, 0],
        ],
      ],
      uuid(id + '-' + i),
    ]);
  }
  return result;
}

function convertNetLabel(args: string[]) {
  const [
    pinDotX,
    pinDotY,
    rotation,
    fillColor,
    name,
    id,
    anchor,
    posX,
    posY,
    font,
    fontSize,
    locked,
  ] = args;

  let justify = '';
  switch (anchor) {
    case 'start':
      justify = 'left';
      break;
    case 'end':
      justify = 'right';
      break;
  }

  const fontTable: { [key: string]: { width: number; height: number; thickness: number } } = {
    'NotoSerifCJKsc-Medium': { width: 0.8, height: 0.8, thickness: 0.3 },
    'NotoSansCJKjp-DemiLight': { width: 0.6, height: 0.6, thickness: 0.5 },
  };
  const fontMultiplier =
    font in fontTable ? fontTable[font] : { width: 0.9, height: 1, thickness: 0.9 };
  const actualFontWidth = kiUnits(fontSize) * fontMultiplier.width;
  const actualFontHeight = kiUnits(fontSize) * fontMultiplier.height;

  return [
    'label',
    name,
    kiAt(pinDotX, pinDotY, rotation),
    ['effects', ['font', ['size', actualFontHeight, actualFontWidth]], ['justify', justify]],
    uuid(id),
  ];
}

export async function convertShape(shape: string) {
  const [type, ...args] = shape.split('~');
  switch (type) {
    case 'W':
      return convertWire(args);
    case 'J':
      return [convertJunction(args)];
    case 'O':
      return [convertNoConnect(args)];
    case 'N':
      return [convertNetLabel(args)];
    default:
      console.warn(`Warning: unsupported shape ${type}`);
      return null;
  }
}

export async function convertSchematicToArray(input: IEasyEDASchematicCollection) {
  const { schematics } = input;
  if (schematics.length !== 1) {
    console.warn(`Found ${schematics.length} schematics, converting only the first one.`);
  }

  const schematic = schematics[0].dataStr as IEasyEDASchematic;
  const shapeArray = schematic.shape;
  const shapes = flatten(await Promise.all(shapeArray.map(convertShape)));
  const outputObjs = shapes.filter((obj) => obj != null);

  return [
    'kicad_sch',
    ['version', 20211123],
    ['generator', 'easyeda2kicad'],
    uuid(schematic.head.uuid),
    ['paper', 'A4'],
    ...outputObjs,
  ];
}

export async function convertSchematic(input: IEasyEDASchematicCollection) {
  return encodeObject(await convertSchematicToArray(input));
}

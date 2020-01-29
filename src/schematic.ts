// Doc: https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/index.html
import { IEasyEDASchematic, IEasyEDASchematicCollection } from './easyeda-types';

function kiUnits(value: string | number) {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  return value * 11;
}

function flatten<T>(arr: T[]) {
  return [].concat(...arr);
}

function convertWire(args: string[]) {
  const [points, strokeColor, strokeWidth, strokeStyle, fillColor, id, locked] = args;
  const coordList = points.split(' ');
  const result = [];
  for (let i = 0; i < coordList.length - 2; i += 2) {
    result.push('Wire Wire Line');
    result.push(
      '    ' +
        coordList
          .slice(i, i + 4)
          .map(kiUnits)
          .join(' ')
    );
  }
  return result;
}

function convertShape(shape: string) {
  const [type, ...args] = shape.split('~');
  switch (type) {
    case 'W':
      return convertWire(args);
    default:
      console.warn(`Warning: unsupported shape ${type}`);
      return [];
  }
}

export function convertSchematic(input: IEasyEDASchematicCollection) {
  const { schematics } = input;
  if (schematics.length !== 1) {
    console.warn(`Found ${schematics.length} schematics, converting only the first one.`);
  }

  const schematic = JSON.parse(schematics[0].dataStr) as IEasyEDASchematic;
  const shapeArray = schematic.shape;
  const shapeResult = flatten(shapeArray.map(convertShape)).join('\n');

  return `
EESchema Schematic File Version 4
EELAYER 30 0
EELAYER END
${shapeResult}
$EndSCHEMATC
`.trim();
}

import { IEasyEDALibrary, LibraryHead } from './easyeda-types';
import { encodeObject, ISpectraList } from './spectra';
import { computeArc } from './svg-arc';
import { kiUnits, IConversionState, reportError } from './schematic-v6';
import { v4 as uuid } from 'uuid';

// Doc: https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/index.html

interface ICoordinates {
  x: number;
  y: number;
  id?: string;
}

export interface IProperties {
  ref: string;
  value: string;
  pre: string;
  lib: string;
  rotation: number;
  package: string;
  component: ISpectraList;
  pinNameShowCount: number;
  pinNameHideCount: number;
  pinNumberShowCount: number;
  pinNumberHideCount: number;
}

function kiY(coordY: string): string {
  // Eda versus Kicad y-axis coordinates.
  // For Kicad lib is seems to work differently
  // compared to schematics.
  // The mind mind boggles!
  let kiY;
  if (coordY.includes('-')) {
    kiY = coordY.substring(1);
  } else {
    kiY = '-' + coordY;
  }
  return kiY;
}

function rotate({ x, y }: ICoordinates, degrees: number): ICoordinates {
  let radians = (degrees / 180) * Math.PI;
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}

function kiCoords(x: string, y: string, transform: ICoordinates = { x: 0, y: 0 }): ICoordinates {
  return {
    x: parseFloat(x) - transform.x,
    // Eda versus Kicad y-axis coordinates
    y: transform.y - parseFloat(y),
  };
}

function kiAt(x: string, y: string, angle: number, parentCoords?: ICoordinates): ISpectraList {
  const coords = kiCoords(x, y, parentCoords);
  return ['at', kiUnits(coords.x), kiUnits(coords.y), angle];
}

function kiEffects(
  fontSize: string,
  visible: string = '1',
  justify: string = '',
  bold: string = '',
  italic: string = ''
) {
  // FONT: 1.27 for the best layout in Kicad
  return [
    'effects',
    ['font', ['size', 1.27, 1.27]],
    italic === 'italic' ? 'italic' : null,
    bold === 'bold' ? 'bold' : null,
    justify === 'start' ? ['justify', 'left'] : justify === 'end' ? ['justify', 'right'] : null,
    visible === '1' ? null : 'hide',
  ];
}

function kiFillColor(stroke: string, fill: string): string {
  if (fill === 'none' || fill === '') {
    return 'none';
  } else if (stroke === fill) {
    return 'outline';
  } else {
    return 'background';
  }
}

export function convertPin(
  args: string[],
  parentCoords: ICoordinates,
  symbolProp: IProperties,
  conversionState: IConversionState
): ISpectraList {
  let pinRotation = 0;
  const segments: string[] = args.join('~').split('^^');
  const [pinDisplay, pinElectric, , pinX, pinY, pinRotate, id, locked] = segments[0].split('~');
  const [pinDotX, pinDotY] = segments[1].split('~');
  const [pinPath, pinColor] = segments[2].split('~');
  const [
    nameVisible,
    nameX,
    nameY,
    nameRotation,
    nameText,
    nameAnchor,
    nameFont,
    nameFontSize,
  ] = segments[3].split('~');
  const [
    numberVisible,
    numberX,
    numberY,
    numberRotation,
    numberText,
    numberAnchor,
    numberFont,
    numberFontSize,
  ] = segments[4].split('~');
  const [dotVisible, dotX, dotY] = segments[5].split('~');
  const [clockVisible, clockPath] = segments[6].split('~');
  // pinElectric=0 has been set to passive not to undefined for ERC reasons
  const electricType: { [key: string]: string } = {
    0: 'passive',
    1: 'input',
    2: 'output',
    3: 'bidirectional',
    4: 'power_in',
  };
  const graphicStyle: { [key: string]: string } = {
    '00': 'line',
    '01': 'clock',
    '10': 'inverted',
    '11': 'inverted_clock',
  };
  let pinLength = '0';
  let orientation = 'h';
  let startPoint = '0';
  const result = /^M\s*([-\d.\s]+)([h|v])\s*([-\d.\s]+)$/.exec(pinPath.replace(/[,\s]+/g, ' '));
  if (result != null) {
    [, startPoint, orientation, pinLength] = result;
  } else {
    const msg = `Warning: pin (${id})${
      parentCoords.id !== undefined ? ` of ${parentCoords.id}` : ''
    }: could not determine pin location; pin ignored `;
    return reportError(msg, conversionState);
  }
  // inverted pins have a length minus 6; add this to the length
  const pinlength = parseFloat(pinLength);
  let length: number;
  dotVisible === '1'
    ? pinlength > 0
      ? (length = pinlength + 6)
      : (length = pinlength - 6)
    : (length = pinlength);
  // Eda allows pins with zero length but seems to ignores them
  // Kicad will show them, so we ignore them.
  if (pinLength === '0') {
    const msg = `Warning: pin (${id})${
      parentCoords.id !== undefined ? ` of ${parentCoords.id}` : ''
    } with length = 0 found in symbol; pin ignored `;
    return reportError(msg, conversionState);
  }
  if (pinElectric === '4') {
    const msg =
      `Warning: pinElectric = power; power_in is assumed for pin ${nameText} (${id})${
        parentCoords.id !== undefined ? ` of ${parentCoords.id}` : ''
      }` + '\\nAdjust symbol electric properties when needed based on ERC check.';
    reportError(msg, conversionState, 2);
  }
  const [startX, startY] = startPoint.split(' ');
  if (orientation === 'h') {
    if (parseFloat(startX) == parseFloat(pinX) && parseFloat(pinLength) < 0) {
      pinRotation = 180;
    } else if (parseFloat(startX) == parseFloat(pinX) && parseFloat(pinLength) > 0) {
      pinRotation = 0;
    } else if (parseFloat(startX) != parseFloat(pinX) && parseFloat(pinLength) < 0) {
      pinRotation = 0;
    } else if (parseFloat(startX) != parseFloat(pinX) && parseFloat(pinLength) > 0) {
      pinRotation = 180;
    }
  }
  if (orientation === 'v') {
    if (parseFloat(startY) == parseFloat(pinY) && parseFloat(pinLength) < 0) {
      pinRotation = 90;
    } else if (parseFloat(startY) == parseFloat(pinY) && parseFloat(pinLength) > 0) {
      pinRotation = 270;
    } else if (parseFloat(startY) != parseFloat(pinY) && parseFloat(pinLength) < 0) {
      pinRotation = 270;
    } else if (parseFloat(startY) != parseFloat(pinY) && parseFloat(pinLength) > 0) {
      pinRotation = 90;
    }
  }
  // no individual pin/name hide in Kicad; base hide on overall hide status
  if (nameVisible === '1') {
    symbolProp.pinNameShowCount += 1;
  } else {
    symbolProp.pinNameHideCount += 1;
  }
  if (numberVisible === '1') {
    symbolProp.pinNumberShowCount += 1;
  } else {
    symbolProp.pinNumberHideCount += 1;
  }
  // note: Jan 2021; no color support for name & number fields
  return [
    '_LF3_',
    [
      'pin',
      electricType[pinElectric],
      graphicStyle[dotVisible + clockVisible],
      kiAt(pinDotX, pinDotY, pinRotation, parentCoords),
      ['length', Math.abs(kiUnits(length))],
      '_LF4_',
      ['name', nameText === '' ? '~' : nameText, kiEffects(nameFontSize)],
      '_LF4_',
      ['number', numberText, kiEffects(numberFontSize)],
    ],
  ];
}

function convertRect(args: string[], parentCoords: ICoordinates) {
  const [x, y, , , width, height, strokeColor, strokeWidth, , fillColor, id, locked] = args;
  const start = kiCoords(x, y, parentCoords);
  const endX = start.x + parseFloat(width);
  const endY = start.y - parseFloat(height);
  const fill = 'outline';
  return [
    '_LF3_',
    [
      'rectangle',
      ['start', kiUnits(start.x), kiUnits(start.y)],
      ['end', kiUnits(endX), kiUnits(endY)],
      ['stroke', ['width', 0]],
      ['fill', ['type', kiFillColor(strokeColor, fillColor)]],
    ],
  ];
}

function convertCircle(args: string[], parentCoords: ICoordinates) {
  const [cx, cy, radius, strokeColor, strokeWidth, , fillColor, id, locked] = args;
  const center = kiCoords(cx, cy, parentCoords);
  return [
    '_LF3_',
    [
      'circle',
      ['center', kiUnits(center.x), kiUnits(center.y)],
      ['radius', kiUnits(radius)],
      ['stroke', ['width', 0]],
      ['fill', ['type', kiFillColor(strokeColor, fillColor)]],
    ],
  ];
}

function convertEllipse(
  args: string[],
  parentCoords: ICoordinates,
  conversionState: IConversionState
): ISpectraList {
  const [cx, cy, rx, ry, strokeColor, strokeWidth, , fillColor, id, locked] = args;
  if (rx === ry) {
    const center = kiCoords(cx, cy, parentCoords);
    return [
      '_LF3_',
      [
        'circle',
        ['center', kiUnits(center.x), kiUnits(center.y)],
        ['radius', kiUnits(rx)],
        ['stroke', ['width', 0]],
        ['fill', ['type', kiFillColor(strokeColor, fillColor)]],
      ],
    ];
  } else {
    const msg = `Warning: shape E (ellips) with unequal radiuses (${id})${
      parentCoords.id !== undefined ? ` of ${parentCoords.id}` : ''
    } in symbol; not supported by Kicad`;
    return reportError(msg, conversionState);
  }
}

function convertArc(
  args: string[],
  parentCoords: ICoordinates,
  conversionState: IConversionState
): ISpectraList {
  const [path, , strokeColor, strokeWidth, , fillColor, id, locked] = args;
  let startPoint;
  let arcParams;
  const result = /^M\s*([-\d.\s]+)A\s*([-\d.\s]+)$/.exec(path.replace(/[,\s]+/g, ' '));
  if (result != null) {
    [, startPoint, arcParams] = result;
  } else {
    const msg = `Warning: arc (${id})${
      parentCoords.id !== undefined ? ` of ${parentCoords.id}` : ''
    }: could not determine arc shape; arc ignored `;
    return reportError(msg, conversionState);
  }
  const [startX, startY] = startPoint.split(' ');
  const [svgRx, svgRy, xAxisRotation, largeArc, sweep, endX, endY] = arcParams.split(' ');
  const start = kiCoords(startX, startY, parentCoords);
  const end = kiCoords(endX, endY, parentCoords);
  const { x: rx, y: ry } = rotate({ x: parseFloat(svgRx), y: parseFloat(svgRy) }, 0);
  const { cx, cy, extent } = computeArc(
    start.x,
    start.y,
    rx,
    ry,
    parseFloat(xAxisRotation),
    largeArc === '1',
    sweep === '1',
    end.x,
    end.y
  );
  return [
    '_LF3_',
    [
      'arc',
      ['start', kiUnits(start.x), kiUnits(start.y)],
      ['end', kiUnits(end.x), kiUnits(end.y)],
      ['radius', ['at', kiUnits(cx), kiUnits(cy)], ['length', kiUnits(rx)]],
      ['stroke', ['width', 0]],
      ['fill', ['type', kiFillColor(strokeColor, fillColor)]],
    ],
  ] as ISpectraList;
}

function pointListToPolygon(
  points: string[],
  closed: boolean = false,
  strokeColor: string,
  fillColor: string,
  parentCoords: ICoordinates = { x: 0, y: 0 }
): ISpectraList {
  const polygonPoints = [];
  for (let i = 0; i < points.length; i += 2) {
    const coords = kiCoords(points[i], points[i + 1], parentCoords);
    polygonPoints.push(['xy', kiUnits(coords.x), kiUnits(coords.y)]);
  }
  if (closed) {
    const coords = kiCoords(points[0], points[1], parentCoords);
    polygonPoints.push(['xy', kiUnits(coords.x), kiUnits(coords.y)]);
  }
  return [
    '_LF3_',
    [
      'polyline',
      ['pts', ...polygonPoints],
      ['stroke', ['width', 0]],
      ['fill', ['type', kiFillColor(strokeColor, fillColor)]],
    ],
  ];
}

function convertPolyline(args: string[], parentCoords: ICoordinates): ISpectraList {
  const [points, strokeColor, strokeWidth, , fillColor, id, locked] = args;
  return [...pointListToPolygon(points.split(' '), false, strokeColor, fillColor, parentCoords)];
}

function convertPolygon(args: string[], parentCoords: ICoordinates) {
  const [points, strokeColor, strokeWidth, , fillColor, id, locked] = args;
  return [...pointListToPolygon(points.split(' '), true, strokeColor, fillColor, parentCoords)];
}

function convertPath(
  args: string[],
  parentCoords: ICoordinates,
  conversionState: IConversionState
): ISpectraList {
  const [points, strokeColor, strokeWidth, , fillColor, id, locked] = args;
  let closed = false;
  if (/[A,C,H,Q,S,V]/gi.exec(points)) {
    const msg = `Warning: PT (path) with arcs/circles (${id})${
      parentCoords.id !== undefined ? ` of ${parentCoords.id}` : ''
    } in symbol; not supported by Kicad`;
    return reportError(msg, conversionState);
  }
  if (/[Z]/gi.exec(points)) {
    closed = true;
  }
  const filteredPoints = points.split(/[ ,LMZ]/).filter((p) => !isNaN(parseFloat(p)));
  return [...pointListToPolygon(filteredPoints, closed, strokeColor, fillColor, parentCoords)];
}

function convertLine(args: string[], parentCoords: ICoordinates): ISpectraList {
  const [sx, sy, ex, ey, strokeColor, strokeWidth, , fillColor, id, locked] = args;
  const points = [sx, sy, ex, ey];
  return [...pointListToPolygon(points, true, strokeColor, fillColor, parentCoords)];
}

export function convertText(args: string[], parentCoords: ICoordinates): ISpectraList | null {
  const [
    type,
    x,
    y,
    rotation,
    ,
    ,
    fontSize,
    fontWeigth,
    fontStyle,
    ,
    spice,
    text,
    visable,
    textAnchor,
    id,
    locked,
  ] = args;
  if (type === 'L') {
    const coords = kiCoords(x, y, parentCoords);
    // note: Jan 2021; no color support for text fields
    return [
      '_LF3_',
      [
        'text',
        text,
        // possible error in Kicad: angle 90 is in config 900
        ['at', kiUnits(coords.x), kiUnits(coords.y), rotation === '90' ? 900 : 0],
        kiEffects(fontSize, visable, textAnchor, fontWeigth, fontStyle),
      ],
    ];
  } else {
    return null;
  }
}

function convertAnnotations(
  args: string[],
  parentCoords: ICoordinates,
  compProp: IProperties,
  conversionState: IConversionState
): any {
  const [type, x, y, rotation, , , fontSize, , , , , text, visible] = args;
  let key = '';
  let number = 0;
  let prop;
  if (type === 'P' || type === 'N') {
    if (type === 'P') {
      key = 'Reference';
      number = 0;
      if (text.indexOf('.') > 0) {
        const msg =
          `Warning: multipart shape ${text} found on schematics; not yet supported.` +
          '\\nDrawn parts cannot share one footprint. Current solution: ' +
          '\\nCreate new multi-unit symbol and paste existing symbols into the units' +
          '\\nChange symbols in schematics with the new units of the multi-part symbol.';
        reportError(msg, conversionState, 4);
      }
      prop = `${text.replace(/[0-9\.]/g, '')}`;
      compProp.ref = text;
      compProp.pre = prop;
    }
    if (type === 'N') {
      key = 'Value';
      number = 1;
      prop = '';
      compProp.value = text;
    }
    compProp.component = [
      '_LF1_',
      [
        'property',
        key,
        text,
        ['id', number],
        kiAt(x, kiY(y), 0),
        kiEffects(fontSize, visible, 'start'),
      ],
    ];
  } else {
    compProp.component = [];
    return [];
  }
  return [
    '_LF2_',
    [
      'property',
      key,
      prop,
      ['id', number],
      ['at', 0, 0, 0],
      ['effects', ['font', ['size', 1.27, 1.27]], visible === '1' ? null : 'hide'],
    ],
  ];
}

function convertHead(head: LibraryHead, compProp: IProperties): ISpectraList {
  const libProperties: ISpectraList = [];
  let number;
  let hide;
  const properties: { [key: string]: Array<string | number> } = {
    Reference: ['pre', 0, ''],
    Value: ['name', 1, ''],
    Footprint: ['package', 2, 'hide'],
    //Datasheet: ['', 3, 'hide'], NOT AVAILABLE
    ki_keywords: ['name', 4, 'hide'],
    ki_description: ['BOM_Manufacturer', 5, 'hide'],
  };
  compProp.value = '';
  Object.keys(properties).forEach(function (key) {
    const libkey = properties[key][0];
    if (head.c_para.hasOwnProperty(libkey)) {
      number = properties[key][1];
      hide = properties[key][2];
      let prop = head.c_para[libkey];
      switch (key) {
        case 'Reference':
          prop = prop.split('?')[0];
          break;
        case 'Value':
          compProp.value = prop;
          break;
        case 'ki_keywords':
          prop = prop.split('(')[0];
          break;
        case 'ki_description':
          prop = 'part manufactured by: ' + prop;
      }
      libProperties.push([
        '_LF2_',
        [
          'property',
          key,
          prop,
          ['id', number],
          ['at', 0, 0, 0],
          ['effects', ['font', ['size', 1.27, 1.27]], hide === 'hide' ? 'hide' : null],
        ],
      ]);
    }
  });
  return libProperties;
}

function shapeToCRC32(str: string, CRCTable: number[]): number {
  let crc = -1;
  for (let i = 0, iTop = str.length; i < iTop; i++) {
    crc = (crc >>> 8) ^ CRCTable[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function symbolCompare(
  symbol: string,
  shape: ISpectraList,
  conversionState: IConversionState,
  compProp: IProperties,
  CRCTable: number[]
) {
  const crcKey = shapeToCRC32(encodeObject(shape), CRCTable);
  if (conversionState.libTypes.hasOwnProperty(crcKey)) {
    compProp.lib = conversionState.libTypes[crcKey];
    conversionState.savedLibMsgs.push(
      `Info: symbol for ${symbol} (rotation:${compProp.rotation}) exits as ${compProp.lib}`
    );
    return false;
  } else {
    const name = `${compProp.pre}_${crcKey.toString(16).toUpperCase()}`;
    conversionState.libTypes[crcKey] = name;
    compProp.lib = name;
    conversionState.savedLibMsgs.push(
      `Info: symbol for ${symbol} (rotation:${compProp.rotation}) is new as ${name}`
    );
    return true;
  }
}

export function convertLibrary(
  schematicsLIB: string | null,
  library: IEasyEDALibrary | null,
  conversionState: IConversionState,
  CRCTable: number[]
): ISpectraList {
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
  const unsupportedShapes: { [key: string]: string } = {
    AR: 'arrow',
    I: 'image',
    PI: 'pie',
  };
  const symbolLibText: ISpectraList = [];
  const symbolLibArc: ISpectraList = [];
  const symbolLibCircle: ISpectraList = [];
  const symbolLibRect: ISpectraList = [];
  const symbolLibPoly: ISpectraList = [];
  const symbolLibPin: ISpectraList = [];
  let symbolLibProp: ISpectraList = [];
  let errorReports: ISpectraList = [];
  let newComponent: ISpectraList = [];
  let newComponentInstance: ISpectraList = [];
  let newComponentProp: ISpectraList = [];
  //
  // Eda library .json input document is processed
  //
  if (library !== null) {
    const transform: ICoordinates = { x: library.head.x, y: library.head.y };
    symbolLibProp = flatten(convertHead(library.head, compProp));
    for (const shape of library.shape) {
      const [type, ...shapeArgs] = shape.split('~');
      if (type === 'P') {
        const result = convertPin(shapeArgs, transform, compProp, conversionState);
        if (result !== null) {
          symbolLibPin.push(...result);
        }
      } else if (type === 'T') {
        const result = convertText(shapeArgs, transform);
        if (result !== null) {
          symbolLibText.push(...result);
        }
      } else if (type === 'A') {
        const result = convertArc(shapeArgs, transform, conversionState);
        if (result !== null) {
          symbolLibArc.push(...result);
        }
      } else if (type === 'C') {
        symbolLibCircle.push(...convertCircle(shapeArgs, transform));
      } else if (type === 'E') {
        const result = convertEllipse(shapeArgs, transform, conversionState);
        if (result !== null) {
          symbolLibCircle.push(...result);
        }
      } else if (type === 'R') {
        symbolLibRect.push(...convertRect(shapeArgs, transform));
      } else if (type === 'L') {
        symbolLibPoly.push(...convertLine(shapeArgs, transform));
      } else if (type === 'PL') {
        symbolLibPoly.push(...convertPolyline(shapeArgs, transform));
      } else if (type === 'PG') {
        symbolLibPoly.push(...convertPolygon(shapeArgs, transform));
      } else if (type === 'PT') {
        const result = convertPath(shapeArgs, transform, conversionState);
        if (result !== null) {
          symbolLibPoly.push(...result);
        }
      } else if (unsupportedShapes.hasOwnProperty(type)) {
        const msg = `Warning: ${unsupportedShapes[type]} (${type}) shape found in library; not supported by Kicad `;
        reportError(msg, conversionState);
      } else {
        const msg = `Warning: unknown shape ${type} found; ignored`;
        reportError(msg, conversionState);
      }
    }
    errorReports = flatten(conversionState.schReports);
    return [
      '_LF1_',
      [
        'symbol',
        // 'EasyEDA' should be the file name of the library,
        // but it seems not to be mandatory: EasyEDA.kicad_sym
        // multiple symbols can be manually collected in this library
        'EasyEDA:' + compProp.ref,
        // pin names and number are auto placed (no coords needed)
        // show or hide are controlled globally based on the
        // show & hide count of the Eda symbol
        compProp.pinNumberShowCount < compProp.pinNumberHideCount ? ['pin_numbers', 'hide'] : null,
        // X controls name placing : (pin_names (offset X))
        // 0 = outside (above/below pin); 2 = inside (next to pin)
        [
          'pin_names',
          ['offset', 2],
          compProp.pinNameShowCount < compProp.pinNameHideCount ? 'hide' : null,
        ],
        // standard defaults
        ['in_bom', 'yes'],
        ['on_board', 'yes'],
        // here only the properties
        // note: positioned at the center of the symbol (0,0)
        // they will be auto placed outside the symbol in the schematic
        ...symbolLibProp,
        '_LF2_',
        // here only the text definitions
        ['symbol', compProp.ref + '_0_0', ...symbolLibText, ...errorReports],
        '_LF2_',
        // here all other than property, pin & text definitions
        [
          'symbol',
          `${compProp.ref}_0_1`,
          ...symbolLibArc,
          ...symbolLibCircle,
          ...symbolLibRect,
          ...symbolLibPoly,
        ],
        '_LF2_',
        // here only the pin definitions
        ['symbol', `${compProp.ref}_1_1`, ...symbolLibPin],
      ],
    ];
    //
    // called from schematics-v6 for processing LIB shape
    //
  } else if (schematicsLIB !== null) {
    const [libHead, ...shapeList] = schematicsLIB.split('#@$');
    const [x, y, attributes, rotation, importFlag, id, locked] = libHead.split('~');
    // don't process sheet layout LIB
    if (id === 'frame_lib_1') {
      return [];
    }
    const angle = rotation === '' ? 0 : parseInt(rotation);
    const transform: ICoordinates = {
      x: parseInt(x),
      y: parseInt(y),
      id: id,
    };
    const attrList = attributes.split('`');
    const attrs: { [key: string]: string } = {};
    for (let i = 0; i < attrList.length; i += 2) {
      attrs[attrList[i]] = attrList[i + 1];
    }
    compProp.package = attrs['package'];
    compProp.rotation = rotation === '' ? 0 : parseInt(rotation);
    newComponentProp.push(
      ...[
        '_LF2_',
        [
          'property',
          'EDA_id',
          id,
          ['id', 4],
          ['at', kiUnits(x), kiUnits(y), 0],
          ['effects', ['font', ['size', 1.27, 1.27]], 'hide'],
        ],
      ]
    );
    for (const shape of shapeList) {
      const [type, ...shapeArgs] = shape.split('~');
      if (type === 'P') {
        const result = convertPin(shapeArgs, transform, compProp, conversionState);
        if (result !== null) {
          symbolLibPin.push(...result);
        }
      } else if (type === 'T') {
        const result = convertText(shapeArgs, transform);
        if (result !== null) {
          symbolLibText.push(...result);
        }
        symbolLibProp.push(...convertAnnotations(shapeArgs, transform, compProp, conversionState));
        if (compProp.component != []) {
          newComponentProp.push(...compProp.component);
          compProp.component = [];
        }
      } else if (type === 'A') {
        const result = convertArc(shapeArgs, transform, conversionState);
        if (result !== null) {
          symbolLibArc.push(...result);
        }
      } else if (type === 'C') {
        symbolLibCircle.push(...convertCircle(shapeArgs, transform));
      } else if (type === 'E') {
        const result = convertEllipse(shapeArgs, transform, conversionState);
        if (result !== null) {
          symbolLibCircle.push(...result);
        }
      } else if (type === 'R') {
        symbolLibRect.push(...convertRect(shapeArgs, transform));
      } else if (type === 'L') {
        symbolLibPoly.push(...convertLine(shapeArgs, transform));
      } else if (type === 'PL') {
        symbolLibPoly.push(...convertPolyline(shapeArgs, transform));
      } else if (type === 'PG') {
        symbolLibPoly.push(...convertPolygon(shapeArgs, transform));
      } else if (type === 'PT') {
        const result = convertPath(shapeArgs, transform, conversionState);
        if (result !== null) {
          symbolLibPoly.push(...result);
        }
      } else if (unsupportedShapes.hasOwnProperty(type)) {
        const msg = `Warning: ${unsupportedShapes[type]} (${type}) shape found in library ${id}; not supported by Kicad `;
        reportError(msg, conversionState);
      } else {
        const msg = `Warning: unknown shape ${type} found with id ${id}; ignored`;
        reportError(msg, conversionState);
      }
    }
    // collect the shape info to compare symbols
    const symbolShape: ISpectraList = [
      ...symbolLibText,
      ...symbolLibArc,
      ...symbolLibCircle,
      ...symbolLibRect,
      ...symbolLibPoly,
      ...symbolLibPin,
    ];
    //
    // create new lib symbol if compare fails
    //
    let newSymbol: boolean = false;
    if (symbolCompare(compProp.ref, symbolShape, conversionState, compProp, CRCTable)) {
      let symbol: ISpectraList = [];
      newSymbol = true;
      symbol = [
        '_LF1_',
        [
          'symbol',
          'EasyEDA:' + compProp.lib,
          compProp.pinNumberShowCount < compProp.pinNumberHideCount
            ? ['pin_numbers', 'hide']
            : null,
          [
            'pin_names',
            ['offset', 2],
            compProp.pinNameShowCount < compProp.pinNameHideCount ? 'hide' : null,
          ],
          ['in_bom', 'yes'],
          ['on_board', 'yes'],
          ...symbolLibProp,
          '_LF2_',
          ['symbol', compProp.lib + '_0_0', ...symbolLibText, ...errorReports],
          '_LF2_',
          [
            'symbol',
            `${compProp.lib}_0_1`,
            ...symbolLibArc,
            ...symbolLibCircle,
            ...symbolLibRect,
            ...symbolLibPoly,
          ],
          '_LF2_',
          ['symbol', `${compProp.lib}_1_1`, ...symbolLibPin],
        ],
      ];
      conversionState.savedLibs.push(symbol);
    }
    //
    // create component & component instance
    //
    const compUuid: string = uuid();
    newComponent = [
      '_LF_',
      '_LF_',
      [
        'symbol',
        ['lib_id', 'EasyEDA:' + compProp.lib],
        kiAt(x, kiY(y), 0),
        ['unit', 1],
        ['in_bom', 'yes'],
        ['on_board', 'yes'],
        ['uuid', compUuid],
        ...newComponentProp,
      ],
    ];
    newComponentInstance = [
      '_LF1_',
      [
        'path',
        '/' + compUuid,
        ['reference', compProp.ref],
        ['unit', 1],
        ['value', compProp.value],
        ['footprint', compProp.package],
      ],
    ];
    return [newComponentInstance, newComponent];
  }
  return ['Conversion error'];
}

function flatten<T>(arr: T[]) {
  return ([] as T[]).concat(...arr);
}
function convertLibraryToV6Array(library: IEasyEDALibrary): ISpectraList {
  const conversionState: IConversionState = {
    schRepCnt: 0,
    schReports: [],
    schReportsPosition: 0,
    libTypes: {},
    savedLibs: [],
    savedLibMsgs: [],
    convertingSymFile: true,
  };
  const result = convertLibrary(null, library, conversionState, [0]);
  return [
    //
    // Kicad lib symbols are normalized with 0,0 as center
    // based on the head x,y coords of the Eda LIB
    //
    // note-1: multi part symbols NOT YET supported.
    // note-2: schematics shared symbols are only implemented
    //         for symbols with the same Eda rotation angle.
    //
    'kicad_symbol_lib',
    ['version', 20210126],
    ['generator', 'kicad_symbol_editor'],
    ...result,
  ];
}
// main.ts will automatically detect an Eda library .json as input.
//
// How to get a Eda library .json file:
// go to Eda on line editor and click on library icon (on left side),
// select wanted symbol and click EDIT button
// choose menu File > EasyEDa File Source > click DOWNLOAD button.
//
// The generated output file is saved as symbol-name.kicad_sym.
// Import file in Kicad using:
// menu Preferences > Manage Symbol Libraries
export function convertLibraryV6(library: IEasyEDALibrary): string {
  return encodeObject(convertLibraryToV6Array(library));
}

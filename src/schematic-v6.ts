// Doc: https://docs.easyeda.com/en/DocumentFormat/2-EasyEDA-Schematic-File-Format/index.html
import { IEasyEDASchematic, IEasyEDASchematicCollectionV6 } from './easyeda-types';
import { encodeObject } from './spectra';
import { v4 as uuid } from 'uuid';
import { convertLibrary } from './library-v6';

interface ICoordinates {
  x: number;
  y: number;
}

interface INetflags {
  $GND: boolean;
  $GND1: boolean;
  $GND2: boolean;
  $Vplus: boolean;
  $Vminus: boolean;
}

export function kiUnits(value: string | number) {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  // Note: unit conversion is done at the very end.
  // This makes debugging easier;
  // during debugging of functions the Eda
  // coordinates from .json  will be shown.
  // By removing the multiplication factor here
  // this is also reflected in the conversion
  // output file: 'return value; // * 0.254;'
  return value * 0.254;
}

function kiAngle(value: string) {
  if (value == null) {
    return null;
  }
  var angle = parseFloat(value);
  angle = angle + 180;
  if (!isNaN(angle)) {
    return angle < 360 ? angle : angle - 360;
  }
  return 0;
}

function kiCoords(x: string, y: string): ICoordinates {
  return {
    x: parseInt(x),
    y: parseInt(y),
  };
}

function kiAt(x: string, y: string, angle?: string) {
  const coords = kiCoords(x, y);
  if (angle != undefined) {
    return ['at', kiUnits(coords.x), kiUnits(coords.y), kiAngle(angle)];
  } else {
    return ['at', kiUnits(coords.x), kiUnits(coords.y)];
  }
}

function kiLineStyle(style: string) {
  // kicad default = solid
  const styleTable: { [key: string]: string } = {
    0: 'solid',
    1: 'dash',
    2: 'dot',
  };
  style === '' ? '0' : style;
  return styleTable[style];
}

function kiLineWidth(widthStr: string) {
  // Kicad default = 0 gives width of 0.152mm
  var width = parseInt(widthStr);
  if (width > 1) {
    return width * 0.152;
  } else {
    return 0;
  }
}

function kiEffects(
  fontSize: string,
  visible: string = '1',
  justify: string = '',
  bold: string = '',
  italic: string = ''
) {
  // Fonts: kicad default = 1.27 mm; Eda between 5 - 7pt
  // note: library items are converted to 1.27 mm as standard.
  // to keep aligned with the libs all font sizes upto 7pt
  // are kept at 1.27mm; above 7pt the size will be scaled
  // note: Jan 2021 - thickness is not (yet?) supported by
  // Kicad gui. By editing, text item will loose this property.
  var size: number;
  var thickness = 0;
  fontSize === '' ? (fontSize = '1.27') : fontSize;
  let font = parseFloat(fontSize.replace('pt', ''));
  if (isNaN(font)) {
    size = 1.27;
  } else {
    if (font > 7) {
      size = font * 0.2;
      thickness = font * 0.05;
    } else {
      size = 1.27;
    }
  }
  return [
    'effects',
    [
      'font',
      ['size', size, size],
      thickness === 0 ? null : ['thickness', thickness],
      italic === 'italic' ? 'italic' : null,
      bold === 'bold' ? 'bold' : null,
    ],
    justify === 'start' ? ['justify', 'left'] : justify === 'end' ? ['justify', 'right'] : null,
    visible === '1' ? null : 'hide',
  ];
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function kiColor(hex: string) {
  // color support for selected Kicad items
  // note: not all Eda color support can be enabled in Kicad
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result != null) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return ['color', r, g, b, 1];
  } else {
    return ['color', 0, 0, 0, 0];
  }
}

function nfToPolygon(points: string[]) {
  // special function for netflag support
  const polygonPoints = [];
  for (let i = 0; i < points.length; i += 2) {
    polygonPoints.push(['xy', parseFloat(points[i]), parseFloat(points[i + 1])]);
  }
  return polygonPoints;
}

function kiPts(startX: string, startY: string, endX: string, endY: string) {
  const start = kiCoords(startX, startY);
  const end = kiCoords(endX, endY);
  return [
    'pts',
    ['xy', kiUnits(start.x), kiUnits(start.y)],
    ['xy', kiUnits(end.x), kiUnits(end.y)],
  ];
}

export function pointListToPolygon(points: string[], closed: boolean = false) {
  const polygonPoints = [];
  for (let i = 0; i < points.length; i += 2) {
    const coords = kiCoords(points[i], points[i + 1]);
    polygonPoints.push(['xy', kiUnits(coords.x), kiUnits(coords.y)]);
  }
  if (closed) {
    const coords = kiCoords(points[0], points[1]);
    polygonPoints.push(['xy', kiUnits(coords.x), kiUnits(coords.y)]);
  }
  return polygonPoints;
}

export function convertPolyline(args: string[]) {
  const [points, strokeColor, strokeWidth, stokeStyle, fillColor, id, locked] = args;
  return [
    '_LF_',
    [
      'polyline',
      ['pts', ...pointListToPolygon(points.split(' '))],
      [
        'stroke',
        ['width', kiLineWidth(strokeWidth)],
        ['type', kiLineStyle(stokeStyle)],
        kiColor(strokeColor),
      ],
    ],
  ];
}

export function convertText(args: string[]) {
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
    // note: Jan 2021; no Kicad color support for text fields
    return [
      '_LF_',
      [
        'text',
        text,
        kiAt(x, y, rotation),
        kiEffects(fontSize, visable, textAnchor, fontWeigth, fontStyle),
      ],
    ];
  } else {
    return [null];
  }
}

export function convertNoConnect(args: string[]) {
  // note: Eda does not require unused pins to have the noconnect flag
  // to run Kicad ERC it is recommended to add them manually
  const [pinDotX, pinDotY, id, pathStr, color, locked] = args;
  return ['_LF_', ['no_connect', kiAt(pinDotX, pinDotY)]];
}

export function convertJunction(args: string[]) {
  // note: junction color and size are enabled
  const [pinDotX, pinDotY, junctionCircleRadius, fillColor, id, locked] = args;
  // Eda radius default = 2.5; Kicad default diameter = 1.016mm
  const edaRadius = parseFloat(junctionCircleRadius);
  const radius = edaRadius === 2.5 ? 1.016 : edaRadius * 0.4064;
  return ['_LF_', ['junction', kiAt(pinDotX, pinDotY), ['diameter', radius], kiColor(fillColor)]];
}

export function convertWire(args: string[]) {
  // note: wire color and wire width are enabled
  const [points, strokeColor, strokeWidth, strokeStyle, fillColor, id, locked] = args;
  const coordList = points.split(' ');
  const wires = [];
  for (let i = 0; i < coordList.length - 2; i += 2) {
    wires.push('_LF_', [
      'wire',
      kiPts(coordList[i], coordList[i + 1], coordList[i + 2], coordList[i + 3]),
      [
        'stroke',
        ['width', kiLineWidth(strokeWidth)],
        ['type', kiLineStyle(strokeStyle)],
        kiColor(strokeColor),
      ],
    ]);
  }
  return wires;
}

export function convertNetlabel(args: string[]) {
  const [
    pinDotX,
    pinDotY,
    rotation,
    fillColor,
    name,
    id,
    textAnchor,
    px,
    py,
    font,
    fontSize,
    locked,
  ] = args;
  // Eda netlabels are converted to Kicad local labels.
  // Eda supports more than one netlabel per net; this causes problems in Kicad.
  // Run ERC to manually solve the conficting netlabel issues.
  // You can keep the conlicting labels by converting them to text labels:
  // select label > right mouse button > item "Change to text"
  // When needed they can be change back to label in the same way.
  //
  // note: local labels do not support multi sheet schematics and
  // Kicad global labels cannot be used to convert Eda netlabels.
  // Netlabels can however be converted to global labels in Kicad gui.
  // For global labels the Eda netport should have been used.
  return [
    '_LF_',
    ['label', name, kiAt(pinDotX, pinDotY, rotation), kiEffects('1.27', '1', textAnchor)],
  ];
}

export function convertNetPort(args: string[]) {
  // netflag type netport are changed to Kicad global labels.
  const [pinDotX, pinDotY, rotation, netFlag, textAnchor] = args;
  return [
    '_LF_',
    [
      'global_label',
      netFlag,
      ['shape', 'bidirectional'],
      kiAt(pinDotX, pinDotY, rotation),
      kiEffects('1.27', '1', textAnchor),
    ],
  ];
}

export function convertNetflag(args: string[], nfSymbolPresent: INetflags) {
  // Eda netflags will be changed to Kicad power symbols, except
  // 'part_netLabel_netPort'. This will become a global label.
  const segments: string[] = args.join('~').split('^^');
  const [partId, x, y, rotation, id, locked] = segments[0].split('~');
  const [pinDotX, pinDotY] = segments[1].split('~');
  const [netFlag, color, px, py, rot, textAnchor, visible, font, fontSize] = segments[2].split('~');
  var shape: any[] = [];
  var points;
  var libtype;
  var show;
  var createNewSymbol = false;
  switch (partId) {
    case 'part_netLabel_gnD':
      libtype = '$GND';
      show = '0';
      if (!nfSymbolPresent.$GND) {
        nfSymbolPresent.$GND = true;
        createNewSymbol = true;
        points = '0 0 0 -1.27 1.27 -1.27 0 -2.54 -1.27 -1.27 0 -1.27';
        shape = ['_LF3_', ['polyline', ['pts', ...nfToPolygon(points.split(' '))]]];
      }
      break;
    case 'part_netLabel_GNd':
      libtype = '$GND1';
      show = '0';
      if (!nfSymbolPresent.$GND1) {
        nfSymbolPresent.$GND1 = true;
        createNewSymbol = true;
        shape = [
          '_LF3_',
          ['polyline', ['pts', ...nfToPolygon('-0.635 -1.905 0.635 -1.905'.split(' '))]],
          '_LF3_',
          ['polyline', ['pts', ...nfToPolygon('-0.127 -2.54 0.127 -2.54'.split(' '))]],
          '_LF3_',
          ['polyline', ['pts', ...nfToPolygon('0 -1.27 0 0'.split(' '))]],
          '_LF3_',
          ['polyline', ['pts', ...nfToPolygon('1.27 -1.27 -1.27 -1.27'.split(' '))]],
        ];
      }
      break;
    case 'part_netLabel_gNd':
      libtype = '$GND2';
      show = '0';
      if (!nfSymbolPresent.$GND2) {
        nfSymbolPresent.$GND2 = true;
        createNewSymbol = true;
        shape = [
          '_LF3_',
          [
            'rectangle',
            ['start', -1.27, -1.524],
            ['end', 1.27, -2.032],
            ['stroke', ['width', 0.254]],
            ['fill', ['type', 'outline']],
          ],
          '_LF3_',
          ['polyline', ['pts', ...nfToPolygon('0 0 0 -1.524'.split(' '))]],
        ];
      }
      break;
    case 'part_netLabel_VCC':
    case 'part_netLabel_+5V':
      if (netFlag.charAt(0) === '-') {
        libtype = '$Vminus';
        show = visible;
        if (!nfSymbolPresent.$Vminus) {
          nfSymbolPresent.$Vminus = true;
          createNewSymbol = true;
          points = '0 0 0 1.27 -0.762 1.27 0 2.54 0.762 1.27 0 1.27';
          shape = [
            '_LF3_',
            ['polyline', ['pts', ...nfToPolygon(points.split(' '))], ['fill', ['type', 'outline']]],
          ];
        }
      } else {
        libtype = '$Vplus';
        if (!nfSymbolPresent.$Vplus) {
          nfSymbolPresent.$Vplus = true;
          createNewSymbol = true;
          shape = [
            '_LF3_',
            ['polyline', ['pts', ...nfToPolygon('-0.762 1.27 0 2.54'.split(' '))]],
            '_LF3_',
            ['polyline', ['pts', ...nfToPolygon('0 0 0 2.54'.split(' '))]],
            '_LF3_',
            ['polyline', ['pts', ...nfToPolygon('0 2.54 0.762 1.27'.split(' '))]],
          ];
        }
      }
      break;
    case 'part_netLabel_netPort':
      return [[pinDotX, pinDotY, rotation, netFlag, textAnchor], null, null, null];
    default:
      console.warn(`Warning: unsupported netflag partId: ${partId} with id = ${id}`);
      return null;
  }
  const compUuid: string = uuid();
  const newComponent = [
    '_LF_',
    '_LF_',
    [
      'symbol',
      ['lib_id', `Autogenerated:Powerflag_${libtype}`],
      ['at', kiUnits(parseFloat(pinDotX)), kiUnits(parseFloat(pinDotY)), parseFloat(rotation)],
      ['unit', 1],
      ['in_bom', 'yes'],
      ['on_board', 'yes'],
      ['uuid', compUuid],
      '_LF1_',
      ['property', 'Reference', '#PWR?', ['id', 0], ['at', 0, 0, 0], kiEffects('1.27', '0')],
      '_LF1_',
      [
        'property',
        'Value',
        netFlag,
        ['id', 1],
        ['at', kiUnits(parseFloat(px)), kiUnits(parseFloat(py)), parseFloat(rot)],
        kiEffects('1.27', show),
      ],
    ],
  ];
  const newComponentInstance = [
    '_LF2_',
    [
      'path',
      '/' + compUuid,
      ['reference', '#PWR?'],
      ['unit', 1],
      ['value', netFlag],
      ['footprint', '&'],
    ],
  ];
  if (createNewSymbol) {
    createNewSymbol = false;
    const compPin = [
      '_LF3_',
      [
        'pin',
        'power_in',
        'line',
        ['at', 0, 0, 0],
        ['length', 0],
        'hide',
        '_LF4_',
        ['name', netFlag, kiEffects('1.27')],
        '_LF4_',
        ['number', '&1', kiEffects('1.27')],
      ],
    ];
    const newSymbol = [
      '_LF1_',
      [
        'symbol',
        `Autogenerated:Powerflag_${libtype}`,
        ['power'],
        ['pin_names', ['offset', 0]],
        ['in_bom', 'no'],
        ['on_board', 'yes'],
        '_LF2_',
        ['property', 'Reference', '#PWR', ['id', 0], ['at', 0, 0, 0], kiEffects('1.27', '0')],
        '_LF2_',
        [
          'property',
          'Value',
          `Autogenerated:Powerflag_${libtype}`,
          ['id', 1],
          ['at', 0, 0, 0],
          kiEffects('1.27'),
        ],
        '_LF2_',
        ['symbol', `Powerflag_${libtype}_0_1`, ...shape],
        '_LF2_',
        ['symbol', `Powerflag_${libtype}_1_1`, ...compPin],
      ],
    ];
    return [null, newSymbol, newComponentInstance, newComponent];
  } else {
    return [null, null, newComponentInstance, newComponent];
  }
}

export function convertBus(args: string[]) {
  const [points, strokeColor, strokeWidth, stokeStyle, fillColor, id, locked] = args;
  const coordList = points.split(' ');
  const busses = [];
  for (let i = 0; i < coordList.length - 2; i += 2) {
    busses.push('_LF_', [
      'bus',
      kiPts(coordList[i], coordList[i + 1], coordList[i + 2], coordList[i + 3]),
    ]);
  }
  return busses;
}

export function convertBusEntry(args: string[]) {
  const [rotation, startX, startY, endX, endY, id, locked] = args;
  const x = parseFloat(endX) - parseFloat(startX);
  const y = parseFloat(endY) - parseFloat(startY);
  return ['_LF_', ['bus_entry', kiAt(startX, startY), ['size', kiUnits(x), kiUnits(y)]]];
}

function convertSchematicV6ToArray(schematic: IEasyEDASchematic) {
  var shape;
  const knownNetflags: INetflags = {
    $GND: false,
    $GND1: false,
    $GND2: false,
    $Vplus: false,
    $Vminus: false,
  };
  const libSymbols = [];
  const componentInstances = [];
  const components = [];
  const netlabels = [];
  const wires = [];
  const junctions = [];
  const noconnects = [];
  const busses = [];
  const busentries = [];
  const polylines = [];
  const texts = [];
  const nfSymbols = [];
  const nfInstances = [];
  const netflags = [];
  const netports = [];
  var libSymbol: any = [];
  var symbolInstance: any = [];
  var symbol: any = [];
  const schNetPorts: any[] = [];
  const unsupportedShapes: { [key: string]: string } = {
    A: 'arc',
    AR: 'arrow',
    C: 'circle',
    E: 'ellipse',
    I: 'image',
    PI: 'pie',
    PG: 'polygon',
    PT: 'path',
    R: 'rectangle',
  };
  for (shape of schematic.shape) {
    const [type, ...args] = shape.split('~');
    //console.info(`processing schematic type: ${type}`);
    if (type === 'B') {
      busses.push(...convertBus(args));
    } else if (type === 'BE') {
      busentries.push(...convertBusEntry(args));
    } else if (type === 'F') {
      const nfresult = convertNetflag(args, knownNetflags);
      if (nfresult != null) {
        const [netport, nfSymbol, nfInstance, netflag] = nfresult;
        if (netport != null) {
          schNetPorts.push(netport);
        } else {
          if (nfSymbol != null) {
            nfSymbols.push(...nfSymbol);
          }
        }
        if (nfInstance != null) {
          nfInstances.push(...nfInstance);
        }
        if (netflag != null) {
          netflags.push(...netflag);
        }
      }
    } else if (type === 'J') {
      junctions.push(...convertJunction(args));
    } else if (type === 'LIB') {
      const result = convertLibrary(args.join('~'), null);
      if (result != null) {
        [libSymbol, symbolInstance, symbol] = result;
        libSymbols.push(...libSymbol);
        componentInstances.push(...symbolInstance);
        components.push(...symbol);
      }
    } else if (type === 'N') {
      netlabels.push(...convertNetlabel(args));
    } else if (type === 'O') {
      noconnects.push(...convertNoConnect(args));
    } else if (type === 'PL') {
      polylines.push(...convertPolyline(args));
    } else if (type === 'T') {
      texts.push(...convertText(args));
    } else if (type === 'W') {
      wires.push(...convertWire(args));
    } else if (
      type === 'A' ||
      type === 'AR' ||
      type === 'C' ||
      type === 'E' ||
      type === 'I' ||
      type === 'PI' ||
      type === 'PG' ||
      type === 'PT' ||
      type === 'R'
    ) {
      // image: bit map image is supported in schematic (not symbol), but
      // requires SVG conversion to bitmap and is not implemented due to complexity
      console.warn(
        `Warning: ${unsupportedShapes[type]} shape found in schematics, but not supported by Kicad `
      );
    } else {
      console.warn(`Warning: unknown shape ${type} in schematics`);
    }
  }
  for (shape of schNetPorts) {
    netports.push(...convertNetPort(shape));
  }
  const outputSymbols = [...libSymbols, ...nfSymbols].filter((obj: any) => obj != null);
  const outputInstances = [...componentInstances, ...nfInstances].filter((obj: any) => obj != null);
  const outputObjs = [
    '_LF_',
    ...components,
    ...netflags,
    ...netlabels,
    ...netports,
    ...wires,
    ...junctions,
    ...noconnects,
    ...polylines,
    ...busses,
    ...busentries,
    ...texts,
    '_LF_',
    '_LF_',
  ].filter((obj) => obj != null);
  // note: version date below can be changed by Kicad;
  // this can invoke the Kicad "will be migrated on save"
  return [
    'kicad_sch',
    ['version', 20210126],
    ['generator', 'eeschema'],
    // adjust paper size after opening schematics in Kicad
    ['paper', 'A1'],
    '_LF_',
    ['lib_symbols', ...outputSymbols],
    '_LF_',
    ...outputObjs,
    ['sheet_instances', ['path', '/', ['page', '&1']]],
    '_LF_',
    '_LF_',
    ['symbol_instances', ...outputInstances],
  ];
}

export function convertSchematicV6(input: IEasyEDASchematicCollectionV6, sheet: number) {
  const numberOfSheet = input.schematics.length;
  if (sheet > numberOfSheet) {
    console.warn(
      `Request for conversion of sheet ${sheet}, but only ${input.schematics.length} sheet(s) exist.`
    );
    process.exit(0);
  } else if (input.schematics.length > 1) {
    console.warn(
      `Multi-sheet schematics: sheet ${sheet} is used as input of the ${input.schematics.length} available sheets.`
    );
  }
  const schematic: IEasyEDASchematic = input.schematics[sheet - 1].dataStr;
  return encodeObject(convertSchematicV6ToArray(schematic));
}

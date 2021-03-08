import { IEasyEDABoard } from './easyeda-types';
import { encodeObject, ISpectraList } from './spectra';
import { convertFp } from './footprint-v6';
import { computeArc } from './svg-arc';

// doc: https://docs.easyeda.com/en/DocumentFormat/3-EasyEDA-PCB-File-Format/index.html#shapes

export interface IConversionState {
  nets: string[];
  innerLayers: number;
  fpValue: string;
  msgRepCnt: number;
  msgReports: ISpectraList;
  msgReportsPosition: number;
  pcbCuZoneCount: number;
  pcbKeepoutZoneCount: number;
  convertingFpFile?: boolean;
}

export function getLayerName(id: string, conversionState: IConversionState): string {
  const layers: { [key: string]: string } = {
    1: 'F.Cu',
    2: 'B.Cu',
    3: 'F.SilkS',
    4: 'B.SilkS',
    5: 'F.Paste',
    6: 'B.Paste',
    7: 'F.Mask',
    8: 'B.Mask',
    10: 'Edge.Cuts',
    11: 'Edge.Cuts', // Eda multilayer; used as edge cut in solid region
    12: 'Cmts.User',
    13: 'F.Fab',
    14: 'B.Fab',
    15: 'Dwgs.User',
  };
  if (id === '' || id === '0') {
    const msg = `#Error: no layer id `;
    return msg;
  } else if (id in layers) {
    return layers[id];
  } else {
    // Inner layers: 21 -> In1.Cu
    let intId = parseInt(id, 10);
    if (intId >= 21 && intId <= 50) {
      const innerLayerId = intId - 20;
      conversionState.innerLayers = Math.max(conversionState.innerLayers, innerLayerId);
      return `In${innerLayerId}.Cu`;
    } else if (intId >= 99 && intId < 200) {
      const msg = `#Error: unsupported layer id: ${intId} `;
      return msg;
    } else {
      const msg = `#Error: unknown layer id: ${id} `;
      return msg;
    }
  }
}

interface ICoordinates {
  x: number;
  y: number;
}

export interface IParentTransform extends ICoordinates {
  angle: number | null;
  fpId?: string;
  isFootprintFile?: boolean;
}

export function kiUnits(value: string | number, round: boolean = false): number {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  // Note: unit conversion is done at the very end.
  // This makes debugging easier;
  // during debugging of functions the Eda
  // coordinates from .json  will be shown.
  // By removing the multiplication factor here
  // this is also reflected in the conversion
  // output file of schematics and library:
  // 'return value; // * 0.254;'
  const kiValue = value * 0.254;
  if (round == true) {
    // rounded at 0.1mm for boardoutline (issue #45)
    // hopefully this clears the issue for all rounded rectangles
    // last resort: redraw edge manually
    return parseFloat(kiValue.toFixed(1));
  }
  return kiValue;
}

export function kiAngle(value?: string, parentAngle?: number): number | null {
  if (value) {
    const angle = parseFloat(value) + (parentAngle || 0);
    if (!isNaN(angle)) {
      return angle > 180 ? -(360 - angle) : angle;
    }
  }
  return null;
}

function rotate({ x, y }: ICoordinates, degrees: number): ICoordinates {
  const radians = (degrees / 180) * Math.PI;
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}

export function kiCoords(
  x: string,
  y: string,
  transform: IParentTransform = { x: 0, y: 0, angle: 0 }
): ICoordinates {
  return rotate(
    {
      x: parseFloat(x) - 4000 - transform.x,
      y: parseFloat(y) - 3000 - transform.y,
    },
    transform.angle || 0
  );
}

export function kiAt(
  x: string,
  y: string,
  angle?: string,
  transform?: IParentTransform
): ISpectraList {
  const coords = kiCoords(x, y, transform);
  return ['at', kiUnits(coords.x), kiUnits(coords.y), kiAngle(angle)];
}

function kiStartEnd(
  startX: string,
  startY: string,
  endX: string,
  endY: string,
  round: boolean,
  parentCoords?: IParentTransform
): ISpectraList {
  const start = kiCoords(startX, startY, parentCoords);
  const end = kiCoords(endX, endY, parentCoords);
  return [
    ['start', kiUnits(start.x, round), kiUnits(start.y, round)],
    ['end', kiUnits(end.x, round), kiUnits(end.y, round)],
  ];
}

function reportFpError(
  msgNumber: number,
  msg: string,
  lines: number,
  conversionState: IConversionState
): ISpectraList {
  // put error info near footprint 0,0 coords;
  const y = conversionState.msgReportsPosition + lines + 1;
  conversionState.msgReportsPosition = y + (lines - 1);
  const text = `#${msgNumber}: ${msg}`;
  return [
    '_LF1_',
    [
      'fp_text',
      'user',
      text,
      ['at', 0, y, 0],
      ['layer', 'Cmts.User'],
      ['effects', ['font', ['size', 0.8, 0.8], ['thickness', 0.2]]],
    ],
  ];
}

function reportPcbError(
  msgNumber: number,
  msg: string,
  lines: number,
  conversionState: IConversionState
): ISpectraList {
  // put error info on layer Cmts;
  const y = conversionState.msgReportsPosition + lines * 1.8 + 1.8;
  conversionState.msgReportsPosition = y + (lines - 1) * 1.8;
  const text = `#${msgNumber}: ${msg}`;
  return [
    '_LF_',
    [
      'gr_text',
      text,
      ['at', -200, y, 0],
      ['layer', 'Cmts.User'],
      ['effects', ['font', ['size', 2, 2], ['thickness', 0.4]], ['justify', 'left']],
    ],
  ];
}

export function reportError(
  msg: string,
  conversionState: IConversionState,
  multiLine?: number
): ISpectraList {
  conversionState.msgRepCnt += 1;
  const lines = multiLine !== undefined ? multiLine : 1;
  if (conversionState.convertingFpFile) {
    //console.info(`MOD: ${conversionState.msgRepCnt} - ${msgPcb}`);
    conversionState.msgReports.push(
      reportFpError(conversionState.msgRepCnt, msg, lines, conversionState)
    );
  } else {
    //console.info(`PCB: ${conversionState.msgRepCnt} - ${msgPcb}`);
    conversionState.msgReports.push(
      reportPcbError(conversionState.msgRepCnt, msg, lines, conversionState)
    );
  }
  return [];
}

function isCopper(layerName: string): boolean {
  return layerName.endsWith('.Cu');
}

export function getNetId({ nets }: IConversionState, netName: string): number {
  if (!netName) {
    return -1;
  }
  const index = nets.indexOf(netName);
  if (index >= 0) {
    return index;
  }
  nets.push(netName);
  return nets.length - 1;
}

export function convertVia(
  args: string[],
  conversionState: IConversionState,
  parentCoords?: IParentTransform
): ISpectraList {
  const [x, y, diameter, net, drill, id, locked] = args;
  const netId = getNetId(conversionState, net);
  return [
    '_LF_',
    [
      'via',
      kiAt(x, y, undefined, parentCoords),
      ['size', kiUnits(diameter)],
      ['drill', kiUnits(drill) * 2],
      ['layers', 'F.Cu', 'B.Cu'],
      netId > 0 ? null : ['free'],
      ['net', netId > 0 ? netId : 0],
    ],
  ];
}

export function convertTrack(
  args: string[],
  conversionState: IConversionState,
  objName = 'segment',
  parentCoords: IParentTransform = { x: 0, y: 0, angle: 0 }
): ISpectraList {
  const [width, layer, net, coords, id, locked] = args;
  let round = false;
  const netId = getNetId(conversionState, net);

  const coordList = coords.split(' ');
  const result = [];
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    return reportError(
      `${layerName.substring(1)}found in TRACK (${id}); track ignored`,
      conversionState
    );
  }
  // try to eliminate x/y differences by rounding
  // for segments of edge cut (broadoutline issue #45)
  if (layerName === 'Edge.Cuts') {
    round = true;
  }
  const lineType = objName === 'segment' && !isCopper(layerName) ? 'gr_line' : objName;
  for (let i = 0; i < coordList.length - 2; i += 2) {
    result.push(objName === 'fp_line' ? '_LF1_' : '_LF_');
    result.push([
      lineType,
      ...kiStartEnd(
        coordList[i],
        coordList[i + 1],
        coordList[i + 2],
        coordList[i + 3],
        round,
        parentCoords
      ),
      ['width', kiUnits(width)],
      ['layer', layerName],
      isCopper(layerName) && netId > 0 ? ['net', netId] : null,
      locked === '1' ? ['status', 40000] : null,
    ]);
  }
  return result;
}

function textLayer(
  layer: string,
  conversionState: IConversionState,
  footprint: boolean,
  isName: boolean
): string {
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    return layerName;
  } else if (layerName && footprint && isName) {
    return layerName.replace('.SilkS', '.Fab');
  } else {
    return layerName;
  }
}

export function convertText(
  args: string[],
  conversionState: IConversionState,
  objName = 'gr_text',
  parentCoords?: IParentTransform
): ISpectraList {
  const [
    type, // N/P/L (Name/Prefix/Label)
    x,
    y,
    lineWidth,
    angle,
    mirror,
    layer,
    net,
    fontSize,
    text,
    path,
    display,
    id,
    font,
    locked,
  ] = args;
  const layerName = textLayer(layer, conversionState, objName === 'fp_text', type === 'N');
  const parent = parentCoords !== undefined ? ` of ${parentCoords.fpId}` : '';
  if (layerName.charAt(0) === '#') {
    return reportError(
      `${layerName.substring(1)}found in TEXT (${id})${parent}; text ignored`,
      conversionState
    );
  }
  const fontTable: { [key: string]: { width: number; height: number; thickness: number } } = {
    'NotoSerifCJKsc-Medium': { width: 0.8, height: 0.8, thickness: 0.3 },
    'NotoSansCJKjp-DemiLight': { width: 0.6, height: 0.6, thickness: 0.5 },
  };
  // enhancement: added height for better fit of font
  const fontMultiplier =
    font in fontTable ? fontTable[font] : { width: 0.75, height: 0.9, thickness: 0.8 };
  const actualFontWidth = kiUnits(fontSize) * fontMultiplier.width;
  const actualFontHeight = kiUnits(fontSize) * fontMultiplier.height;
  return [
    objName === 'gr_text' ? '_LF_' : '_LF1_',
    [
      objName,
      // with fp_text and N/P/L: (Name:value/Prefix:reference/Label:user); with gr_text:null (BUG FIX)
      objName === 'fp_text' ? (type === 'P' ? 'reference' : type === 'N' ? 'value' : 'user') : null,
      text,
      kiAt(x, y, angle, parentCoords),
      ['layer', layerName],
      display === 'none' ? 'hide' : null,
      [
        'effects',
        [
          'font',
          ['size', actualFontHeight, actualFontWidth],
          ['thickness', kiUnits(lineWidth) * fontMultiplier.thickness],
        ],
        ['justify', 'left', layerName.charAt(0) === 'B' ? 'mirror' : null],
      ],
    ],
  ];
}

export function convertArc(
  args: string[],
  conversionState: IConversionState,
  objName = 'gr_arc',
  transform?: IParentTransform
): ISpectraList {
  var round = false;
  const [width, layer, net, path, _, id, locked] = args;
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    const parent = transform !== undefined ? ` of ${transform.fpId}` : '';
    return reportError(`${layerName}found in ARC (${id})${parent} ; arc ignored`, conversionState);
  }
  const netId = getNetId(conversionState, net);
  if (isCopper(layerName) && netId > 0) {
    const msg =
      `Warning: Found arc (${id}) on ${layerName} with netname ${netId}: arc is kept; unsupported netname omitted.` +
      '\\nNote: manual checks are needed; circle not part of ratsnest and this will isolate arc.';
    return reportError(msg, conversionState, 2);
  }
  const pathMatch = /^M\s*([-\d.\s]+)A\s*([-\d.\s]+)$/.exec(path.replace(/[,\s]+/g, ' '));
  if (!pathMatch) {
    const parent = transform !== undefined ? ` of ${transform.fpId}` : '';
    const msg = `Error: invalid arc\\npath: ${path}\\nfound in ARC (${id})${parent} on layer ${layerName}; arc ignored`;
    return reportError(msg, conversionState, 3);
  }
  const [match, startPoint, arcParams] = pathMatch;
  const [startX, startY] = startPoint.split(' ');
  const [svgRx, svgRy, xAxisRotation, largeArc, sweep, endX, endY] = arcParams.split(' ');
  const start = kiCoords(startX, startY, transform);
  const end = kiCoords(endX, endY, transform);
  const { x: rx, y: ry } = rotate(
    { x: parseFloat(svgRx), y: parseFloat(svgRy) },
    transform?.angle || 0
  );
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
  const endPoint = sweep === '1' ? start : end;
  if (isNaN(cx) || isNaN(cy) || isNaN(extent)) {
    const parent = transform !== undefined ? ` of ${transform.fpId}` : '';
    const msg = `Error :function svg-arc.ts returned invalid result for ARC (${id})${parent} on layer ${layerName}; arc ignored`;
    return reportError(msg, conversionState);
  }
  var angle = Math.abs(extent);
  if (layerName === 'Edge.Cuts') {
    round = true;
    if (angle > 89 && angle < 91) {
      angle = 90;
    }
    if (angle > 44 && angle < 46) {
      angle = 45;
    }
  }
  return [
    objName === 'gr_arc' ? '_LF_' : '_LF1_',
    [
      objName,
      ['start', kiUnits(cx, round), kiUnits(cy, round)], // actually center
      ['end', kiUnits(endPoint.x, round), kiUnits(endPoint.y, round)],
      ['angle', angle],
      ['width', kiUnits(width)],
      ['layer', layerName],
    ],
  ];
}

function getDrill(
  holeRadius: number,
  holeLength: number,
  width: number,
  height: number
): ISpectraList | null {
  // oval hole is dynamically changed by EasyEda based on relation between values (BUG FIX)
  if (holeRadius && holeLength) {
    if (holeLength > holeRadius && height > width) {
      return ['drill', 'oval', holeRadius * 2, holeLength];
    } else {
      return ['drill', 'oval', holeLength, holeRadius * 2];
    }
  }
  if (holeRadius) {
    return ['drill', holeRadius * 2];
  }
  return null;
}

function isRectangle(points: number[]): boolean {
  if (points.length !== 8) {
    return false;
  }
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const [x1, y1, x2, y2, x3, y3, x4, y4] = points;
  return (
    (eq(x1, x2) && eq(y2, y3) && eq(x3, x4) && eq(y4, y1)) ||
    (eq(y1, y2) && eq(x2, x3) && eq(y3, y4) && eq(x4, x1))
  );
}

function rectangleSize(points: number[], rotation: number) {
  const [x1, y1, x2, y2, x3, y3, x4, y4] = points;
  const width = Math.max(x1, x2, x3, x4) - Math.min(x1, x2, x3, x4);
  const height = Math.max(y1, y2, y3, y4) - Math.min(y1, y2, y3, y4);
  return Math.round(Math.abs(rotation)) % 180 === 90 ? [height, width] : [width, height];
}

export function convertPad(
  args: string[],
  conversionState: IConversionState,
  transform: IParentTransform,
  padOnBoard: boolean = false
): ISpectraList {
  const [
    shape,
    x,
    y,
    width,
    height,
    layerId,
    net,
    num,
    holeRadius,
    points,
    rotation,
    id,
    holeLength,
    holePoints,
    plated,
    locked,
    u1,
    u2,
    holeXY,
  ] = args;

  const padShapes: { [key: string]: string } = {
    ELLIPSE: 'circle',
    RECT: 'rect',
    OVAL: 'oval',
    POLYGON: 'custom',
  };
  const centerCoords = kiCoords(x, y);
  const polygonTransform: IParentTransform = {
    x: centerCoords.x,
    y: centerCoords.y,
    angle: parseFloat(rotation),
  };
  const pointList = points.split(' ').map(parseFloat);
  const pointsAreRectangle = padShapes[shape] === 'custom' && isRectangle(pointList);
  const actualShape = pointsAreRectangle ? 'RECT' : shape;
  const isCustomShape = padShapes[actualShape] === 'custom';
  if (isCustomShape && !points.length) {
    const parent = transform !== undefined ? ` of ${transform.fpId}` : '';
    const msg = `Error: No points defined  for polygon in PAD (${id})${parent}; pad ignored`;
    return reportError(msg, conversionState);
  }
  const layers: { [key: string]: string[] } = {
    1: ['F.Cu', 'F.Paste', 'F.Mask'],
    2: ['B.Cu', 'B.Paste', 'B.Mask'],
    11: ['*.Cu', '*.Paste', '*.Mask'],
  };
  const [actualWidth, actualHeight] = pointsAreRectangle
    ? rectangleSize(pointList, parseFloat(rotation))
    : [width, height];
  let padNum;
  padOnBoard ? (padNum = 1) : (padNum = parseInt(num, 10));
  let type = '';
  let netId = 0;
  let layer = [];
  let radius = holeRadius;
  // multilayer > tht pad
  if (layerId === '11') {
    if (plated === 'Y') {
      type = 'thru_hole';
      netId = getNetId(conversionState, net);
      layer = layers[layerId];
    } else {
      type = 'np_thru_hole';
      layer = ['F&B.Cu', '*.Mask'];
      if (net !== '') {
        const parent = !padOnBoard ? ` of ${transform.fpId}` : '';
        const msg = `Error: netid not supported for PAD ${padNum} (${id})${parent}; netid ignored`;
        reportError(msg, conversionState);
      }
    }
    // check for non centered holes (not implemented)
    const [hx, hy] = holeXY.split(',');
    const neq = (a: string, b: string) => Math.abs(parseFloat(a) - parseFloat(b)) > 0.025;
    if (hx !== '' && hy !== '' && (neq(x, hx) || neq(y, hy))) {
      const parent = !padOnBoard ? ` of ${transform.fpId}` : '';
      const msg = `Warning: hole in pad may be misplaced for PAD ${padNum} (${id})${parent}`;
      reportError(msg, conversionState);
    }
    // top or bottom layer > smd pad
  } else {
    type = 'smd';
    netId = getNetId(conversionState, net);
    layer = layers[layerId];
    radius = '0';
  }
  // strange behaviour of Kicad for custom pad;
  // workaround: make size = hole-radius*2 + 0.1 for custom shape
  let size: ISpectraList = [];
  let xy = kiUnits(parseFloat(radius) * 2 + 0.1);
  isCustomShape
    ? (size = ['size', xy, xy])
    : (size = [
        'size',
        Math.max(kiUnits(actualWidth), 0.01),
        Math.max(kiUnits(actualHeight), 0.01),
      ]);
  return [
    '_LF1_',
    [
      'pad',
      isNaN(padNum) ? num : padNum,
      type,
      padShapes[actualShape],
      kiAt(x, y, rotation, transform),
      size,
      ['layers', ...layer],
      getDrill(kiUnits(radius), kiUnits(holeLength), kiUnits(actualWidth), kiUnits(actualHeight)),
      netId > 0 ? ['net', netId, net] : null,
      isCustomShape
        ? [
            'primitives',
            [
              'gr_poly',
              ['pts', ...pointListToPolygon(points.split(' '), polygonTransform)],
              ['width', 0.1],
            ],
          ]
        : null,
    ],
  ];
}

export function convertBoardPad(args: string[], conversionState: IConversionState): ISpectraList {
  const [
    shape,
    x,
    y,
    width,
    height,
    layerId,
    net,
    num,
    holeRadius,
    points,
    rotation,
    id,
    holeLength,
    holePoints,
    plated,
    locked,
    u1,
    u2,
    holeXY,
  ] = args;
  const size = kiUnits(holeRadius);
  let attr = null;
  let value = '';
  let fp = '';
  // multilayer > tht pad
  if (layerId === '11') {
    if (plated === 'Y') {
      fp = 'AutoGenerated:TH_pad_' + id;
      attr = 'through_hole';
      value = 'hole_' + (size * 2).toFixed(2) + '_mm';
    } else {
      fp = 'AutoGenerated:NPTH_pad_' + id;
      value = 'hole_' + (size * 2).toFixed(2) + '_mm';
    }
    // top or bottom layer > smd pad
  } else {
    fp = 'AutoGenerated:SMD_pad_' + id;
    attr = 'smd';
  }
  return [
    '_LF_',
    [
      'footprint',
      fp,
      locked === '1' ? 'locked' : null,
      ['layer', 'F.Cu'],
      kiAt(x, y),
      ['attr', attr, 'board_only', 'exclude_from_pos_files', 'exclude_from_bom'],
      '_LF1_',
      ['fp_text', 'reference', id, ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
      '_LF1_',
      ['fp_text', 'value', value, ['at', 0, 0], ['layer', 'F.SilkS'], 'hide'],
      '_LF1_',
      ...convertPad(args, conversionState, { ...kiCoords(x, y), angle: 0 }, true),
    ],
  ];
}

export function convertCircle(
  args: string[],
  conversionState: IConversionState,
  objName = 'gr_circle',
  parentCoords?: IParentTransform
): ISpectraList {
  const [x, y, radius, strokeWidth, layer, id, locked, net] = args;
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    const parent = parentCoords !== undefined ? ` of ${parentCoords.fpId}` : '';
    return reportError(
      `${layerName.substring(1)}found in CIRCLE (${id})${parent}; circle ignored`,
      conversionState
    );
  }
  const netId = getNetId(conversionState, net);
  if (isCopper(layerName) && netId > 0) {
    const msg =
      `Warning: Found circle (${id}) on ${layerName} with netname ${netId}: circle is kept; unsupported netname omitted.` +
      '\\nNote: manual checks are needed; circle not part of ratsnest and this will isolate circle.';
    return reportError(msg, conversionState, 2);
  }
  const center = kiCoords(x, y, parentCoords);
  return [
    objName === 'gr_circle' ? '_LF_' : '_LF1_',
    [
      objName,
      ['center', kiUnits(center.x), kiUnits(center.y)],
      ['end', kiUnits(center.x) + kiUnits(radius), kiUnits(center.y)],
      ['layer', layerName],
      ['width', kiUnits(strokeWidth)],
    ],
  ];
}

export function convertRect(
  args: string[],
  conversionState: IConversionState,
  objName = 'gr_rect',
  parentCoords?: IParentTransform
): ISpectraList {
  const [rx, ry, width, height, layer, id, locked, u1, u2, u3, net] = args;
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    const parent = parentCoords !== undefined ? ` of ${parentCoords.fpId}` : '';
    return reportError(
      `${layerName.substring(1)}found in RECT (${id})${parent}; rect ignored`,
      conversionState
    );
  }
  const start = kiCoords(rx, ry, parentCoords);
  const x = start.x;
  const y = start.y;
  const w = parseFloat(width);
  const h = parseFloat(height);
  const netId = getNetId(conversionState, net);
  const polygonPoints = [];
  // convert rectangle on copper with net to Kicad zone
  if (isCopper(layerName) && netId > 0) {
    const points = [x, y, x, y + h, x + w, y + h, x + w, y, x, y];
    for (let i = 0; i < points.length; i += 2) {
      polygonPoints.push(['xy', kiUnits(points[i]), kiUnits(points[i + 1])]);
    }
    conversionState.pcbCuZoneCount += 1;
    return [
      '_LF_',
      [
        'zone',
        ['net', netId],
        ['net_name', net],
        ['layer', layerName],
        id !== '' ? ['name', id] : null,
        ['hatch', 'edge', 0.508],
        ['priority', 1],
        ['connect_pads', 'yes', ['clearance', 0]],
        '_LF1_',
        ['fill', 'yes', ['thermal_gap', 0], ['thermal_bridge_width', 0.254]],
        '_LF1_',
        ['polygon', ['pts', ...polygonPoints]],
      ],
    ];
  }
  return [
    objName === 'gr_rect' ? '_LF_' : '_LF1_',
    [
      objName === 'fp_rect' ? 'fp_rect' : objName,
      ['start', kiUnits(start.x), kiUnits(start.y)],
      ['end', kiUnits(start.x + parseFloat(width)), kiUnits(start.y + parseFloat(height))],
      ['layer', layerName],
      ['width', 0.1],
      ['fill', 'solid'],
    ],
  ];
}
function pointListToPolygon(points: string[], parentCoords?: IParentTransform): ISpectraList {
  const polygonPoints = [];
  for (let i = 0; i < points.length; i += 2) {
    const coords = kiCoords(points[i], points[i + 1], parentCoords);
    polygonPoints.push(['xy', kiUnits(coords.x), kiUnits(coords.y)]);
  }
  return polygonPoints;
}

function pathToPolygon(
  path: string,
  layer: string,
  parentCoords?: IParentTransform
): ISpectraList | null {
  if (path.indexOf('A') >= 0) {
    return null;
  }
  const points = path.split(/[ ,LM]/).filter((p) => !isNaN(parseFloat(p)));
  return pointListToPolygon(points, parentCoords);
}

export function convertPolygon(
  args: string[],
  conversionState: IConversionState,
  parentCoords?: IParentTransform
): ISpectraList {
  const [layer, net, path, type, id, , , locked] = args;
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    const parent = parentCoords !== undefined ? ` of ${parentCoords.fpId}` : '';
    return reportError(
      `${layerName.substring(1)}found in SOLIDREGION (${id})${parent}; solidregion ignored`,
      conversionState
    );
  }
  if (type !== 'solid') {
    const parent = parentCoords !== undefined ? ` of ${parentCoords.fpId}` : '';
    return reportError(
      `Warning: unsupported type ${type} found in SOLIDREGION ${id}${parent} on layer ${layerName}; solidregion ignored`,
      conversionState
    );
  }
  const polygonPoints = pathToPolygon(path, layer, parentCoords);
  if (!polygonPoints) {
    const parent = parentCoords !== undefined ? ` of ${parentCoords.fpId}` : '';
    return reportError(
      `Error: No points defined  for polygon in SOLIDREGION (${id})${parent} on layer ${layerName}; solidregion ignored`,
      conversionState
    );
  }
  return ['_LF1_', ['fp_poly', ['pts', ...polygonPoints], ['layer', layerName], ['width', 0]]];
}

export function convertCopperArea(args: string[], conversionState: IConversionState): ISpectraList {
  const [
    strokeWidth,
    layer,
    net,
    path,
    clearanceWidth,
    fillStyle,
    id,
    thermalType,
    keepIsland,
    copperZone,
    locked,
    areaName,
    unknown,
    gridLineWidth,
    gridLineSpacing,
    copperToBoardoutline,
    improveFab,
    spokeWidth,
  ] = args;
  const netId = getNetId(conversionState, net);
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    return reportError(
      `${layerName.substring(1)}found in COPPERAREA (${id}); copperarea ignored`,
      conversionState
    );
  }
  if (fillStyle === 'none' || fillStyle === '') {
    return reportError(
      `Warning: Unsupported type "No Solid" of COPPERAREA (${id}) on layer ${layerName}; copperarea ignored`,
      conversionState
    );
  }
  const pointList = path.split(/[ ,LM]/).filter((p) => !isNaN(parseFloat(p)));
  const polygonPoints = [];
  for (let i = 0; i < pointList.length; i += 2) {
    const coords = kiCoords(pointList[i], pointList[i + 1]);
    polygonPoints.push(['xy', kiUnits(coords.x), kiUnits(coords.y)]);
  }
  conversionState.pcbCuZoneCount += 1;
  return [
    '_LF_',
    [
      'zone',
      ['net', netId],
      ['net_name', net],
      ['layer', layerName],
      areaName !== '' ? ['name', areaName] : null,
      ['hatch', 'edge', 0.508],
      net === 'GND' ? ['priority', 0] : ['priority', 1],
      [
        'connect_pads',
        thermalType === 'direct' ? 'yes' : null,
        ['clearance', kiUnits(clearanceWidth)],
      ],
      '_LF1_',
      [
        'fill',
        'yes',
        fillStyle === 'grid' ? ['mode', 'hatch'] : null,
        ['thermal_gap', kiUnits(clearanceWidth)],
        kiUnits(spokeWidth) >= 0.254
          ? ['thermal_bridge_width', kiUnits(spokeWidth)]
          : ['thermal_bridge_width', 0.254],
        keepIsland === 'yes' ? ['island_removal_mode', 1] : null,
        keepIsland === 'yes' ? ['island_area_min', 0] : null,
        fillStyle === 'grid' ? ['hatch_thickness', kiUnits(gridLineWidth)] : null,
        fillStyle === 'grid' ? ['hatch_gap', kiUnits(gridLineSpacing)] : null,
        fillStyle === 'grid' ? ['hatch_orientation', 0] : null,
      ],
      '_LF1_',
      ['polygon', ['pts', ...polygonPoints]],
    ],
  ];
}

export function convertSolidRegion(
  args: string[],
  conversionState: IConversionState
): ISpectraList {
  const [layer, net, path, type, id, locked] = args;
  const layerName = getLayerName(layer, conversionState);
  if (layerName.charAt(0) === '#') {
    return reportError(
      `${layerName.substring(1)}found in SOLIDREGION (${id}); solidregion ignored`,
      conversionState
    );
  }
  if (type === '') {
    return reportError(
      `Warning: No type supplied of SOLIDREGION (${id}) on layer ${layerName}; solidregion ignored`,
      conversionState
    );
  }
  const polygonPoints = pathToPolygon(path, layer);
  const netId = getNetId(conversionState, net);
  if (!polygonPoints) {
    return reportError(
      `Warning: Unsupported path with arcs found in SOLIDREGION (${id}) on layer ${layerName}; solidregion ignored`,
      conversionState
    );
  }
  switch (type) {
    case 'cutout':
      // keepout zone; allowed / not_allowed can not be checked, needs checking by user
      // note: cutout is no longer supported by EasyEda gui; use No Solid as replacement without net name
      conversionState.pcbKeepoutZoneCount += 1;
      return [
        '_LF_',
        [
          'zone',
          ['net', 0],
          ['net_name', ''],
          ['hatch', 'edge', 0.508],
          ['layer', layerName],
          id !== '' ? ['name', id] : null,
          '_LF1_',
          [
            'keepout',
            ['tracks', 'allowed'],
            ['vias', 'allowed'],
            ['pads', 'allowed'],
            ['copperpour', 'not_allowed'],
            ['footprints', 'allowed'],
          ],
          '_LF1_',
          ['polygon', ['pts', ...polygonPoints]],
        ],
      ];
    case 'solid':
      // convert solidregion with net to Kicad Cu zone
      if (type === 'solid' && isCopper(layerName) && netId > 0) {
        conversionState.pcbCuZoneCount += 1;
        return [
          '_LF_',
          [
            'zone',
            ['net', netId],
            ['net_name', net],
            ['layer', layerName],
            ['hatch', 'edge', 0.508],
            layerName === 'GND' ? ['priority', 0] : ['priority', 1],
            ['connect_pads', 'yes', ['clearance', 0]],
            '_LF1_',
            ['fill', 'yes', ['thermal_gap', 0], ['thermal_bridge_width', 0.254]],
            '_LF1_',
            ['polygon', ['pts', ...polygonPoints]],
          ],
        ];
        // filled shape
      } else {
        return [
          '_LF_',
          [
            'gr_poly',
            ['pts', ...polygonPoints],
            ['layer', layerName],
            ['width', 0],
            ['fill', 'solid'],
          ],
        ];
      }
    case 'npth':
      // board cutout (layer Edge.Cuts)
      return [
        '_LF_',
        ['gr_poly', ['pts', ...polygonPoints], ['layer', layerName], ['width', 0.254]],
      ];
    default:
      return reportError(
        `Warning: unsupported type ${type} found in SOLIDREGION ${id} on layer ${layerName}; solidregion ignored`,
        conversionState
      );
  }
}

export function convertHole(args: string[]): ISpectraList {
  const [x, y, radius, id, locked] = args;
  const size = kiUnits(radius) * 2;
  return [
    '_LF_',
    [
      'footprint',
      `AutoGenerated:MountingHole_${size.toFixed(2)}mm`,
      locked === '1' ? 'locked' : null,
      ['layer', 'F.Cu'],
      kiAt(x, y),
      ['attr', 'virtual'],
      '_LF1_',
      ['fp_text', 'reference', '', ['at', 0, 0], ['layer', 'F.SilkS']],
      '_LF1_',
      ['fp_text', 'value', '', ['at', 0, 0], ['layer', 'F.SilkS']],
      '_LF1_',
      [
        'pad',
        '',
        'np_thru_hole',
        'circle',
        ['at', 0, 0],
        ['size', size, size],
        ['drill', size],
        ['layers', '*.Cu', '*.Mask'],
      ],
    ],
  ];
}

function flatten<T>(arr: T[]) {
  return ([] as T[]).concat(...arr);
}

export function convertBoardToArray(board: IEasyEDABoard): ISpectraList {
  var shape: any;
  const vias: ISpectraList = [];
  const tracks: ISpectraList = [];
  const texts: ISpectraList = [];
  const arcs: ISpectraList = [];
  const copperareas: ISpectraList = [];
  const solidregions: ISpectraList = [];
  const circles: ISpectraList = [];
  const holes: ISpectraList = [];
  const footprints: ISpectraList = [];
  const padvias: ISpectraList = [];
  const rects: ISpectraList = [];

  const { nets } = board.routerRule || { nets: [] as string[] };
  const conversionState: IConversionState = {
    nets,
    innerLayers: 0,
    fpValue: '',
    msgRepCnt: 0,
    msgReports: [],
    msgReportsPosition: 0,
    pcbCuZoneCount: 0,
    pcbKeepoutZoneCount: 0,
  };
  // Kicad expects net 0 to be empty
  nets.unshift('');
  /*
  const [type, bw, bh, bg, gv, gc, gs, cw, ch, gst, ss, u,
  as, u1, u2, u3, ox, oy,] = board.canvas.split('~');
  */
  const msg =
    'Info: below are the conversion remarks. The conversion may contain errors.' +
    '\\nPlease read the remarks carefully and run the DRC check to solve issues.' +
    '\\nTo find a component mentioned in the remarks go to:' +
    '\\nKicad menu Edit > Find and enter the EDA_id (gge....); search for other text items.' +
    '\\nOnly the id of the footprint can be found; the id of the shape is in the input json.' +
    '\\nYou can export the footprints to a library by Kicad menu File > Export > Export Fps to (new) Library';
  reportError(msg, conversionState, 8);
  for (shape of board.shape) {
    const [type, ...args] = shape.split('~');
    if (type === 'VIA') {
      vias.push(...convertVia(args, conversionState));
    } else if (type === 'TRACK') {
      tracks.push(...convertTrack(args, conversionState));
    } else if (type === 'TEXT') {
      texts.push(...convertText(args, conversionState));
    } else if (type === 'ARC') {
      arcs.push(...convertArc(args, conversionState));
    } else if (type === 'COPPERAREA') {
      copperareas.push(...convertCopperArea(args, conversionState));
    } else if (type === 'SOLIDREGION') {
      solidregions.push(...convertSolidRegion(args, conversionState));
    } else if (type === 'CIRCLE') {
      circles.push(...convertCircle(args, conversionState));
    } else if (type === 'HOLE') {
      holes.push(...convertHole(args));
    } else if (type === 'LIB') {
      footprints.push(...convertFp(args.join('~'), conversionState));
    } else if (type === 'PAD') {
      padvias.push(...convertBoardPad(args, conversionState));
    } else if (type === 'RECT') {
      rects.push(...convertRect(args, conversionState));
    } else {
      if (type !== 'SVGNODE') {
        reportError(
          `Warning: unsupported shape ${type} found on pcb board; ignored`,
          conversionState
        );
      }
    }
  }
  if (conversionState.pcbCuZoneCount > 0) {
    const msg =
      `Info: total of ${conversionState.pcbCuZoneCount} Cu zones were created. Run DRC to check for overlap of zones.` +
      '\\nAdjust zone priority to solve this. Adjust other parameters as needed.' +
      '\\nNote: merge zones if possible (right click selected 2 zones > Zones > Merge zones).';
    reportError(msg, conversionState, 3);
  }
  if (conversionState.pcbKeepoutZoneCount > 0) {
    const msg =
      `Info: total of ${conversionState.pcbKeepoutZoneCount} keep-out zones were create. Run DRC to check for zone settings.` +
      '\\nAdjust zone keep-out checkboxes as needed.';
    reportError(msg, conversionState, 2);
  }
  if (conversionState.msgRepCnt > 1) {
    console.warn(
      `In total ${conversionState.msgRepCnt} messages were created during the conversion. ` +
        `Check messages on pcb layer User.Cmts for more details.`
    );
  }
  const netlist = flatten(nets.map((net, idx) => [['net', idx, net], '_LF_']));
  const outputObjs = [
    '_LF_',
    ...netlist,
    ...footprints,
    ...tracks,
    ...copperareas,
    ...solidregions,
    ...arcs,
    ...rects,
    ...circles,
    ...holes,
    ...vias,
    ...padvias,
    ...texts,
  ].filter((obj) => obj != null);

  const innerLayers = [];
  for (let i = 1; i <= conversionState.innerLayers; i++) {
    innerLayers.push('_LF_');
    innerLayers.push([i, `In${i}.Cu`, 'signal']);
  }
  const layers = [
    '_LF1_',
    [0, 'F.Cu', 'signal'],
    '_LF1_',
    ...innerLayers,
    [31, 'B.Cu', 'signal'],
    '_LF1_',
    [32, 'B.Adhes', 'user'],
    '_LF1_',
    [33, 'F.Adhes', 'user'],
    '_LF1_',
    [34, 'B.Paste', 'user'],
    '_LF1_',
    [35, 'F.Paste', 'user'],
    '_LF1_',
    [36, 'B.SilkS', 'user'],
    '_LF1_',
    [37, 'F.SilkS', 'user'],
    '_LF1_',
    [38, 'B.Mask', 'user'],
    '_LF1_',
    [39, 'F.Mask', 'user'],
    '_LF1_',
    [40, 'Dwgs.User', 'user'],
    '_LF1_',
    [41, 'Cmts.User', 'user'],
    '_LF1_',
    [42, 'Eco1.User', 'user'],
    '_LF1_',
    [43, 'Eco2.User', 'user'],
    '_LF1_',
    [44, 'Edge.Cuts', 'user'],
    '_LF1_',
    [45, 'Margin', 'user'],
    '_LF1_',
    [46, 'B.CrtYd', 'user'],
    '_LF1_',
    [47, 'F.CrtYd', 'user'],
    '_LF1_',
    [48, 'B.Fab', 'user', 'hide'],
    '_LF1_',
    [49, 'F.Fab', 'user', 'hide'],
  ];
  // date 20210220 > creation date of Kicad nightly
  // used for testing conversion results
  return [
    'kicad_pcb',
    ['version', 20210220],
    ['generator', 'pcbnew'],
    ['general', ['thickness', 1.6]],
    ['paper', 'A4'],
    '_LF_',
    ['layers', ...layers],
    ...outputObjs,
    ...flatten(conversionState.msgReports),
  ];
}

export function convertBoardV6(board: IEasyEDABoard): string {
  return encodeObject(convertBoardToArray(board));
}

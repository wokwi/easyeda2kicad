import * as fs from 'fs';
import { encodeObject } from './spectra';

// doc: https://docs.easyeda.com/en/DocumentFormat/3-EasyEDA-PCB-File-Format/index.html#shapes

const input = require('../test-pcb.json');

let output = `
(kicad_pcb (version 20171130) (host pcbnew "(5.0.2)-1")

(general
  (thickness 1.6)
  (drawings 12)
  (tracks 1187)
  (zones 0)
  (modules 93)
  (nets 100)
)

(page A4)
(layers
  (0 F.Cu signal)
  (31 B.Cu signal)
  (32 B.Adhes user)
  (33 F.Adhes user)
  (34 B.Paste user)
  (35 F.Paste user)
  (36 B.SilkS user)
  (37 F.SilkS user)
  (38 B.Mask user)
  (39 F.Mask user)
  (40 Dwgs.User user)
  (41 Cmts.User user)
  (42 Eco1.User user)
  (43 Eco2.User user)
  (44 Edge.Cuts user)
  (45 Margin user)
  (46 B.CrtYd user)
  (47 F.CrtYd user)
  (48 B.Fab user hide)
  (49 F.Fab user hide)
)

(setup
  (last_trace_width 0.25)
  (user_trace_width 0.16)
  (trace_clearance 0.2)
  (zone_clearance 0.508)
  (zone_45_only no)
  (trace_min 0.15)
  (segment_width 0.2)
  (edge_width 0.15)
  (via_size 0.8)
  (via_drill 0.4)
  (via_min_size 0.4)
  (via_min_drill 0.3)
  (uvia_size 0.3)
  (uvia_drill 0.1)
  (uvias_allowed no)
  (uvia_min_size 0.2)
  (uvia_min_drill 0.1)
  (pcb_text_width 0.3)
  (pcb_text_size 1.5 1.5)
  (mod_edge_width 0.15)
  (mod_text_size 1 1)
  (mod_text_width 0.15)
  (pad_size 1.7 1.7)
  (pad_drill 1)
  (pad_to_mask_clearance 0.051)
  (solder_mask_min_width 0.25)
  (aux_axis_origin 0 0)
  (visible_elements 7FFFFFFF)
  (pcbplotparams
    (layerselection 0x010fc_ffffffff)
    (usegerberextensions true)
    (usegerberattributes false)
    (usegerberadvancedattributes false)
    (creategerberjobfile false)
    (excludeedgelayer true)
    (linewidth 0.100000)
    (plotframeref false)
    (viasonmask false)
    (mode 1)
    (useauxorigin false)
    (hpglpennumber 1)
    (hpglpenspeed 20)
    (hpglpendiameter 15.000000)
    (psnegative false)
    (psa4output false)
    (plotreference true)
    (plotvalue true)
    (plotinvisibletext false)
    (padsonsilk false)
    (subtractmaskfromsilk false)
    (outputformat 1)
    (mirror false)
    (drillshape 0)
    (scaleselection 1)
    (outputdirectory "gerber"))
  )
`;

const layers = {
  1: 'F.Cu',
  2: 'B.Cu',
  3: 'F.SilkS',
  4: 'B.SilkS',
  5: 'F.Paste',
  6: 'B.Paste',
  7: 'F.Mask',
  8: 'B.Mask',
  10: 'Edge.Cuts'
};

function unitsToKicad(value: string | number) {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  return value * 10 * 0.0254;
}

function kicadAt(x: string, y: string, angle?: string) {
  return [
    'at',
    unitsToKicad(parseFloat(x) - 4000),
    unitsToKicad(parseFloat(y) - 3000),
    angle != null ? parseFloat(angle) : null
  ];
}

function kiStartEnd(startX: string, startY: string, endX: string, endY: string) {
  return [
    ['start', unitsToKicad(parseFloat(startX) - 4000), unitsToKicad(parseFloat(startY) - 3000)],
    ['end', unitsToKicad(parseFloat(endX) - 4000), unitsToKicad(parseFloat(endY) - 3000)]
  ];
}

function convertVia(args: string[]) {
  const [x, y, diameter, net, drill, id, locked] = args;
  return [
    'via',
    kicadAt(x, y),
    ['size', unitsToKicad(diameter)],
    ['drill', unitsToKicad(drill) * 2],
    ['layers', 'F.Cu', 'B.Cu'],
    ['net', nets.indexOf(net)]
  ];
}

function convertTrack(args: string[], objName = 'segment') {
  const [width, layer, net, coords, id, locked] = args;
  const netId = nets.indexOf(net);
  const coordList = coords.split(' ');
  let result = [];
  for (let i = 0; i < coordList.length - 2; i += 2) {
    const kiStartX = unitsToKicad(parseFloat(coordList[i]) - 4000);
    const kiStartY = unitsToKicad(parseFloat(coordList[i + 1]) - 3000);
    const kiEndX = unitsToKicad(parseFloat(coordList[i + 2]) - 4000);
    const kiEndY = unitsToKicad(parseFloat(coordList[i + 3]) - 3000);
    const layerName = layers[layer];
    result.push([
      objName,
      ['start', kiStartX, kiStartY],
      ['end', kiEndX, kiEndY],
      ['width', unitsToKicad(width)],
      ['layer', layerName],
      netId >= 0 ? ['net', netId] : null,
      locked === '1' ? ['status', 40000] : null
    ]);
  }
  return result;
}

function convertText(args: string[], objName = 'gr_text') {
  const [type, x, y, lineWidth, angle, mirror, layer, net, fontSize, text] = args;
  const layerName = layers[layer];
  return [
    objName,
    objName === 'fp_text' ? (type === 'P' ? 'reference' : 'value') : null,
    text,
    kicadAt(x, y, angle),
    ['layer', layerName],
    [
      'effects',
      [
        'font',
        ['size', unitsToKicad(fontSize), unitsToKicad(fontSize)],
        ['thickness', unitsToKicad(lineWidth)]
      ],
      layerName[0] === 'B' ? ['justify', 'mirror'] : null
    ]
  ];
}

function convertArc(args: string[]) {
  const [width, layer, net, drawing, _, id, locked] = args;
  const drawingParts = drawing.split(' ');
  const [startX, startY] = drawingParts[0].substr(1).split(',');
  const [endX, endY] = drawingParts[5].split(',');
  // TODO angle, center X / center Y ?
  return [
    'gr_arc',
    ...kiStartEnd(startX, startY, endX, endY),
    ['angle', 180], // TODO
    ['width', unitsToKicad(width)],
    ['layer', layers[layer]]
  ];
}

function convertFpArc(args: string[]) {
  // "1~10~~M3952.756,2999.9998 A46.9945,46.9945 0 1 1 4046.7437,2999.9998~~gge276~0",
  const [width, layer, net, drawing, _, id, locked] = args;
  const drawingParts = drawing.split(' ');
  const [startX, startY] = drawingParts.slice(1, 3);
  const [endX, endY] = drawingParts.slice(9);
  // TODO angle, center X / center Y ?
  // M4046.7437,2999.9998 A46.9945,46.9945 0 1 1 3952.756,2999.9998
  // rx ry x-axis-rotation large-arc-flag sweep-flag x y
  return [
    'fp_arc',
    ...kiStartEnd(startX, startY, endX, endY),
    ['angle', 180], // TODO
    ['width', unitsToKicad(width)],
    ['layer', layers[layer]]
  ];
}

function convertPad(args: string[]) {
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
    id,
    holeLength,
    holePoints,
    plated,
    locked
  ] = args;
  const shapes = {
    ELLIPSE: 'circle',
    RECT: 'rect',
    OVAL: 'oval',
    POLYGON: 'custom'
  };
  const netId = nets.indexOf(net);
  const netAttr = '';
  return [
    'pad',
    parseInt(num, 10),
    'smd',
    shapes[shape],
    kicadAt(x, y),
    ['size', 0.875, 0.95],
    ['layers', 'F.Cu', 'F.Paste', 'F.Mask']
    //net ? ` (net ${netId} "${net}")` : '';
  ];
}

function convertLib(args: string[]) {
  const [x, y, attributes, rotation, importFlag, id, locked] = args;
  const shapeList = args
    .join('~')
    .split('#@$')
    .slice(1);
  let shapes = [];
  for (const shape of shapeList) {
    const shapeParts = shape.split('~');
    if (shapeParts[0] === 'TRACK') {
      shapes.push(...convertTrack(shapeParts.slice(1), 'fp_line'));
    } else if (shapeParts[0] === 'TEXT') {
      shapes.push(convertText(shapeParts.slice(1), 'fp_text'));
    } else if (shapeParts[0] === 'ARC') {
      shapes.push(convertFpArc(shapeParts.slice(1)));
    } else if (shapeParts[0] === 'HOLE') {
      // TODO
    } else if (shapeParts[0] === 'PAD') {
      shapes.push(convertPad(shapeParts.slice(1)));
    } else {
      console.log(shapeParts[0]);
    }
  }

  return ['module', `Imported:${id}`, ['layer', 'F.Cu'], kicadAt(x, y), ...shapes];
}

const { nets } = input.routerRule;
const outputObjs = [];
for (let i = 0; i < nets.length; i++) {
  outputObjs.push(['net', i, nets[i]]);
}

for (const shapeEntry of input.shape) {
  const shape = shapeEntry.split('~');
  if (shape[0] === 'VIA') {
    outputObjs.push(convertVia(shape.slice(1)));
  }
  if (shape[0] === 'TRACK') {
    outputObjs.push(...convertTrack(shape.slice(1)));
  }
  if (shape[0] === 'TEXT') {
    outputObjs.push(convertText(shape.slice(1)));
  }
  if (shape[0] === 'ARC') {
    outputObjs.push(convertArc(shape.slice(1)));
  }
  if (shape[0] === 'COPPERAREA') {
    // TODO
  }
  if (shape[0] === 'LIB') {
    outputObjs.push(convertLib(shape.slice(1)));
  }
}

output += outputObjs.map(encodeObject).join('\n');
output += `)`;
fs.writeFileSync('output.kicad_pcb', output);

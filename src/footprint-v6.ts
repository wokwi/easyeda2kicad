import { IEasyEDAFootprint, FootprintHead } from './easyeda-types';
import { encodeObject, ISpectraList } from './spectra';
import {
  IParentTransform,
  IConversionState,
  kiUnits,
  kiCoords,
  kiAt,
  kiAngle,
  getNetId,
  reportError,
  convertTrack,
  convertPad,
  convertArc,
  convertCircle,
  convertRect,
  convertPolygon,
  convertText,
} from './board-v6';

// doc: https://docs.easyeda.com/en/DocumentFormat/3-EasyEDA-PCB-File-Format/index.html#shapes

function convertLibHole(args: string[], transform: IParentTransform) {
  const [x, y, radius, id, locked] = args;
  const size = kiUnits(radius) * 2;
  return [
    '_LF1_',
    [
      'pad',
      '',
      'np_thru_hole',
      'circle',
      kiAt(x, y, undefined, transform),
      ['size', size, size],
      ['drill', size],
      ['layers', '*.Cu', '*.Mask'],
    ],
  ];
}

function convertLibVia(
  args: string[],
  conversionState: IConversionState,
  isFp: boolean,
  transform: IParentTransform
): Array<ISpectraList | null> {
  // via without net becomes fp hole,
  // via with net becomes pcb via (not for footprint)
  const [x, y, diameter, net, drill, id, locked] = args;
  if (net === '' || net === '0') {
    const size = kiUnits(drill) * 2;
    const hole = [
      '_LF1_',
      [
        'pad',
        '',
        'np_thru_hole',
        'circle',
        kiAt(x, y, undefined, transform),
        ['size', size, size],
        ['drill', size],
        ['layers', '*.Cu', '*.Mask'],
      ],
    ];
    return [hole, null, null];
  } else {
    if (isFp) {
      const msg = `Warning: unsupported VIA found (${id}); via ignored`;
      const error = reportError(msg, conversionState);
      return [null, null, error];
    } else {
      const msg = `Warning: unsupported VIA found (${id}) of ${transform.fpId} on net ${net}; converted in pcb via`;
      const error = reportError(msg, conversionState);
      const via = [
        '_LF_',
        [
          'via',
          kiAt(x, y, undefined),
          ['size', kiUnits(diameter)],
          ['drill', kiUnits(drill) * 2],
          ['layers', 'F.Cu', 'B.Cu'],
          ['net', getNetId(conversionState, net)],
        ],
      ];
      return [null, via, error];
    }
  }
}

function convertHead(head: FootprintHead, fpProp: IConversionState): ISpectraList {
  const libProperties: ISpectraList = [];
  var label: string;
  var layer: string;
  var at: string;
  var effects: string;
  const properties: { [key: string]: string[] } = {
    value: ['package', 'fp_text', 'y', 'F.Fab', 'y'],
    tags: ['package', '', 'n', '', 'n'],
    descr: ['link', '', 'n', '', 'n'],
  };
  libProperties.push([
    '_LF1_',
    [
      'fp_text',
      'reference',
      'REF**',
      ['at', 0, 0],
      ['layer', 'F.SilkS'],
      ['effects', ['font', ['size', 1.27, 1.27]]],
    ],
  ]);
  fpProp.fpValue = 'unknown';
  Object.keys(properties).forEach(function (key) {
    prop = '';
    const libkey = properties[key][0];
    if (head.c_para.hasOwnProperty(libkey)) {
      label = properties[key][1];
      at = properties[key][2];
      layer = properties[key][3];
      effects = properties[key][4];
      var prop = head.c_para[libkey];
      switch (key) {
        case 'value':
          //label = 'fp_text';
          fpProp.fpValue = prop.replace(/[^\w\s\.\(\)\-]/g, 'x');
          break;
        case 'tags':
          prop = prop.split('_')[0] + ', EasyEDA conversion';
          break;
        case 'descr':
          prop = 'EasyEDA footprint: ' + prop;
      }
      libProperties.push([
        '_LF1_',
        [
          label === '' ? null : label,
          key,
          prop,
          at === 'y' ? ['at', 0, 0] : null,
          layer === '' ? null : ['layer', layer],
          effects === 'y' ? ['effects', ['font', ['size', 1.27, 1.27]]] : null,
        ],
      ]);
    }
  });
  return libProperties;
}

function flatten<T>(arr: T[]) {
  return ([] as T[]).concat(...arr);
}

export function convertFp(
  boardLIB: string,
  conversionState: IConversionState,
  isBoard: boolean = true,
  footprint?: IEasyEDAFootprint
): ISpectraList {
  var footprintProp: ISpectraList = [];
  const fpAttrs: ISpectraList = [];
  const footprintText: ISpectraList = [];
  const footprintArc: ISpectraList = [];
  const footprintCircle: ISpectraList = [];
  const footprintRect: ISpectraList = [];
  const footprintPoly: ISpectraList = [];
  const footprintLine: ISpectraList = [];
  const footprintHole: ISpectraList = [];
  const footprintPad: ISpectraList = [];
  const footprintViaToPcb: ISpectraList = [];
  //
  // called from board-v6 for processing LIB shape
  //
  if (isBoard) {
    const [fpHead, ...shapeList] = boardLIB.split('#@$');
    const [x, y, attributes, rotation, , id, , , , locked] = fpHead.split('~');
    const attrList = attributes.split('`');
    const attrs: { [key: string]: string } = {};
    for (let i = 0; i < attrList.length; i += 2) {
      attrs[attrList[i]] = attrList[i + 1];
    }
    const transform = { ...kiCoords(x, y), angle: kiAngle(rotation), fpId: id };
    for (const shape of shapeList) {
      const [type, ...shapeArgs] = shape.split('~');
      if (type === 'TRACK') {
        footprintLine.push(...convertTrack(shapeArgs, conversionState, 'fp_line', transform));
      } else if (type === 'TEXT') {
        footprintText.push(...convertText(shapeArgs, conversionState, 'fp_text', transform));
      } else if (type === 'ARC') {
        footprintArc.push(...convertArc(shapeArgs, conversionState, 'fp_arc', transform));
      } else if (type === 'HOLE') {
        footprintHole.push(...convertLibHole(shapeArgs, transform));
      } else if (type === 'PAD') {
        footprintPad.push(...convertPad(shapeArgs, conversionState, transform));
      } else if (type === 'CIRCLE') {
        footprintCircle.push(...convertCircle(shapeArgs, conversionState, 'fp_circle', transform));
      } else if (type === 'SOLIDREGION') {
        footprintPoly.push(...convertPolygon(shapeArgs, conversionState, transform));
      } else if (type === 'RECT') {
        footprintRect.push(...convertRect(shapeArgs, conversionState, 'fp_rect', transform));
      } else if (type === 'VIA') {
        const [fpHole, pcbVia, report] = convertLibVia(
          shapeArgs,
          conversionState,
          false,
          transform
        );
        if (fpHole !== null) {
          footprintHole.push(...fpHole);
        }
        if (report !== null) {
          footprintText.push(...report);
        }
        if (pcbVia !== null) {
          footprintViaToPcb.push(...pcbVia);
        }
      } else if (type !== 'SVGNODE') {
        const msg = `Warning: unsupported shape ${type} found in footprint ${id} on pcb`;
        const error = reportError(msg, conversionState);
      }
    }
    footprintText.push(
      ...[
        '_LF1_',
        [
          'fp_text',
          'user',
          id,
          ['at', 0, 0],
          ['layer', 'Cmts.User'],
          ['effects', ['font', ['size', 1, 1], ['thickness', 0.15]]],
        ],
      ]
    );
    const isSmd = footprintPad.some((pad: any) => pad && pad[2] === 'smd');
    if (isSmd) {
      fpAttrs.push(['attr', 'smd']);
    }
    var fp = attrs.package.replace(/[^\w\s\.\(\)\-]/g, 'x');
    return [
      '_LF_',
      [
        'footprint',
        `EasyEDA:${fp}`,
        locked === '1' ? 'locked' : null,
        ['layer', 'F.Cu'],
        kiAt(x, y, rotation),
        ...fpAttrs,
        ...footprintText,
        ...footprintLine,
        ...footprintRect,
        ...footprintCircle,
        ...footprintArc,
        ...footprintPoly,
        ...footprintHole,
        ...footprintPad,
      ],
      // via is not part of footprint anymore; however sorted incorrectly
      ...footprintViaToPcb,
    ];
    //
    // called from convertFootprint for processing footprint.json
    //
  } else {
    var angle;
    if (footprint!.head.rotation === undefined || isNaN(parseFloat(footprint!.head.rotation))) {
      angle = 0;
    } else {
      angle = parseFloat(footprint!.head.rotation);
    }
    const transform: IParentTransform = {
      x: parseFloat(footprint!.head.x) - 4000,
      y: parseFloat(footprint!.head.y) - 3000,
      angle: angle,
      fpId: 'this fp',
      isFootprintFile: true,
    };
    footprintProp = flatten(convertHead(footprint!.head, conversionState));
    for (const shape of footprint!.shape) {
      const [type, ...shapeArgs] = shape.split('~');
      if (type === 'TRACK') {
        footprintLine.push(...convertTrack(shapeArgs, conversionState, 'fp_line', transform));
      } else if (type === 'TEXT') {
        footprintText.push(...convertText(shapeArgs, conversionState, 'fp_text', transform));
      } else if (type === 'ARC') {
        footprintArc.push(convertArc(shapeArgs, conversionState, 'fp_arc', transform));
      } else if (type === 'HOLE') {
        footprintHole.push(...convertLibHole(shapeArgs, transform));
      } else if (type === 'PAD') {
        footprintPad.push(...convertPad(shapeArgs, conversionState, transform));
      } else if (type === 'CIRCLE') {
        footprintCircle.push(...convertCircle(shapeArgs, conversionState, 'fp_circle', transform));
      } else if (type === 'SOLIDREGION') {
        footprintPoly.push(...convertPolygon(shapeArgs, conversionState, transform));
      } else if (type === 'RECT') {
        footprintRect.push(...convertRect(shapeArgs, conversionState, 'fp_rect', transform));
      } else if (type === 'VIA') {
        const [fpHole, pcbVia, report] = convertLibVia(shapeArgs, conversionState, true, transform);
        if (fpHole !== null) {
          footprintHole.push(...fpHole);
        }
        if (report !== null) {
          footprintText.push(...report);
        }
      } else if (type !== 'SVGNODE') {
        const msg = `Warning: unsupported shape ${type} found in footprint`;
        footprintText.push(...reportError(msg, conversionState));
      }
    }
    const isSmd = footprintPad.some((pad: any) => pad && pad[2] === 'smd');
    if (isSmd) {
      fpAttrs.push(['attr', 'smd']);
    }
    // date 20210220 > creation date of Kicad nightly
    // used for testing conversion results
    return [
      'footprint',
      conversionState.fpValue,
      ['version', 20210220],
      ['generator', 'pcbnew'],
      ['layer', 'F.Cu'],
      ...footprintProp,
      ...fpAttrs,
      ...footprintText,
      ...footprintLine,
      ...footprintRect,
      ...footprintCircle,
      ...footprintArc,
      ...footprintPoly,
      ...footprintHole,
      ...footprintPad,
      '_LF1_',
      [
        'model',
        '${KICAD6_3DMODEL_DIR}/EasyEDA.3dshapes/' + conversionState.fpValue + '.wrl',
        ['offset', ['xyz', 0, 0, 0]],
        ['scale', ['xyz', 1, 1, 1]],
        ['rotate', ['xyz', 0, 0, 0]],
      ],
    ].filter((obj) => obj != null);
  }
}

// main.ts will automatically detect an Eda library .json as input.
//
// How to get a Eda footprint .json file:
// go to Eda online editor and click on library icon (on left side),
// select wanted footprint and click EDIT button
// choose menu File > EasyEDa File Source > click DOWNLOAD button.
//
//The generated output file is saved as "footprintname".kicad_mod;
// Place it in a "pretty" folder, eg EasyEDA.pretty.
// Import folder in Kicad using:
// menu Preferences > Manage Footprint Libraries
export function convertFootprint(footprint: IEasyEDAFootprint): string {
  const conversionState: IConversionState = {
    nets: [],
    innerLayers: 0,
    fpValue: '',
    msgRepCnt: 0,
    msgReports: [],
    msgReportsPosition: 0,
    pcbCuZoneCount: 0,
    pcbKeepoutZoneCount: 0,
    convertingFpFile: true,
  };
  const result = encodeObject(convertFp('null', conversionState, false, footprint));
  if (conversionState.msgRepCnt > 0) {
    console.warn(
      `In total ${conversionState.msgRepCnt} messages were created during the conversion. ` +
        `Check messages on fp layer User.Cmts for more details.`
    );
  }
  return `${conversionState.fpValue}.kicad_mod#@$${result}`;
}

#!/usr/bin/env node

import * as fs from 'fs';
import { convertBoard } from './board';
import { convertSchematic } from './schematic';
import { convertFootprint } from './footprint-v6';
import { convertBoardV6 } from './board-v6';

if (process.argv.length < 3) {
  console.error(
    `Usage: ${process.argv[1]} "ARG"` +
      '\n\tSchematics ARG: <input.json> [-] (stout else auto-generated: "input name".kicad_sch)' +
      '\n\tBoard ARG     : <input.json> [-] (stout else auto-generated: "input name".kicad_pcb) [v5] (not needed for v6)' +
      '\n\tFootprint ARG : <input.json> [-] (stout else auto-generated: "footprint".kicad_mod)'
  );
  process.exit(1);
}

if (process.argv[2] === '-v') {
  // tslint:disable-next-line
  console.log(`Version ${require('../package.json').version}`);
  process.exit(0);
}
if (!fs.existsSync(process.argv[2])) {
  console.error(`Input file ${process.argv[2]} does not exist.`);
  process.exit(1);
}
const inputMatch = /^(.*[\\\/]|)(.*).json$/gi.exec(process.argv[2]);
if (!inputMatch) {
  console.error(`Input file ${process.argv[2]} is not a .json file.`);
  process.exit(1);
}
const [match, inputDirName, inputFileName] = inputMatch;
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
var outputFileName = 'unknown';
let name = '';
let output = '';
let doctype = '0';
if (input.hasOwnProperty('docType')) {
  doctype = input.docType;
} else if (input.head.hasOwnProperty('docType')) {
  doctype = input.head.docType;
}
if (doctype === '5') {
  // schematic
  console.info(`Converting EasyEDA schematic ${process.argv[2]} to Kicad V5 basic wiring`);
  output = convertSchematic(input);
  outputFileName = inputDirName + inputFileName + '.kicad_sch';
} else if (doctype === '4') {
  // footprint
  console.info(`Converting EasyEDA footprint ${process.argv[2]} to Kicad footprint`);
  [name, output] = convertFootprint(input).split('#@$');
  if (process.argv[3] !== '-') {
    const dir = './EasyEDA.pretty';
    outputFileName = dir + '/' + inputDirName + name;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }
} else if (doctype === '3') {
  // board
  if (process.argv[4] === 'v5') {
    console.info(`Converting EasyEDA board ${process.argv[2]} to Kicad V5 board`);
    output = convertBoard(input);
  } else {
    console.info(`Converting EasyEDA board ${process.argv[2]} to Kicad V6 board`);
    output = convertBoardV6(input);
  }
  outputFileName = inputDirName + inputFileName + '.kicad_pcb';
} else {
  console.warn(`warning: input file ${process.argv[2]} is not a valid EasyEDA configuration file.`);
}

if (outputFileName && process.argv[3] !== '-') {
  fs.writeFileSync(outputFileName, output);
  console.info(`Successful converted to output file: ${outputFileName}`);
} else {
  process.stdout.write(output);
}

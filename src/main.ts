#!/usr/bin/env node

import * as fs from 'fs';
import { convertBoard } from './board';
import { convertSchematic } from './schematic';
import { convertSchematicV6 } from './schematic-v6';
import { convertLibraryV6 } from './library-v6';

if (process.argv.length < 3) {
  console.error(
    `Usage: ${process.argv[1]} "ARG"` +
      '\n\tSchematics ARG : <input.json> [-] (stout else auto-generated: "input name".kicad_sch) ["v5" OR sheetnumber]' +
      '\n\tBoard ARG      : <input.json> [-] (stout else auto-generated: "input name".kicad_pcb)' +
      '\n\tLib_symbol ARG : <input.json> [-] (stout else auto-generated: EasyEDA.kicad_sym)'
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
var outputFileName;
var symbolFileName;
let output = '';
let symbols = '';
let doctype = '0';
let sheet = 1;
let last = 2;
if (input.hasOwnProperty('docType')) {
  doctype = input.docType;
} else if (input.head.hasOwnProperty('docType')) {
  doctype = input.head.docType;
}
if (doctype === '1') {
  // schematic
  console.info(`Converting EasyEDA schematic ${process.argv[2]} to Kicad V6 schematic`);
  outputFileName = inputDirName + inputFileName + '.kicad_sch';
  symbolFileName = inputDirName + 'EasyEDA.kicad_sym';
  [output, symbols] = convertSchematicV6(input, sheet);
} else if (doctype === '5') {
  process.argv[3] === '-' ? (last = 4) : (last = 3);
  if (process.argv[last] === 'v5') {
    console.info(`Converting EasyEDA schematic ${process.argv[2]} to Kicad V5 basic wiring`);
    outputFileName = inputDirName + inputFileName + '.kicad_sch';
    output = convertSchematic(input);
  } else {
    if (process.argv.length == last + 1) {
      sheet = parseInt(process.argv[last]);
      isNaN(sheet) ? (sheet = 1) : sheet;
    }
    console.info(
      `Converting EasyEDA schematic ${process.argv[2]} sheet ${sheet} to Kicad V6 schematic`
    );
    outputFileName = inputDirName + inputFileName + '.kicad_sch';
    symbolFileName = inputDirName + 'EasyEDA.kicad_sym';
    [output, symbols] = convertSchematicV6(input, sheet);
  }
  // schematic symbol
} else if (doctype === '2') {
  console.info(`Converting EasyEDA library ${process.argv[2]} to Kicad V6 library`);
  outputFileName = inputDirName + 'EasyEDA.kicad_sym';
  output = convertLibraryV6(input);
  // board V5
} else if (doctype === '3') {
  console.info(`Converting EasyEDA board ${process.argv[2]} to Kicad V5 board`);
  outputFileName = inputDirName + inputFileName + '.kicad_pcb';
  output = convertBoard(input);
} else {
  console.error(`Error: input file ${process.argv[2]} is not a valid EasyEDA configuration file.`);
}

if (symbolFileName) {
  fs.writeFileSync(symbolFileName, symbols);
}
if (outputFileName && process.argv[3] !== '-') {
  fs.writeFileSync(outputFileName, output);
} else {
  process.stdout.write(output);
}

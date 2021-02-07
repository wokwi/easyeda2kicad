#!/usr/bin/env node

import * as fs from 'fs';
import { convertBoard } from './board';
import { convertSchematic } from './schematic';
import { convertSchematicV6 } from './schematic-v6';
import { convertLibraryV6 } from './library-v6';
import { encodeObject } from './spectra';

if (process.argv.length < 3) {
  `Usage: ${process.argv[1]} <input.json> [output.kicad_pcb/sch/sym]  + for sch: [v5 / sheetnumber]`;
  process.exit(1);
}

if (process.argv[2] === '-v') {
  // tslint:disable-next-line
  console.log(`Version ${require('../package.json').version}`);
  process.exit(0);
}

const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
var doctype = '0';
if (input.hasOwnProperty('docType')) {
  doctype = input.docType;
} else if (input.head.hasOwnProperty('docType')) {
  doctype = input.head.docType;
}
var output = '';
var sheet = 1;
// schematic V5 & V6
if (doctype === '1') {
  console.info(`Converting EasyEDA schematic ${process.argv[2]} to Kicad V6 schematic`);
  output = convertSchematicV6(input, sheet);
} else if (doctype === '5') {
  if (process.argv[4] === 'v5') {
    console.info(`Converting EasyEDA schematic ${process.argv[2]} to Kicad V5 basic wiring`);
    output = convertSchematic(input);
  } else {
    if (process.argv.length == 5) {
      sheet = parseInt(process.argv[4]);
      isNaN(sheet) ? (sheet = 1) : sheet;
    }
    console.info(
      `Converting EasyEDA schematic ${process.argv[2]} sheet ${sheet} to Kicad V6 schematic`
    );
    output = convertSchematicV6(input, sheet);
  }
  // schematic library V6
} else if (doctype === '2') {
  console.info(`Converting EasyEDA library ${process.argv[2]} to Kicad V6 library`);
  output = convertLibraryV6(input);
  // board V5
} else if (doctype === '3') {
  console.info(`Converting EasyEDA board ${process.argv[2]} to Kicad board`);
  output = convertBoard(input);
} else {
  console.error(`Error: input file ${process.argv[2]} is not a valid EasyEDA configuration file.`);
}

const outputFile = process.argv[3];
if (outputFile && outputFile !== '-') {
  fs.writeFileSync(outputFile, output);
} else {
  process.stdout.write(output);
}

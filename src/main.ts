import * as fs from 'fs';
import { convertBoard } from './board';

const input = require('../test-pcb.json');
fs.writeFileSync('output.kicad_pcb', convertBoard(input));

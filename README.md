# EasyEDA 2 KiCad

This is an extended version of the excellent EasyEDA converter by Uri Shaked.
You can find his repository and further info here : https://github.com/wokwi/easyeda2kicad

The additions will only work with the nightly builds of Kicad V6

## Installation

```
npm install -g easyeda2kicad
```

## Usage

```
Usage: easyeda2kicad "ARG"
        Schematics ARG: <input.json> [-] (stout else auto-generated: "input name".kicad_sch)
        Board ARG     : <input.json> [-] (stout else auto-generated: "input name".kicad_pcb) [v5] (not needed for v6)
        Footprint ARG : <input.json> [-] (stout else auto-generated: "footprint".kicad_mod)
```

## Notes

Changes to easyeda2kicad 1.9.2:
(will address issues: #32, #43, #45 & #49)
1)Some bug fixes to board.ts (they are documented in the source code),
2)kiUnits is removed from kiCoord to keep EasyEDA units up to the Kicad formatting state (better for debugging),
2)Output file formatting for the board and footprint output files is implemented.
3)Enhancements to board.ts:
a) added rectangle support,
b) text height support for better fit of default font,
c) error / warning info has been moved to layer comments on the pcb,
d) via in footprint workaround implemented,
e) slotted hole improvement,
f) COPPERAREA enhancements implemented,
g) SOLIDREGION enhancements implemented,
h) workaround for board edge problem.
4)New footprint.ts will enable the conversion of EasyEDA footprint into Kicad footprint,
5)The files Board.ts and footprint.ts share a lot of functions, because footprint.ts will do the LIB conversion for the board.
Therefore specific footprint only functions are move from board.ts to footprint.ts,
6)EasyEDA footprint interface descriptions are added to easyeda-types.ts,
6)Auto detection of schematic, board and footprint .json in main.ts and auto generated output filename,
7)The board.spec.ts is updated and passes all existing tests and new tests are added.

## Known issues

1. Kicad board text (fp_text) rotate does not work properly. The rotation for 0 & 180 as well as 90 & 270 degree are the same.
   EasyEDA text will not always be positioned properly in Kicad; moving the text manually is needed for now. However for gl_text it works as expected.
2. Some text labels in EasyEDA will be positioned incorrectly in Kicad due to a bug(?) in EasyEDA. This can be corrected be rotating the text manually.

## License

Most of the code is released under the MIT license, with the exception of [src/svg-arc.ts](src/svg-arc.ts), which is
released under the Apache 2.0 license.

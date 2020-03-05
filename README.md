# EasyEDA 2 KiCad

Convert EasyEDA PCBs to KiCad format

[![Build Status](https://travis-ci.org/wokwi/easyeda2kicad.png?branch=master)](https://travis-ci.org/wokwi/easyeda2kicad)

## Online Converter

The easiest way to convert EasyEDA boards to KiCad format is to use the online convertor:

https://wokwi.com/easyeda2kicad

## Installation

```
npm install -g easyeda2kicad
```

## Usage

```
easyeda2kicad <input.json> [output.kicad_pcb]
```

## Notes

Copper zones are converted but not filled. When you load the converted PCB in KiCad press "b" (or "Edit" → "Fill All Zones") to recalculate the zones.

## License

Copyright (C) 2019, Uri Shaked.

Most of the code is released under the MIT license, with the exception of [src/svg-arc.ts](src/svg-arc.ts), which is 
released under the Apache 2.0 license.

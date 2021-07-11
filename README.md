# EasyEDA 2 KiCad

This is an extended version of the excellent EasyEDA pcb converter by Uri Shaked.
In the schematic6 branch the conversion for EasyEDA schematics to Kicad V6 has been added.

https://wokwi.com/easyeda2kicad

## Installation

```
npm install -g easyeda2kicad
```

## Usage

```
easyeda2kicad <input.json> [output.kicad_pcb/sch/sym] + for sch: [v5 / sheetnumber]
```

## Notes

The output is in the Kicad version 6 format. I had little information available, so the converter
has been build by reverse engineering Kicad schematics. This has partly been documented
as comment in the source files (for future reference).

Try it out, there are a few examples in the examples directory.

The schematic converter will output the Kicad config in a formatted way, so debugging is easier.
I will try to make a similar implementation for the board converter.

I will submit a pull request to Uri for the schematic v6 implementation.

Finally: I am not a professional programmer nor a Github expert.
If Uri accepts my pull request, further development will continue on his repository.
For now it is not my intention to handle issues for my repository.

## Known limitations

1. Multi-part library items (eg opAmps) are not supported,
2. No shared library items, so every component has it's own symbol in the schematics,
3. No image support on the schematic sheet,

## Background

A few years ago I made a schematic & board converter in Python but never released it.
However I wanted to learn more about Typescript and I was looking for a interesting example.
So when I found Uri's project, I could not resist to implement some of my previous experiences into his project.
Because Kicad V6 will be released soon, the schematics conversion has been done this time in the new schematics format.

## License

Most of the code is released under the MIT license, with the exception of [src/svg-arc.ts](src/svg-arc.ts), which is
released under the Apache 2.0 license.

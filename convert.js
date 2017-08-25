#!/usr/bin/env node

'use strict';

var fs = require('fs'),
    parseArgs = require('minimist'),
    PNG = require('pngjs').PNG,
    convertSDF = require('./index').convert;

var args = parseArgs(process.argv.slice(2));

if (!args._ || args._.length !== 2) exitOnValidationError('<input filename> and <output filename> are required.');

var inFile = args._[0],
    outFile = args._[1],
    buffer = readArgOr('b', 'buffer', 3),
    cutoff = readArgOr('c', 'cutoff', 0.25),
    radius = readArgOr('r', 'radius', 8);

function readArgOr(a, b, defaultValue) {
    if (args.hasOwnProperty(a)) return args[a];
    if (args.hasOwnProperty(b)) return args[b];
    return defaultValue;
}

var input = fs.readFileSync(inFile);
var png = PNG.sync.read(input);

if (!png.alpha) {
    exitOnError('Input PNG must contain alpha channel.');
}

var width = png.width + 2 * buffer,
    height = png.height + 2 * buffer;

var maxDim = Math.max(width, height);
var gridOuter = new Float64Array(width * height),
    gridInner = new Float64Array(width * height),
    f = new Float64Array(maxDim),
    d = new Float64Array(maxDim),
    z = new Float64Array(maxDim + 1),
    v = new Int16Array(maxDim);

var extended = new PNG({
    width: width,
    height: height
});

for (var y = 0, s = 0, x; y < height; y++, s += width * 4) {
    if (y >= buffer && y <= (buffer + png.height)) {
        for (x = 0; x < width * 4; x++) {
            if (x < 4 * buffer || x >= (width * 4 - buffer * 4)) {
                extended.data[s + x] = 0;
            } else {
                extended.data[s + x] = png.data[(y - buffer) * png.width * 4 + (x - 4 * buffer)];
            }
        }
    } else {
        for (x = 0; x < width * 4; x++) {
            extended.data[s + x] = 0;
        }
    }
}

var convertedAlpha = convertSDF(extended.data, width, height, radius, cutoff, gridOuter, gridInner, f, d, z, v);

for (var i = 0, j = -1; i < width * height; ++i) {
    extended.data[++j] = 0;
    extended.data[++j] = 0;
    extended.data[++j] = 0;
    extended.data[++j] = convertedAlpha[i];
}

var buf = PNG.sync.write(extended);
fs.writeFileSync(outFile, buf);

function exitOnError(message) {
    throw new Error('Error: ' + message);
}

function exitOnValidationError(message) {
    console.log('Usage: node convert.js <input filename> <output filename> [-b|--buffer <buffer> -r|--radius <radius> -c|--cutoff <cutoff>]');
    exitOnError(message);
}

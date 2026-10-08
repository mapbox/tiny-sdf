import TinySDF from '../index.js';
import nodeCanvas from 'canvas';
import {PNG} from 'pngjs';
import {readFileSync, writeFileSync} from 'fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import pixelmatch from 'pixelmatch';

const baseUrl = import.meta.url;

class MockTinySDF extends TinySDF {
    _createCanvas(size) {
        return nodeCanvas.createCanvas(size, size);
    }
}

test('draws an SDF given a character', () => {

    const rawUrl = new URL('./fixtures/1-raw.png', baseUrl);
    const sdfUrl = new URL('./fixtures/1-sdf.png', baseUrl);
    const metricsUrl = new URL('./fixtures/1-metrics.json', baseUrl);
    const outMetricsUrl = new URL('./fixtures/1-out.json', baseUrl);

    const sdf = new MockTinySDF({
        fontSize: 48,
        buffer: 3
    });

    const originalMeasureText = sdf.ctx.measureText;

    sdf.ctx.measureText = function (text) {
        if (process.env.UPDATE) {
            const metrics = originalMeasureText.call(this, text);
            writeFileSync(metricsUrl, JSON.stringify(metrics, null, 2));
        }
        return JSON.parse(readFileSync(metricsUrl));
    };

    const originalFillText = sdf.ctx.fillText;

    sdf.ctx.fillText = function (text, x, y) {
        if (process.env.UPDATE) {
            originalFillText.call(this, text, x, y);
            const {width, height} = this.canvas;
            const png = new PNG({width, height});
            png.data.set(this.getImageData(0, 0, width, height).data);
            writeFileSync(rawUrl, PNG.sync.write(png));
        }
        const png = PNG.sync.read(readFileSync(rawUrl));
        this.putImageData(nodeCanvas.createImageData(new Uint8ClampedArray(png.data.buffer), png.width), 0, 0);
    };

    const {data, ...metrics} = sdf.draw('材');

    if (process.env.UPDATE) {
        writeFileSync(outMetricsUrl, JSON.stringify(metrics, null, 2));
    }
    const expectedMetrics = JSON.parse(readFileSync(outMetricsUrl));

    assert.deepEqual(metrics, expectedMetrics, 'metrics');

    const actualImg = new Uint8Array(data.length * 4);

    for (let i = 0; i < data.length; i++) {
        actualImg[4 * i] = data[i];
        actualImg[4 * i + 1] = data[i];
        actualImg[4 * i + 2] = data[i];
        actualImg[4 * i + 3] = 255;
    }

    const {width, height} = metrics;

    if (process.env.UPDATE) {
        const png = new PNG({width, height});
        png.data.set(actualImg);
        writeFileSync(sdfUrl, PNG.sync.write(png));
    }

    const expectedImg = PNG.sync.read(readFileSync(sdfUrl)).data;
    const numDiffPixels = pixelmatch(expectedImg, actualImg, undefined, width, height, {threshold: 0, includeAA: true});

    assert.equal(numDiffPixels, 0, 'SDF pixels');
});

test('does not crash on diacritic marks', () => {
    const sdf = new MockTinySDF();
    sdf.draw('í'[1]);
    sdf.draw('G̱'[1]);
});

test('does not return negative-width glyphs', () => {
    const sdf = new MockTinySDF();
    // stub these because they vary across environments
    sdf.ctx.measureText = () => ({
        width: 0,
        actualBoundingBoxLeft: -23.3759765625,
        actualBoundingBoxRight: -17.6162109375,
        actualBoundingBoxAscent: 20.2080078125,
        actualBoundingBoxDescent: -14.51953125,
        emHeightAscent: 26,
        emHeightDescent: 9,
        alphabeticBaseline: 7.51953125
    });
    const glyph = sdf.draw('゙');
    assert.equal(glyph.glyphWidth, 0);
    assert.equal(glyph.width, 6); // zero-width glyph with 3px buffer
});

test('fits the distance grids and stays symmetric for a canvas-filling square clipped at the edge', () => {
    const sdf = new MockTinySDF({fontSize: 20, buffer: 2});
    const {size} = sdf;

    sdf.ctx.measureText = () => ({
        width: 40,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: 40,
        actualBoundingBoxAscent: 30,
        actualBoundingBoxDescent: 10
    });
    sdf.ctx.fillText = function () {
        this.fillRect(0, 0, size, size);
    };

    const {data, width, height} = sdf.draw('X');
    const longestLine = Math.max(width, height);

    assert.ok(width > size && height > size, 'the padded glyph is bigger than the canvas');
    assert.ok(width * height <= sdf.gridOuter.length, 'the padded glyph fits the distance grids');
    assert.ok(longestLine <= sdf.f.length && longestLine <= sdf.v.length && longestLine < sdf.z.length,
        'the padded glyph fits the 1D transform scratch arrays');

    for (let y = 0; y < height; y++) {
        const row = data.subarray(y * width, (y + 1) * width);
        const mirroredRow = data.subarray((height - 1 - y) * width, (height - y) * width);
        assert.deepEqual(row, mirroredRow, `row ${y} mirrors row ${height - 1 - y}`);
        assert.deepEqual(row, row.slice().reverse(), `row ${y} is left-right symmetric`);
    }
});

test('keeps glyph dimensions integer with fractional fontSize and buffer', () => {
    const sdf = new MockTinySDF({fontSize: 24.5, buffer: 2.6});
    const {data, width, height} = sdf.draw('W');
    assert.ok(Number.isInteger(width) && Number.isInteger(height));
    assert.equal(data.length, width * height);
    assert.ok(data.some(v => v > 191), 'glyph interior is rendered');
});

test('renders Chinese and Japanese versions of characters', () => {
    // assumes Noto Sans CJK SC font is installed
    const sdf1 = new MockTinySDF({fontFamily: 'Noto Sans CJK SC', lang: 'zh'});
    const glyph1 = sdf1.draw('门');
    const sdf2 = new MockTinySDF({fontFamily: 'Noto Sans CJK SC', lang: 'ja'});
    const glyph2 = sdf2.draw('门');
    assert.notDeepStrictEqual(glyph1.data, glyph2.data);
});

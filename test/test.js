
import TinySDF from '../index.js';
import nodeCanvas from 'canvas';
import {PNG} from 'pngjs';
import {readFileSync, writeFileSync} from 'fs';
import {test} from 'tape';
import pixelmatch from 'pixelmatch';

const baseUrl = import.meta.url;

test('draws an SDF given a character', (t) => {

    class MockTinySDF extends TinySDF {
        _createCanvas(size) {
            return nodeCanvas.createCanvas(size, size);
        }
    }

    const rawUrl = new URL('./fixtures/1-raw.png', baseUrl);
    const sdfUrl = new URL('./fixtures/1-sdf.png', baseUrl);
    const metricsUrl = new URL('./fixtures/1-metrics.json', baseUrl);

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

    const {data, width, height, glyphWidth, glyphHeight, glyphTop, glyphLeft, glyphAdvance} = sdf.draw('材');

    t.equal(width, 54, 'width');
    t.equal(height, 50, 'height');
    t.equal(glyphWidth, 48, 'glyphWidth');
    t.equal(glyphHeight, 44, 'glyphHeight');
    t.equal(glyphTop, 39, 'glyphTop');
    t.equal(glyphLeft, 0, 'glyphLeft');
    t.equal(glyphAdvance, 48, 'glyphAdvance');

    const actualImg = new Uint8Array(data.length * 4);

    for (let i = 0; i < data.length; i++) {
        actualImg[4 * i] = data[i];
        actualImg[4 * i + 1] = data[i];
        actualImg[4 * i + 2] = data[i];
        actualImg[4 * i + 3] = 255;
    }

    if (process.env.UPDATE) {
        const png = new PNG({width, height});
        png.data.set(actualImg);
        writeFileSync(sdfUrl, PNG.sync.write(png));
    }

    const expectedImg = PNG.sync.read(readFileSync(sdfUrl));
    const numDiffPixels = pixelmatch(expectedImg.data, actualImg, undefined, width, height, {threshold: 0, includeAA: true});

    t.equal(numDiffPixels, 0, 'SDF pixels');

    t.end();
});


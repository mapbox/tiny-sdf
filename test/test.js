
import TinySDF from '../index.js';
import nodeCanvas from 'canvas';
import {PNG} from 'pngjs';
import {readFileSync, writeFileSync} from 'fs';
import {test} from 'tape';
import pixelmatch from 'pixelmatch';

const fixtureA = PNG.sync.read(readFileSync(new URL('./glyph.png', import.meta.url)));

class NodeTinySDF extends TinySDF {
    _createCanvas(size) {
        return nodeCanvas.createCanvas(size, size);
    }
}

test('draws an SDF given a character', (t) => {
    const sdf = new NodeTinySDF({
        fontSize: 48
    });

    const {data, metrics} = sdf.draw('材');

    t.same(metrics, {
        width: 48,
        height: 44,
        sdfWidth: 54,
        sdfHeight: 50,
        top: 39,
        left: 0,
        advance: 48
    });

    const width = metrics.sdfWidth;
    const height = metrics.sdfHeight;

    t.equal(fixtureA.width, width);
    t.equal(fixtureA.height, height);

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
        writeFileSync(new URL('./glyph.png', import.meta.url), PNG.sync.write(png));
    }

    const numDiffPixels = pixelmatch(fixtureA.data, actualImg, undefined, width, height);

    t.equal(numDiffPixels, 0);

    t.end();
});


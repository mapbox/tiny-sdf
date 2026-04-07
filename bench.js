import TinySDF from './index.js';
import nodeCanvas from 'canvas';


class MockTinySDF extends TinySDF {
    _createCanvas(size) {
        return nodeCanvas.createCanvas(size, size);
    }
}

const sdf = new MockTinySDF({
    fontSize: 48,
    buffer: 3
});

// warmup
for (let i = 0; i < 1000; ++i) {
    sdf.draw('@');
}

const N = 1e4;
const start = performance.now();
for (let i = 0; i < N; ++i) {
    sdf.draw('@');
}
console.log(`${N} iterations took ${Math.round(performance.now() - start)} ms`);


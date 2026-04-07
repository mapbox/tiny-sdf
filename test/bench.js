import TinySDF from '../index.js';
import nodeCanvas from 'canvas';


class MockTinySDF extends TinySDF {
    _createCanvas(size) {
        return nodeCanvas.createCanvas(size, size);
    }
}

function bench(iterationsCount) {
    const sdf = new MockTinySDF({
        fontSize: 48,
        buffer: 3
    });
    for (let i = 0; i < iterationsCount; ++i) {
        sdf.draw('@');
    }
}

function getCurrentTimestamp() {
    return performance.now();
}

const ITERATIONS_COUNT = 1e5;
const tStart = getCurrentTimestamp();
bench(ITERATIONS_COUNT);
const tEnd = getCurrentTimestamp();
const dtSec = (tEnd - tStart) * 0.001;
console.log(`Durations for ${ITERATIONS_COUNT} iterations: ${dtSec} seconds`);


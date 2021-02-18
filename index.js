'use strict';

const INF = 1e20;

class TinySDF {
    constructor(fontSize = 24, buffer = 3, radius = 8, cutoff = 0.25, fontFamily = 'sans-serif', fontWeight = 'normal') {
        this.fontSize = fontSize;
        this.buffer = buffer;
        this.cutoff = cutoff;
        this.fontFamily = fontFamily;
        this.fontWeight = fontWeight;
        this.radius = radius;

        // For backwards compatibility, we honor the implicit contract that the
        // size of the returned bitmap will be fontSize + buffer * 2
        const size = this.size = fontSize + buffer * 2;
        // Glyphs may be slightly larger than their fontSize. The canvas already
        // has buffer space, but create extra buffer space in the output grid for the
        // "halo" to extend into (if metric extraction is enabled)
        const gridSize = size + buffer * 2;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = size;

        this.ctx = this.canvas.getContext('2d');
        this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

        this.ctx.textBaseline = 'alphabetic';
        this.ctx.textAlign = 'left'; // Necessary so that RTL text doesn't have different alignment
        this.ctx.fillStyle = 'black';

        // temporary arrays for the distance transform
        this.gridOuter = new Float64Array(gridSize * gridSize);
        this.gridInner = new Float64Array(gridSize * gridSize);
        this.f = new Float64Array(gridSize);
        this.z = new Float64Array(gridSize + 1);
        this.v = new Uint16Array(gridSize);
    }

    getMetrics(char) {
        const {
            width: advance,
            actualBoundingBoxAscent,
            actualBoundingBoxDescent,
            actualBoundingBoxLeft,
            actualBoundingBoxRight
        } = this.ctx.measureText(char);

        // The integer/pixel part of the top alignment is encoded in metrics.top
        // The remainder is implicitly encoded in the rasterization
        const top = Math.floor(actualBoundingBoxAscent);
        const left = 0;

        // If the glyph overflows the canvas size, it will be clipped at the bottom/right
        const width = Math.min(this.size, Math.ceil(actualBoundingBoxRight - actualBoundingBoxLeft));
        const height = Math.min(this.size - this.buffer, Math.ceil(actualBoundingBoxAscent + actualBoundingBoxDescent));

        const sdfWidth = width + 2 * this.buffer;
        const sdfHeight = height + 2 * this.buffer;

        return {width, height, sdfWidth, sdfHeight, top, left, advance};
    }

    draw(char, metrics = this.getMetrics(char)) {
        const {width, height, sdfWidth, sdfHeight, top} = metrics;

        // The integer/pixel part of the top alignment is encoded in metrics.top
        // The remainder is implicitly encoded in the rasterization
        const baselinePosition = this.buffer + top + 1;

        let imgData;
        if (width && height) {
            this.ctx.clearRect(this.buffer, this.buffer, width, height);
            this.ctx.fillText(char, this.buffer, baselinePosition);
            imgData = this.ctx.getImageData(this.buffer, this.buffer, width, height);
        }

        const data = new Uint8ClampedArray(sdfWidth * sdfHeight);

        // Initialize grids outside the glyph range to alpha 0
        this.gridOuter.fill(INF, 0, sdfWidth * sdfHeight);
        this.gridInner.fill(0, 0, sdfWidth * sdfHeight);

        const offset = (sdfWidth - width) >> 1;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const j = (y + offset) * sdfWidth + x + offset;
                const a = imgData.data[4 * (y * width + x) + 3] / 255; // alpha value
                this.gridOuter[j] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
                this.gridInner[j] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
            }
        }

        edt(this.gridOuter, sdfWidth, sdfHeight, this.f, this.v, this.z);
        edt(this.gridInner, sdfWidth, sdfHeight, this.f, this.v, this.z);

        for (let i = 0; i < sdfWidth * sdfHeight; i++) {
            const d = Math.sqrt(this.gridOuter[i]) - Math.sqrt(this.gridInner[i]);
            data[i] = Math.round(255 - 255 * (d / this.radius + this.cutoff));
        }

        return {data, metrics};
    }
}

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(data, width, height, f, v, z) {
    for (let x = 0; x < width; x++) edt1d(data, x, width, height, f, v, z);
    for (let y = 0; y < height; y++) edt1d(data, y * width, 1, width, f, v, z);
}

// 1D squared distance transform
function edt1d(grid, offset, stride, length, f, v, z) {
    let q, k, s, r;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;

    for (q = 0; q < length; q++) f[q] = grid[offset + q * stride];

    for (q = 1, k = 0, s = 0; q < length; q++) {
        do {
            r = v[k];
            s = (f[q] - f[r] + q * q - r * r) / (q - r) / 2;
        } while (s <= z[k] && --k > -1);

        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }

    for (q = 0, k = 0; q < length; q++) {
        while (z[k + 1] < q) k++;
        r = v[k];
        grid[offset + q * stride] = f[r] + (q - r) * (q - r);
    }
}

module.exports = TinySDF;
module.exports.default = TinySDF;

const INF = 1e20;

// lookup table for gamma-corrected, signed squared alpha distance values
const alphaTable = new Float64Array(256);
for (let i = 0; i < 256; i++) {
    const d = 0.5 - Math.pow(i / 255, 1 / 2.2);
    alphaTable[i] = d * Math.abs(d);
}
alphaTable[255] = -INF;

export default class TinySDF {
    constructor({
        fontSize = 24,
        buffer = 3,
        radius = 8,
        cutoff = 0.25,
        fontFamily = 'sans-serif',
        fontWeight = 'normal',
        fontStyle = 'normal',
        lang = null
    } = {}) {
        this.buffer = buffer; // padding around a glyph's bounding box
        this.radius = radius; // how many pixels around the glyph edge are encoded as signed distances
        this.cutoff = cutoff; // how much of the SDF byte range represents inside vs outside the edge
        this.lang = lang; // language of the Canvas drawing context

        // make the canvas size big enough to both have the specified buffer around the glyph
        // for "halo", and account for some glyphs possibly being larger than their font size
        const size = this.size = fontSize + buffer * 4;

        const canvas = this._createCanvas(size);
        const ctx = this.ctx = canvas.getContext('2d', {willReadFrequently: true});
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left'; // Necessary so that RTL text doesn't have different alignment
        ctx.fillStyle = 'black';

        // two grids of squared distances: one for the outside of the glyph shape, one for the inside;
        // the signed distance is derived as sqrt(outer) - sqrt(inner)
        this.gridOuter = new Float64Array(size * size);
        this.gridInner = new Float64Array(size * size);
        this.f = new Float64Array(size);
        this.z = new Float64Array(size + 1);
        this.v = new Uint16Array(size);
    }

    _createCanvas(size) {
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(size, size);
        }
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        return canvas;
    }

    draw(char) {
        const {
            width: glyphAdvance,
            actualBoundingBoxAscent,
            actualBoundingBoxDescent,
            actualBoundingBoxLeft,
            actualBoundingBoxRight
        } = this.ctx.measureText(char);

        // The integer/pixel part of the alignment is encoded in metrics.glyphTop/glyphLeft
        // The remainder is implicitly encoded in the rasterization
        const glyphTop = Math.ceil(actualBoundingBoxAscent);
        const glyphLeft = Math.floor(actualBoundingBoxLeft);

        // If the glyph overflows the canvas size, it will be clipped at the bottom/right
        const glyphWidth = Math.max(0, Math.min(this.size - this.buffer, Math.ceil(actualBoundingBoxRight) - glyphLeft));
        const glyphHeight = Math.max(0, Math.min(this.size - this.buffer, glyphTop + Math.ceil(actualBoundingBoxDescent)));

        const width = glyphWidth + 2 * this.buffer;
        const height = glyphHeight + 2 * this.buffer;

        const len = Math.max(width * height, 0);
        const data = new Uint8ClampedArray(len);
        const glyph = {data, width, height, glyphWidth, glyphHeight, glyphTop, glyphLeft, glyphAdvance};
        if (glyphWidth === 0 || glyphHeight === 0) return glyph;

        const {ctx, buffer, gridInner, gridOuter} = this;
        if (this.lang) ctx.lang = this.lang;
        ctx.clearRect(buffer, buffer, glyphWidth, glyphHeight);
        ctx.fillText(char, buffer - glyphLeft, buffer + glyphTop);
        const imgData = ctx.getImageData(buffer, buffer, glyphWidth, glyphHeight);

        // default: outside the glyph (INF distance) for outer, inside (0 distance) for inner
        gridOuter.fill(INF, 0, len);
        gridInner.fill(0, 0, len);

        // for anti-aliased pixels, treat partial coverage as a distance approximation:
        // a fully covered pixel gets 0 outer / INF inner; a partial pixel gets a small
        // non-zero outer or inner distance based on how far its coverage deviates from 0.5
        let imgIdx = 3; // start at the alpha channel of the first pixel
        for (let y = 0; y < glyphHeight; y++) {
            let j = (y + buffer) * width + buffer;
            for (let x = 0; x < glyphWidth; x++, imgIdx += 4, j++) {
                const a = imgData.data[imgIdx]; // alpha value
                if (a === 0) continue; // empty pixels
                const t = alphaTable[a];
                gridOuter[j] = Math.max(0, t);
                gridInner[j] = Math.max(0, -t);
            }
        }

        edt(gridOuter, 0, 0, width, height, width, this.f, this.v, this.z);
        edt(gridInner, buffer, buffer, glyphWidth, glyphHeight, width, this.f, this.v, this.z);

        // encode signed distance as a byte: inside the glyph maps to high values, outside to low,
        // with the edge gradient spanning [-radius * cutoff, radius * (1 - cutoff)] pixels around the edge;
        // Uint8ClampedArray clamps beyond that
        const scale = 255 / this.radius;
        const base = 255 * (1 - this.cutoff);
        for (let i = 0; i < len; i++) {
            const d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
            data[i] = Math.round(base - scale * d);
        }

        return glyph;
    }
}

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(data, x0, y0, width, height, gridSize, f, v, z) {
    for (let x = x0; x < x0 + width; x++) edt1d(data, y0 * gridSize + x, gridSize, height, f, v, z);
    for (let y = y0; y < y0 + height; y++) edt1d(data, y * gridSize + x0, 1, width, f, v, z);
}

// 1D squared distance transform
function edt1d(grid, offset, stride, length, f, v, z) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    f[0] = grid[offset];

    for (let q = 1, k = 0, s = 0; q < length; q++) {
        f[q] = grid[offset + q * stride];
        const q2 = q * q;
        do {
            const r = v[k];
            s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
        } while (s <= z[k] && --k > -1);

        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }

    for (let q = 0, k = 0; q < length; q++) {
        while (z[k + 1] < q) k++;
        const r = v[k];
        const qr = q - r;
        grid[offset + q * stride] = f[r] + qr * qr;
    }
}

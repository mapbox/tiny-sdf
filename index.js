const INF = 1e20;

export default class TinySDF {
    constructor({
        fontSize = 24,
        buffer = 3,
        radius = 8,
        cutoff = 0.25,
        fontFamily = 'sans-serif',
        fontWeight = 'normal'
    }) {
        this.fontSize = fontSize;
        this.buffer = buffer;
        this.cutoff = cutoff;
        this.fontFamily = fontFamily;
        this.fontWeight = fontWeight;
        this.radius = radius;
        const size = this.size = this.fontSize + this.buffer * 2;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = size;

        this.ctx = this.canvas.getContext('2d');
        this.ctx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'black';

        // temporary arrays for the distance transform
        this.gridOuter = new Float64Array(size * size);
        this.gridInner = new Float64Array(size * size);
        this.f = new Float64Array(size);
        this.z = new Float64Array(size + 1);
        this.v = new Uint16Array(size);

        // hack around https://bugzilla.mozilla.org/show_bug.cgi?id=737852
        this.middle = Math.round((size / 2) * (navigator.userAgent.indexOf('Gecko/') >= 0 ? 1.2 : 1));
    }

    draw(char) {
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.ctx.fillText(char, this.buffer, this.middle);

        const imgData = this.ctx.getImageData(0, 0, this.size, this.size);
        const alphaChannel = new Uint8ClampedArray(this.size * this.size);

        for (let i = 0; i < this.size * this.size; i++) {
            const a = imgData.data[i * 4 + 3] / 255; // alpha value
            this.gridOuter[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
            this.gridInner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
        }

        edt(this.gridOuter, this.size, this.size, this.f, this.v, this.z);
        edt(this.gridInner, this.size, this.size, this.f, this.v, this.z);

        for (let i = 0; i < this.size * this.size; i++) {
            const d = Math.sqrt(this.gridOuter[i]) - Math.sqrt(this.gridInner[i]);
            alphaChannel[i] = Math.round(255 - 255 * (d / this.radius + this.cutoff));
        }

        return alphaChannel;
    }
}

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher
// https://cs.brown.edu/~pff/papers/dt-final.pdf
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

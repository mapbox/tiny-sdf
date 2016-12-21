'use strict';

module.exports = TinySDF;

var INF = 1e20;

function TinySDF(fontSize, buffer, radius, cutoff, fontFamily) {
    this.fontSize = fontSize || 24;
    this.buffer = buffer === undefined ? 3 : buffer;
    this.cutoff = cutoff || 0.25;
    this.fontFamily = fontFamily || 'sans-serif';
    this.radius = radius || 8;
    var size = this.size = this.fontSize + this.buffer * 2;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;

    this.ctx = this.canvas.getContext('2d');
    this.ctx.font = fontSize + 'px ' + this.fontFamily;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'black';

    // temporary arrays for the distance transform
    this.gridOuter = new Float64Array(size * size);
    this.gridInner = new Float64Array(size * size);
    this.f = new Float64Array(size);
    this.d = new Float64Array(size);
    this.z = new Float64Array(size + 1);
    this.v = new Int16Array(size);

    // hack around https://bugzilla.mozilla.org/show_bug.cgi?id=737852
    this.middle = Math.round((size / 2) * (navigator.userAgent.indexOf('Gecko/') >= 0 ? 1.2 : 1));
}

TinySDF.prototype.draw = function (char) {
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.fillText(char, this.buffer, this.middle);

    var imgData = this.ctx.getImageData(0, 0, this.size, this.size);
    var data = imgData.data;

    fillEdgeDistances(imgData.data, this.gridOuter, this.gridInner, this.size);

    edt(this.gridOuter, this.size, this.size, this.f, this.d, this.v, this.z);
    edt(this.gridInner, this.size, this.size, this.f, this.d, this.v, this.z);

    for (var i = 0; i < this.size * this.size; i++) {
        var d = this.gridOuter[i] - this.gridInner[i];
        var c = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / this.radius + this.cutoff))));
        data[4 * i + 0] = c;
        data[4 * i + 1] = c;
        data[4 * i + 2] = c;
        data[4 * i + 3] = 255;
    }

    return imgData;
};

var SQRT2 = Math.sqrt(2);

function fillEdgeDistances(img, gridOuter, gridInner, n) {
    for (var i = 0; i < n * n; i++) {
        var a = img[i * 4 + 3] / 255; // alpha value
        var d = 0.5 - a;
        if (a > 0 && a < 1) {
            var tr = img[(i - n + 1) * 4 + 3] / 255;
            var br = img[(i + n + 1) * 4 + 3] / 255;
            var tl = img[(i - n - 1) * 4 + 3] / 255;
            var bl = img[(i + n - 1) * 4 + 3] / 255;
            var l = img[(i - 1) * 4 + 3] / 255;
            var r = img[(i + 1) * 4 + 3] / 255;
            var t = img[(i - n) * 4 + 3] / 255;
            var b = img[(i + n) * 4 + 3] / 255;
            var gx = Math.abs(tr + SQRT2 * r + br - tl - SQRT2 * l - bl);
            var gy = Math.abs(bl + SQRT2 * b + br - tl - SQRT2 * t - tr);

            if (gx > 0 && gy > 0) {
                var glen = Math.sqrt(gx * gx + gy * gy);
                gx /= glen;
                gy /= glen;

                if (gx < gy) {
                    var temp = gx;
                    gx = gy;
                    gy = temp;
                }

                var a1 = 0.5 * gy / gx;
                if (a < a1) { // 0 <= a < a1
                    d = 0.5 * (gx + gy) - Math.sqrt(2.0 * gx * gy * a);
                } else if (a < (1.0 - a1)) { // a1 <= a <= 1-a1
                    d = (0.5 - a) * gx;
                } else { // 1-a1 < a <= 1
                    d = -0.5 * (gx + gy) + Math.sqrt(2.0 * gx * gy * (1.0 - a));
                }
            }
        }
        gridOuter[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, d), 2);
        gridInner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, -d), 2);
    }
}

// 2D Euclidean distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/dt/
function edt(data, width, height, f, d, v, z) {
    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            f[y] = data[y * width + x];
        }
        edt1d(f, d, v, z, height);
        for (y = 0; y < height; y++) {
            data[y * width + x] = d[y];
        }
    }
    for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
            f[x] = data[y * width + x];
        }
        edt1d(f, d, v, z, width);
        for (x = 0; x < width; x++) {
            data[y * width + x] = Math.sqrt(d[x]);
        }
    }
}

// 1D squared distance transform
function edt1d(f, d, v, z, n) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = +INF;

    for (var q = 1, k = 0; q < n; q++) {
        var s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
            k--;
            s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = +INF;
    }

    for (q = 0, k = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
}

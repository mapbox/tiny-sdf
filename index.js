'use strict';

module.exports = TinySDF;
module.exports.default = TinySDF;

var INF = 1e20;

function TinySDF(fontSize, buffer, radius, cutoff, fontFamily, fontWeight) {
    this.fontSize = fontSize || 24;
    this.buffer = buffer === undefined ? 3 : buffer;
    this.cutoff = cutoff || 0.25;
    this.fontFamily = fontFamily || 'sans-serif';
    this.fontWeight = fontWeight || 'normal';
    this.radius = radius || 8;

    // For backwards compatibility, we honor the implicit contract that the
    // size of the returned bitmap will be fontSize + buffer * 2
    var size = this.size = this.fontSize + this.buffer * 2;
    // Glyphs may be slightly larger than their fontSize. The canvas already
    // has buffer space, but create extra buffer space in the output grid for the
    // "halo" to extend into (if metric extraction is enabled)
    var gridSize = size + this.buffer * 2;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;

    this.ctx = this.canvas.getContext('2d');
    this.ctx.font = this.fontWeight + ' ' + this.fontSize + 'px ' + this.fontFamily;
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'left'; // Necessary so that RTL text doesn't have different alignment
    this.ctx.fillStyle = 'black';

    // temporary arrays for the distance transform
    this.gridOuter = new Float64Array(gridSize * gridSize);
    this.gridInner = new Float64Array(gridSize * gridSize);
    this.f = new Float64Array(gridSize);
    this.z = new Float64Array(gridSize + 1);
    this.v = new Uint16Array(gridSize);

    // hack around https://bugzilla.mozilla.org/show_bug.cgi?id=737852
    this.middle = Math.round((size / 2) * (navigator.userAgent.indexOf('Gecko/') >= 0 ? 1.2 : 1));
}

function prepareGrids(imgData, width, height, glyphWidth, glyphHeight, gridOuter, gridInner) {
    // Initialize grids outside the glyph range to alpha 0
    gridOuter.fill(INF, 0, width * height);
    gridInner.fill(0, 0, width * height);

    var offset = (width - glyphWidth) / 2; // This is zero if we're not extracting metrics

    for (var y = 0; y < glyphHeight; y++) {
        for (var x = 0; x < glyphWidth; x++) {
            var j = (y + offset) * width + x + offset;
            var a = imgData.data[4 * (y * glyphWidth + x) + 3] / 255; // alpha value
            if (a === 1) {
                gridOuter[j] = 0;
                gridInner[j] = INF;
            } else if (a === 0) {
                gridOuter[j] = INF;
                gridInner[j] = 0;
            } else {
                var b = Math.max(0, 0.5 - a);
                var c = Math.max(0, a - 0.5);
                gridOuter[j] = b * b;
                gridInner[j] = c * c;
            }
        }
    }
}

function extractAlpha(alphaChannel, width, height, gridOuter, gridInner, radius, cutoff) {
    for (var i = 0; i < width * height; i++) {
        var d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
        alphaChannel[i] = Math.round(255 - 255 * (d / radius + cutoff));
    }
}

TinySDF.prototype._draw = function (char, getMetrics) {
    var textMetrics = this.ctx.measureText(char);
    // Older browsers only expose the glyph width
    // This is enough for basic layout with all glyphs using the same fixed size
    var advance = textMetrics.width;

    var doubleBuffer = 2 * this.buffer;
    var width, glyphWidth, height, glyphHeight, top;

    var imgTop, imgLeft;
    // If the browser supports bounding box metrics, we can generate a smaller
    // SDF. This is a significant performance win.
    if (getMetrics && textMetrics.actualBoundingBoxLeft !== undefined) {
        // The integer/pixel part of the top alignment is encoded in metrics.top
        // The remainder is implicitly encoded in the rasterization
        top = Math.floor(textMetrics.actualBoundingBoxAscent) - this.middle;
        imgTop = Math.max(0, this.middle - Math.ceil(textMetrics.actualBoundingBoxAscent));
        imgLeft = this.buffer;

        // If the glyph overflows the canvas size, it will be clipped at the
        // bottom/right
        glyphWidth = Math.min(this.size,
            Math.ceil(textMetrics.actualBoundingBoxRight - textMetrics.actualBoundingBoxLeft));
        glyphHeight = Math.min(this.size - imgTop,
            Math.ceil(textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent));

        width = glyphWidth + doubleBuffer;
        height = glyphHeight + doubleBuffer;
    } else {
        width = glyphWidth = this.size;
        height = glyphHeight = this.size
        top = 0;
        imgTop = imgLeft = 0;
    }

    var imgData;
    if (glyphWidth && glyphHeight) {
        this.ctx.clearRect(imgLeft, imgTop, glyphWidth, glyphHeight);
        this.ctx.fillText(char, this.buffer, this.middle);
        imgData = this.ctx.getImageData(imgLeft, imgTop, glyphWidth, glyphHeight);
    }

    var alphaChannel = new Uint8ClampedArray(width * height);

    prepareGrids(imgData, width, height, glyphWidth, glyphHeight, this.gridOuter, this.gridInner);

    edt(this.gridOuter, width, height, this.f, this.v, this.z);
    edt(this.gridInner, width, height, this.f, this.v, this.z);

    extractAlpha(alphaChannel, width, height, this.gridOuter, this.gridInner, this.radius, this.cutoff);

    return {
        data: alphaChannel,
        metrics: {
            width: glyphWidth,
            height: glyphHeight,
            sdfWidth: width,
            sdfHeight: height,
            top: top,
            left: 0,
            advance: advance,
            fontAscent: textMetrics.fontBoundingBoxAscent
        }
    };
};

TinySDF.prototype.draw = function (char) {
    return this._draw(char, false).data;
};

TinySDF.prototype.drawWithMetrics = function (char) {
    return this._draw(char, true);
};

// 2D Euclidean squared distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/papers/dt-final.pdf
function edt(data, width, height, f, v, z) {
    for (var x = 0; x < width; x++) edt1d(data, x, width, height, f, v, z);
    for (var y = 0; y < height; y++) edt1d(data, y * width, 1, width, f, v, z);
}

// 1D squared distance transform
function edt1d(grid, offset, stride, length, f, v, z) {
    var q, k, s, r;
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

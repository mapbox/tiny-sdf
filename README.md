# TinySDF

TinySDF is a tiny and fast JavaScript library for generating SDF (signed distance field)
from system fonts on the browser using Canvas 2D and
[Felzenszwalb/Huttenlocher distance transform](https://cs.brown.edu/~pff/papers/dt-final.pdf).
This is very useful for [rendering text with WebGL](https://www.mapbox.com/blog/text-signed-distance-fields/).

This implementation is based directly on the algorithm published in the Felzenszwalb/Huttenlocher paper, and is not a port of the existing C++ implementation provided by the paper's authors.

Demo: http://mapbox.github.io/tiny-sdf/

## Usage

Create a TinySDF for drawing SDFs based on font parameters:

```js
var tinySdf = new TinySDF({
    fontSize: 24,             // Font size in pixels
    fontFamily: 'sans-serif', // CSS font-family
    fontWeight: 'normal',     // CSS font-weight
    buffer: 3,                // Whitespace buffer around a glyph in pixels
    radius: 8,                // How many pixels around the glyph shape to use for encoding distance
    cutoff: 0.25              // How much of the radius (relative) is used for the inside part of the glyph
});

var {data, metrics} = tinySdf.draw('泽');
```

`data` is a Uint8ClampedArray array of alpha values (0–255) for a `sdfWidth` x `sdfHeight` grid.

`metrics` is an object with the following properties:

- `top`: Maximum ascent of the glyph from alphabetic baseline.
- `left`: Currently hardwired to 0 (actual glyph differences are encoded in the rasterization).
- `width`: Width of the rasterized portion of the glyph.
- `height` Height of the rasterized portion of the glyph.
- `advance`: Layout advance.
- `sdfWidth`: Width of the returned bitmap, usually but not always `width + 2 * buffer`.
- `sdfHeight`: Height of the returned bitmap, usually but not always `height + 2 * buffer`.

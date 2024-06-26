# TinySDF [![Volodymyr Agafonkin's projects](https://img.shields.io/badge/simply-awesome-brightgreen.svg)](https://github.com/mourner/projects) [![Node](https://github.com/mapbox/tiny-sdf/actions/workflows/node.yml/badge.svg)](https://github.com/mapbox/tiny-sdf/actions/workflows/node.yml)

TinySDF is a tiny and fast JavaScript library for generating SDF (signed distance field)
from system fonts on the browser using Canvas 2D and
[Felzenszwalb/Huttenlocher distance transform](https://cs.brown.edu/~pff/papers/dt-final.pdf).
This is very useful for [rendering text with WebGL](https://www.mapbox.com/blog/text-signed-distance-fields/).

## [Demo](http://mapbox.github.io/tiny-sdf)

## Usage

Create a TinySDF for drawing glyph SDFs based on font parameters:

```js
const tinySdf = new TinySDF({
    fontSize: 24,             // Font size in pixels
    fontFamily: 'sans-serif', // CSS font-family
    fontWeight: 'normal',     // CSS font-weight
    fontStyle: 'normal',      // CSS font-style
    buffer: 3,                // Whitespace buffer around a glyph in pixels
    radius: 8,                // How many pixels around the glyph shape to use for encoding distance
    cutoff: 0.25              // How much of the radius (relative) is used for the inside part of the glyph
});

const glyph = tinySdf.draw('泽'); // draw a single character
```

Returns an object with the following properties:

- `data` is a `Uint8ClampedArray` array of alpha values (0–255) for a `width` x `height` grid.
- `width`: Width of the returned bitmap.
- `height`: Height of the returned bitmap.
- `glyphTop`: Maximum ascent of the glyph from alphabetic baseline.
- `glyphLeft`: Currently hardwired to 0 (actual glyph differences are encoded in the rasterization).
- `glyphWidth`: Width of the rasterized portion of the glyph.
- `glyphHeight` Height of the rasterized portion of the glyph.
- `glyphAdvance`: Layout advance.

TinySDF is provided as a ES module, so it's only supported on modern browsers, excluding IE.

```html
<script type="module">
import TinySDF from 'https://cdn.skypack.dev/@mapbox/tiny-sdf';
...
</script>
```

In Node, you can't use `require` — only `import` in ESM-capable versions (v12.15+):

```js
import TinySDF from '@mapbox/tiny-sdf';
```

## Development

```bash
npm test  # run tests
npm start # start server for the demo page
```

## License

This implementation is licensed under the [BSD 2-Clause license](https://opensource.org/licenses/BSD-2-Clause). It's based directly on the algorithm published in the Felzenszwalb/Huttenlocher paper, and is not a port of the existing C++ implementation provided by the paper's authors.

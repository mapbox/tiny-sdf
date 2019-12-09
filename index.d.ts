interface Options {
    /**
     * Font size in pixels
     */
    fontSize?: number;
    /**
     * Whitespace buffer around a glyph in pixels
     */
    buffer?: number;
    /**
     * How many pixels around the glyph shape to use for encoding distance
     */
    radius?: number;
    /**
     * How much of the radius (relative) is used for the inside part the glyph
     */
    cutoff?: number;
    /**
     * css font-family
     */
    fontFamily?: string;
    /**
     * css font-weight
     */
    fontWeight?: string;
}

export default class TinySDF {
    public size: number;
    public canvas: HTMLCanvasElement;
    /**
     * TinySDF is a tiny and fast JavaScript library for generating SDF (signed distance field)
     */
    constructor(options:Options);
    /**
     * reset selected options and re-calculate the generator constants
     */
    setOptions(options:Options): this;
    /**
     * returns a Uint8ClampedArray array of alpha values (0–255) for a size x size square grid
     */
    draw(char: string): Uint8ClampedArray;
}

export default class TinySDF {
    /**
     * TinySDF is a tiny and fast JavaScript library for generating SDF (signed distance field)
     */
    constructor({ fontSize, buffer, radius, cutoff, fontFamily, fontWeight }: {
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
    });
    draw(char: string): Uint8ClampedArray;
}

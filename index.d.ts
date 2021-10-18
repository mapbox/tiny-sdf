export declare type TinySDFOptions = {
    fontSize?: number;
    buffer?: number;
    radius?: number;
    cutoff?: number;
    fontFamily?: string;
    fontWeight?: string;
    fontStyle?: string;
};

export default class TinySDF {
    constructor(options: TinySDFOptions);
    draw(char: string): {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        glyphWidth: number;
        glyphHeight: number;
        glyphTop: number;
        glyphLeft: number;
        glyphAdvance: any;
    };
}

import { terser } from 'rollup-plugin-terser';
import resolve from 'rollup-plugin-node-resolve';
import buble from 'rollup-plugin-buble';

const output = (file, plugins) => ({
    input: 'index.js',
    output: {
        name: 'TinySDF',
        format: 'umd',
        indent: false,
        file
    },
    plugins
});

export default [
    output('tinysdf.js', [resolve(), buble()]),
    output('tinysdf.min.js', [resolve(), buble(), terser()])
];

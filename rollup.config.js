import typescript from 'rollup-plugin-typescript2';
import analyze from 'rollup-plugin-analyzer';

const plugins = [typescript(), analyze({ summaryOnly: true })];
const external = [];

export default [
    {
        input: './src/index.ts',
        output: {
            file: './lib/index.esm.js',
            format: 'esm',
        },
        plugins,
        external,
    },
    {
        input: './src/index.ts',
        output: {
            file: './lib/index.js',
            format: 'cjs',
        },
        plugins,
        external,
    },
];
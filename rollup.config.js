import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { dts } from 'rollup-plugin-dts';

export default [{
    input: 'src/index.js',
    output: [
        {
            file: 'dist/index.esm.js',
            format: 'esm',
            sourcemap: true,
        },
        {
            file: 'dist/index.cjs',
            format: 'cjs',
            sourcemap: true,
            exports: 'named',
        },
        {
            file: 'dist/index.umd.js',
            format: 'umd',
            name: 'AppDBClient', // Глобальная переменная в браузере
            sourcemap: true,
            exports: 'named',
        },
    ],
    plugins: [
        resolve(), // Позволяет импортировать модули из node_modules
        commonjs(), // Позволяет импортировать CommonJS модули (если зависимости старые)
    ],
    external: [] // внешние зависимости, которые не нужно бандлить 
}, {
    input: 'src/index.d.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
}];
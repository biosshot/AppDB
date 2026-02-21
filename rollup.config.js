import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
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
};
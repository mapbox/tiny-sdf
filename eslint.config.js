import config from 'eslint-config-mourner';
import html from 'eslint-plugin-html';

export default [
    ...config,
    {
        files: ['index.js', 'index.html', 'test/*.js'],
        plugins: {html}
    }
];

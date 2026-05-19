// From: https://code.visualstudio.com/api/working-with-extensions/bundling-extension#using-esbuild

const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function buildMain() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.main.ts', 'src/server.main.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outdir: 'dist/',
        external: ['vscode'],
        logLevel: 'warning',
        plugins: [
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin
        ]
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

async function buildBrowser() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.browser.ts', 'src/server.browser.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'browser',
        outdir: 'dist/',
        external: ['vscode'],
        logLevel: 'warning',
        plugins: [
            /* add to the end of plugins array */
            esbuildProblemMatcherPlugin
        ]
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

async function main() {
    await Promise.all([buildMain(), buildBrowser()]);
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd(result => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location == null) return;
                console.error(`        ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    }
};

main().catch(e => {
    console.error(e);
    process.exit(1);
});

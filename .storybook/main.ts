import { resolve } from 'node:path';
// webpack is CommonJS; Storybook loads this file as ESM, so only the default export is available.
import webpack from 'webpack';
import type { StorybookConfig } from '@storybook/nextjs';

// Storybook always runs from the project root, so process.cwd() is the one path anchor that behaves
// the same on Windows and on CI.
const mock = (name: string) => resolve(process.cwd(), '.storybook/mocks', name);

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes'],
  framework: { name: '@storybook/nextjs', options: {} },
  // The demo covers and the brand mark are served from /public, exactly as they are in the app.
  staticDirs: ['../public'],
  typescript: { reactDocgen: 'react-docgen-typescript' },
  webpackFinal(webpackConfig) {
    webpackConfig.resolve ??= {};
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      // A story must render in a browser with no request context and no database, so the two
      // server-side seams are swapped out: request-scoped translations, and the contact action.
      'next-intl/server': mock('next-intl-server.ts'),
      'server-only': mock('empty.ts'),
      '@': resolve(process.cwd(), 'src'),
    };
    // The contact form imports its action relatively, which resolve.alias cannot see; this matches
    // the resolved file instead.
    webpackConfig.plugins ??= [];
    webpackConfig.plugins.push(new webpack.NormalModuleReplacementPlugin(/[\\/]contact[\\/]actions(\.ts)?$/, mock('contact-actions.ts')));
    return webpackConfig;
  },
};

export default config;

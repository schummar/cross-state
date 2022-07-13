import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  // If entries is not provided, will be automatically inferred from package.json
  entries: [
    './src/index.ts',
    {
      input: './src/integrations/react/index.ts',
      name: 'react',
    },
    {
      input: './src/integrations/immer/index.ts',
      name: 'immer',
    },
    {
      input: './src/persist/index.ts',
      name: 'persist',
    },
  ],

  rollup: {
    emitCJS: true,
    cjsBridge: true,
  },

  // Change outDir, default is 'dist'
  //   outDir: 'build',

  // Generates .d.ts declaration file
  //   declaration: true,
});

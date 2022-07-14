import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    {
      input: 'src',
      builder: 'mkdist',
      format: 'esm',
      outDir: 'dist/es',
    },
    {
      input: 'src',
      builder: 'mkdist',
      format: 'cjs',
      outDir: 'dist/cjs',
    },
  ],

  declaration: true,
});

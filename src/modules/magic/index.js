import { validateGameModuleManifest } from '../../core/module-manifest.js';

export { validateMagicContent, magicContentContract } from './content.js';
export { resolveMagicTechnique } from './resolver.js';

const manifest = validateGameModuleManifest({
  name: 'magic',
  dataVersion: 1,
  actions: [],
});

export const magicModule = {
  manifest,
  actions: {},
};

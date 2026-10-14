#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { mainCli, check, RULES, SITE_OPTIONS, SITE_HELP } from '../src/index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mainCli({
  name: 'canonical-beacon', version: pkg.version, configKey: 'canonicalBeacon', rules: RULES,
  tagline: 'check canonical tags and hreflang clusters in your built static site',
  usage: 'Usage: canonical-beacon [site-dir] [options]',
  help: `${SITE_HELP}Checks
      --no-require-canonical   Do not report pages without rel=canonical
      --allow-cross-domain     Accept canonicals that point to another host
`,
  options: { ...SITE_OPTIONS, 'no-require-canonical': { type: 'boolean' }, 'allow-cross-domain': { type: 'boolean' } },
  run: async ({ dir, values: o, config, configFile }) => check(dir, { cli: o, requireCanonical: o['no-require-canonical'] ? false : undefined, allowCrossDomain: o['allow-cross-domain'] || undefined, toolVersion: pkg.version }, config, configFile),
});

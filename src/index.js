// canonical-beacon: canonical tag and hreflang cluster checks for built static sites. Louis Wright, MIT.
import { contentPages, runBeacon, finder, SITE_OPTIONS, SITE_HELP, siteOptions, robotsDirectives, isNoindex, canonicalOf, isRedirectStub, isErrorPage } from './site.js';
import { buildReport, UsageError } from './core.js';

export * from './core.js';
export { SITE_OPTIONS, SITE_HELP, siteOptions };

export const RULES = {
  'canonical-missing': { severity: 'medium', title: 'Page has no rel=canonical' },
  'canonical-multiple': { severity: 'high', title: 'Page declares more than one different canonical URL' },
  'canonical-invalid': { severity: 'high', title: 'Canonical href is empty, unparsable or not http(s)' },
  'canonical-relative': { severity: 'low', title: 'Canonical href is relative (absolute URLs are recommended)' },
  'canonical-in-body': { severity: 'high', title: 'rel=canonical is outside <head>, so search engines ignore it' },
  'canonical-other-host': { severity: 'medium', title: 'Canonical points to another host or protocol' },
  'canonical-target-missing': { severity: 'high', title: 'Canonical target has no page in the build' },
  'canonical-target-not-final': { severity: 'high', title: 'Canonical target is an error page or meta-refresh stub' },
  'canonical-target-noindex': { severity: 'high', title: 'Canonical target is noindex' },
  'canonical-chain': { severity: 'medium', title: 'Canonical target itself canonicalises somewhere else' },
  'canonical-noindex-conflict': { severity: 'medium', title: 'Page is noindex and also canonicalises to another URL (mixed signals)' },
  'canonical-has-query-or-fragment': { severity: 'low', title: 'Canonical URL contains a #fragment or tracking query parameters' },
  'canonical-og-url-mismatch': { severity: 'low', title: 'og:url differs from the canonical URL' },
  'canonical-header-mismatch': { severity: 'medium', title: 'Link: rel=canonical header disagrees with the HTML canonical' },
  'hreflang-invalid-code': { severity: 'high', title: 'hreflang value is not a valid language(-region) code or x-default' },
  'hreflang-duplicate-code': { severity: 'high', title: 'Same hreflang code points to different URLs' },
  'hreflang-no-self': { severity: 'medium', title: 'hreflang cluster does not include the page itself' },
  'hreflang-no-return': { severity: 'high', title: 'Alternate page does not link back (non-reciprocal hreflang)' },
  'hreflang-target-missing': { severity: 'high', title: 'hreflang alternate has no page in the build' },
  'hreflang-target-non-canonical': { severity: 'high', title: 'hreflang alternate is noindex or canonicalises elsewhere' },
  'hreflang-on-non-canonical': { severity: 'medium', title: 'Page with hreflang canonicalises elsewhere' },
  'hreflang-relative': { severity: 'medium', title: 'hreflang href is relative (must be fully-qualified)' },
  'hreflang-no-x-default': { severity: 'info', title: 'hreflang cluster has no x-default' },
  'hreflang-lang-mismatch': { severity: 'low', title: 'Page <html lang> does not match its own hreflang code' },
  'hreflang-in-body': { severity: 'high', title: 'hreflang link is outside <head>' },
};

const REGIONS_ODD = new Set(['uk', 'eu']);
/** Validate an hreflang value: ISO 639-1 language, optional script, optional ISO 3166-1 alpha-2 region (or 3-digit UN M.49), or x-default. */
export function validHreflang(v) {
  const s = String(v || '').trim();
  if (/^x-default$/i.test(s)) return { ok: true, xDefault: true };
  const m = /^([a-z]{2,3})(?:-([a-z]{4}))?(?:-([a-z]{2}|\d{3}))?$/i.exec(s);
  if (!m) return { ok: false, reason: `"${s}" is not language[-Script][-REGION]` };
  if (m[3] && REGIONS_ODD.has(m[3].toLowerCase())) return { ok: false, reason: `"${m[3]}" is not an ISO 3166-1 region (use ${m[3].toLowerCase() === 'uk' ? 'GB' : 'a country code'})` };
  if (!m[2] && !m[3] && m[1].length === 2 && /^(gb|us|uk)$/i.test(m[1])) return { ok: false, reason: `"${s}" is a region, not a language (e.g. en-${m[1].toUpperCase() === 'UK' ? 'GB' : m[1].toUpperCase()})` };
  return { ok: true, lang: m[1].toLowerCase(), region: m[3]?.toUpperCase() || null };
}
const TRACK = /^(utm_[a-z]+|gclid|fbclid|msclkid|mc_[a-z]+|ref|sessionid|sid)$/i;
const strip = (u) => u.href.replace(/#.*$/, '');

export function analyze(site, opts = {}, config = {}) {
  const { findings, add } = finder(RULES);
  const requireCanonical = opts.requireCanonical ?? config.requireCanonical ?? true;
  const pages = contentPages(site);
  const canon = new Map();
  const canonOf = (pg) => { if (!canon.has(pg)) canon.set(pg, canonicalOf(site, pg)); return canon.get(pg); };
  const urlOf = (pg) => new URL((site.origin || 'http://site.invalid') + (site.basePath || '') + pg.path);
  let withCanon = 0; let clusters = 0;
  for (const pg of pages) {
    const at = (l) => ({ file: pg.file, line: l?.line });
    const c = canonOf(pg); const self = urlOf(pg);
    const noindex = isNoindex(robotsDirectives(site, pg));
    const hrefs = [...new Set(c.tags.map((t) => String(t.href).trim()))];
    if (!c.tags.length && !c.header.length) { if (requireCanonical && !noindex) add('canonical-missing', pg.path, `${pg.path} has no rel=canonical`, `Add <link rel="canonical" href="${site.origin ? site.urlOf(pg) : 'https://example.com' + pg.path}"> to <head>.`, { file: pg.file }); }
    else {
      withCanon++;
      const resolved = new Set(c.tags.map((t) => site.resolve(pg, t.href)).filter(Boolean).map(strip));
      if (resolved.size > 1 || (hrefs.length > 1 && resolved.size === 0)) add('canonical-multiple', pg.path, `${pg.path} declares ${hrefs.length} canonicals: ${hrefs.join(', ')}`, 'Keep exactly one rel=canonical; search engines may ignore all of them otherwise.', at(c.tags[1]));
      for (const t of c.tags) if (!t.inHead) add('canonical-in-body', pg.path, `rel=canonical on line ${t.line} is outside <head>`, 'Move it into <head>.', at(t));
      const t0 = c.tags.find((t) => t.inHead) || c.tags[0];
      if (t0) {
        const h = String(t0.href).trim();
        if (!h || !c.url || !/^https?:$/.test(c.url.protocol)) { add('canonical-invalid', pg.path, `Canonical href "${h}" is not a valid http(s) URL`, 'Use the absolute URL of the preferred page.', at(t0)); continue; }
        if (!/^https?:\/\//i.test(h)) add('canonical-relative', pg.path, `Canonical "${h}" is relative`, `Use the absolute URL (${c.url.href}).`, at(t0));
      }
      if (c.header.length && t0 && c.url) { const hu = site.resolve(pg, c.header[0]); if (hu && strip(hu) !== strip(c.url)) add('canonical-header-mismatch', pg.path, `Link header canonical ${hu.href} differs from HTML canonical ${c.url.href}`, 'Make both point to the same URL, or remove one.', { file: pg.file }); }
      const cu = c.url;
      if (cu) {
        if (cu.hash || [...cu.searchParams.keys()].some((k) => TRACK.test(k))) add('canonical-has-query-or-fragment', pg.path, `Canonical ${cu.href} contains ${cu.hash ? 'a #fragment' : 'tracking parameters'}`, 'Canonicalise to the clean URL.', at(t0));
        const og = pg.doc.metaContent('og:url');
        if (og) { const ou = site.resolve(pg, og); if (ou && strip(ou).replace(/\/$/, '') !== strip(cu).replace(/\/$/, '')) add('canonical-og-url-mismatch', pg.path, `og:url ${ou.href} differs from canonical ${cu.href}`, 'Set og:url to the canonical URL.', { file: pg.file }); }
        if (site.origin && cu.origin !== site.origin) {
          let sameHost = false; try { sameHost = new URL(site.origin).hostname === cu.hostname; } catch { /* */ }
          if (!(config.allowCrossDomain ?? opts.allowCrossDomain)) add('canonical-other-host', pg.path, `${pg.path} canonicalises to ${cu.href}${sameHost ? ' (protocol differs)' : ' on another host'}`, sameHost ? `Use ${site.origin}.` : 'If this is a deliberate cross-domain canonical, set "allowCrossDomain": true or allowlist it.', at(t0));
        } else {
          const tp = site.find(cu);
          const isSelf = tp === pg || strip(cu) === strip(self);
          if (!tp && !isSelf) add('canonical-target-missing', pg.path, `Canonical ${cu.href} has no page in the build`, 'Point the canonical at a page that exists (check trailing slash and .html).', at(t0));
          else if (tp && !isSelf) {
            if (isErrorPage(tp) || isRedirectStub(tp)) add('canonical-target-not-final', pg.path, `Canonical ${cu.href} is ${isErrorPage(tp) ? 'an error page' : 'a meta-refresh stub'} (${tp.file})`, 'Canonicalise to the final destination page.', at(t0));
            else if (isNoindex(robotsDirectives(site, tp))) add('canonical-target-noindex', pg.path, `Canonical ${cu.href} is noindex`, 'Canonicalise to an indexable page, or remove noindex from the target.', at(t0));
            else { const tc = canonOf(tp).url; const tt = tc && site.find(tc); if (tc && tt !== tp && strip(tc) !== strip(cu)) add('canonical-chain', pg.path, `Canonical ${cu.href} itself canonicalises to ${tc.href}`, `Point ${pg.path} directly at ${tc.href}.`, at(t0)); }
            if (noindex) add('canonical-noindex-conflict', pg.path, `${pg.path} is noindex and canonicalises to ${cu.href}`, 'Use one signal: either canonical (to consolidate) or noindex (to drop).', at(t0));
          }
        }
      }
    }
    // hreflang
    const alts = pg.doc.links.filter((l) => l.rel.includes('alternate') && l.hreflang != null);
    if (!alts.length) continue;
    clusters++;
    const codes = new Map(); let hasSelf = false; let hasX = false; let selfCode = null;
    const cu = c.url; const nonCanon = cu && strip(cu) !== strip(self) && site.find(cu) !== pg;
    if (nonCanon) add('hreflang-on-non-canonical', pg.path, `${pg.path} has hreflang but canonicalises to ${cu.href}`, 'Put hreflang only on canonical pages, pointing at canonical URLs.', at(alts[0]));
    for (const a of alts) {
      if (!a.inHead) add('hreflang-in-body', pg.path, `hreflang="${a.hreflang}" link is outside <head>`, 'Move it into <head>.', at(a));
      const v = validHreflang(a.hreflang);
      if (!v.ok) { add('hreflang-invalid-code', pg.path, `hreflang ${v.reason}`, 'Use ISO 639-1 language with optional ISO 3166-1 region, e.g. en, en-GB, pt-BR, or x-default.', at(a)); continue; }
      if (v.xDefault) hasX = true;
      const key = String(a.hreflang).toLowerCase(); const u = site.resolve(pg, a.href);
      if (!u) { add('hreflang-target-missing', pg.path, `hreflang="${a.hreflang}" href "${a.href}" is invalid`, 'Use an absolute URL.', at(a)); continue; }
      if (!/^https?:\/\//i.test(String(a.href).trim())) add('hreflang-relative', pg.path, `hreflang="${a.hreflang}" href "${a.href}" is relative`, `Use the absolute URL (${u.href}).`, at(a));
      if (codes.has(key) && codes.get(key) !== strip(u)) add('hreflang-duplicate-code', pg.path, `hreflang="${a.hreflang}" points to both ${codes.get(key)} and ${strip(u)}`, 'Each code may map to one URL only.', at(a));
      codes.set(key, strip(u));
      const tp = site.origin && u.origin !== site.origin ? undefined : site.find(u);
      if (tp === pg || strip(u) === strip(self)) { hasSelf = true; if (!v.xDefault) selfCode = v; continue; }
      if (site.origin && u.origin !== site.origin) continue; // cross-domain alternates cannot be verified offline
      if (!tp) { add('hreflang-target-missing', pg.path, `hreflang="${a.hreflang}" ${u.href} has no page in the build`, 'Fix the URL or remove the alternate from every page in the cluster.', at(a)); continue; }
      const tc = canonOf(tp).url;
      if (isNoindex(robotsDirectives(site, tp)) || (tc && site.find(tc) !== tp && strip(tc) !== strip(u))) { add('hreflang-target-non-canonical', pg.path, `hreflang="${a.hreflang}" ${u.href} is ${isNoindex(robotsDirectives(site, tp)) ? 'noindex' : 'canonicalised to ' + tc.href}`, 'Point hreflang at the canonical, indexable version.', at(a)); continue; }
      const back = tp.doc.links.filter((l) => l.rel.includes('alternate') && l.hreflang != null).some((l) => { const bu = site.resolve(tp, l.href); return bu && (site.find(bu) === pg || strip(bu) === strip(self)); });
      if (!back) add('hreflang-no-return', pg.path, `${tp.path} (hreflang="${a.hreflang}") does not link back to ${pg.path}`, `Add <link rel="alternate" hreflang="…" href="${site.urlOf(pg)}"> to ${tp.file}.`, at(a));
    }
    if (!hasSelf && !nonCanon) add('hreflang-no-self', pg.path, `${pg.path} has hreflang alternates but none for itself`, 'Include a self-referencing hreflang link for the page’s own language.', at(alts[0]));
    if (!hasX && !(config.xDefaultOptional ?? false)) add('hreflang-no-x-default', pg.path, `${pg.path} hreflang cluster has no x-default`, 'Add hreflang="x-default" pointing at the language selector or default version.', at(alts[0]));
    if (selfCode && pg.doc.lang) { const l = validHreflang(pg.doc.lang); if (l.ok && l.lang !== selfCode.lang) add('hreflang-lang-mismatch', pg.path, `<html lang="${pg.doc.lang}"> but the page’s own hreflang is ${selfCode.lang}${selfCode.region ? '-' + selfCode.region : ''}`, 'Make the html lang attribute and hreflang agree.', { file: pg.file }); }
  }
  return { findings, info: { canonicals: withCanon, hreflangPages: clusters }, summary: `${pages.length} page(s); ${withCanon} with canonical, ${clusters} with hreflang${site.baseUrl ? ` at ${site.baseUrl}` : ''}` };
}

export function check(dir, opts = {}, config = {}, configFile) {
  const tool = { name: 'canonical-beacon', version: opts.toolVersion || '1.0.0', rules: RULES, emoji: '🔗', defaultFile: 'index.html' };
  return runBeacon(tool, dir, { ...opts, UsageError }, config, configFile, analyze, buildReport);
}

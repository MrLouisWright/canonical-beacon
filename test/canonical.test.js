import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { check, validHreflang, RULES } from '../src/index.js';

const fx = (n) => new URL(`./fixtures/${n}`, import.meta.url).pathname;
const rules = (r) => r.findings.map((f) => f.rule);
const site = (files) => { const d = mkdtempSync(join(tmpdir(), 'cb-')); for (const [p, c] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), c); } return d; };
const page = (head, body = '') => `<!doctype html><html lang="en"><head><title>t</title>${head}</head><body>${body}</body></html>`;
const H = 'https://example.com';

test('good fixture is clean at --fail-on low', () => { assert.deepEqual(check(fx('good')).findings, []); });
test('bad fixture reports every family of problem', () => {
  const r = rules(check(fx('bad')));
  for (const k of ['canonical-multiple', 'canonical-target-noindex', 'canonical-in-body', 'canonical-target-missing', 'canonical-target-not-final', 'canonical-chain', 'canonical-other-host', 'canonical-missing', 'canonical-relative', 'canonical-has-query-or-fragment', 'canonical-og-url-mismatch', 'hreflang-invalid-code', 'hreflang-no-return', 'hreflang-target-non-canonical', 'hreflang-target-missing', 'hreflang-relative', 'hreflang-no-self', 'hreflang-no-x-default']) assert.ok(r.includes(k), k);
});
test('every emitted rule is documented', () => { for (const f of check(fx('bad')).findings) assert.ok(RULES[f.rule] || f.rule.startsWith('allowlist-')); });
test('validHreflang', () => {
  for (const ok of ['en', 'en-GB', 'pt-br', 'zh-Hant-TW', 'es-419', 'x-default']) assert.ok(validHreflang(ok).ok, ok);
  for (const bad of ['en-UK', 'english', 'en_GB', 'uk', '', 'e']) assert.ok(!validHreflang(bad).ok, bad);
});
test('self-referencing canonical with trailing-slash variants is fine', () => {
  const d = site({ 'blog/index.html': page(`<link rel="canonical" href="${H}/blog/">`) });
  assert.deepEqual(rules(check(d)), []);
});
test('noindex page with cross-page canonical is a conflict', () => {
  const d = site({ 'a.html': page(`<meta name="robots" content="noindex"><link rel="canonical" href="${H}/b.html">`), 'b.html': page(`<link rel="canonical" href="${H}/b.html">`) });
  assert.ok(rules(check(d)).includes('canonical-noindex-conflict'));
});
test('noindex page without canonical is not reported missing; --no-require-canonical works', () => {
  const d = site({ 'a.html': page('<meta name="robots" content="noindex">'), 'b.html': page('') });
  assert.deepEqual(rules(check(d, { baseUrl: H })), ['canonical-missing']);
  assert.deepEqual(rules(check(d, { baseUrl: H, requireCanonical: false })), []);
});
test('Link header canonical from _headers is used and compared', () => {
  const d = site({ 'a.html': page(`<link rel="canonical" href="${H}/a.html">`), _headers: `/a.html\n  Link: <${H}/z.html>; rel="canonical"\n` });
  assert.ok(rules(check(d)).includes('canonical-header-mismatch'));
});
test('cross-domain canonical: reported unless allowed', () => {
  const d = site({ 'a.html': page(`<link rel="canonical" href="https://other.org/a">`) });
  assert.ok(rules(check(d, { baseUrl: H })).includes('canonical-other-host'));
  assert.ok(!rules(check(d, { baseUrl: H, allowCrossDomain: true })).includes('canonical-other-host'));
});
test('hreflang on non-canonical page, duplicate code, lang mismatch, in-body', () => {
  const alt = (l, u) => `<link rel="alternate" hreflang="${l}" href="${H}${u}">`;
  const d = site({
    'index.html': `<html lang="fr"><head><link rel="canonical" href="${H}/">${alt('en', '/')}${alt('en', '/x.html')}${alt('x-default', '/')}</head><body>${alt('de', '/de.html')}</body></html>`,
    'x.html': page(`<link rel="canonical" href="${H}/">${alt('en', '/')}`),
    'de.html': page(`<link rel="canonical" href="${H}/de.html">${alt('en', '/')}${alt('de', '/de.html')}${alt('x-default', '/')}`),
  });
  const r = rules(check(d));
  for (const k of ['hreflang-duplicate-code', 'hreflang-lang-mismatch', 'hreflang-in-body', 'hreflang-on-non-canonical']) assert.ok(r.includes(k), k);
});
test('allowlist with expiry suppresses findings', () => {
  const d = site({ 'a.html': page('') });
  const r = check(d, { baseUrl: H, now: new Date('2026-10-14') }, { allowlist: [{ rule: 'canonical-missing', subject: '/a.html', reason: 'legacy', expires: '2027-01-01' }] });
  assert.equal(r.findings.length, 0); assert.equal(r.suppressed.length, 1);
});
test('CLI exit codes and formats', () => {
  const bin = new URL('../bin/canonical-beacon.js', import.meta.url).pathname;
  const run = (...a) => spawnSync(process.execPath, [bin, ...a], { encoding: 'utf8' });
  assert.equal(run(fx('good'), '--fail-on', 'low').status, 0);
  assert.equal(run(fx('bad')).status, 1);
  assert.equal(run(fx('bad'), '--fail-on', 'none').status, 0);
  assert.equal(run('/nonexistent-dir-xyz').status, 2);
  assert.equal(run(fx('good'), '--bogus').status, 2);
  const s = JSON.parse(run(fx('bad'), '--format', 'sarif', '--fail-on', 'none').stdout); assert.equal(s.version, '2.1.0'); assert.ok(s.runs[0].results.length > 10);
  assert.match(run(fx('bad'), '--format', 'markdown', '--fail-on', 'none').stdout, /\| Severity \|/);
  assert.ok(JSON.parse(run(fx('bad'), '--format', 'json', '--fail-on', 'none').stdout).findings.length > 10);
});

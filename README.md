# canonical-beacon

> Check canonical tags and hreflang clusters in your built static site: one canonical per page, pointing at a real, indexable, final URL, and hreflang clusters that are valid, self-referencing and reciprocal.

Canonical and hreflang mistakes are silent. A template ships two canonicals, a page canonicalises to a URL that was renamed, a translated page points hreflang at an English page that never links back, or a region is written `en-UK`. Search engines then ignore the hints, index the wrong URL or show the wrong language. `canonical-beacon` reads the built HTML (plus `Link` headers from `_headers`/`vercel.json`) and checks every canonical and hreflang annotation against the other pages in the build. Each finding has the file, line, severity and a **concrete fix**.

CLI, library and GitHub Action. Node.js 18+, **zero runtime dependencies**. Works on any static build output (Astro, Next.js `output: 'export'`, Eleventy, Hugo, Jekyll, Docusaurus, VitePress, plain HTML) and runs offline: point it at the folder your build writes. By Louis Wright.

## Features

- **Canonical tags:** missing, more than one, empty or invalid, relative, outside `<head>`, tracking parameters or `#fragment`, `og:url` and `Link` header disagreements.
- **Canonical targets:** the target page must exist in the build, must not be a 404 page or meta-refresh stub, must not be `noindex`, and must not canonicalise somewhere else again (chains). Cross-host and http/https canonicals are flagged unless you allow cross-domain canonicals.
- **Mixed signals:** a `noindex` page that also canonicalises to another URL.
- **hreflang codes:** ISO 639-1 language with optional script and ISO 3166-1 / UN M.49 region (`en-GB`, `zh-Hant-TW`, `es-419`) or `x-default`; catches `en-UK`, `en_GB` and region-only codes.
- **hreflang clusters:** self-reference, return links (reciprocity), duplicate codes, relative hrefs, alternates that are missing, `noindex` or non-canonical, hreflang on non-canonical pages, `x-default` presence, and `<html lang>` agreeing with the page’s own code.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides, GitHub Action with job summary.

### Scope

canonical-beacon does not crawl the live site, follow HTTP redirects or check broken links; use redirect-sentinel and static-link-sentinel for those. Alternates on other domains are accepted but cannot be verified offline.

## Rules

| Rule | Default severity | What it means |
|---|---|---|
| `canonical-missing` | medium | Page has no rel=canonical |
| `canonical-multiple` | high | Page declares more than one different canonical URL |
| `canonical-invalid` | high | Canonical href is empty, unparsable or not http(s) |
| `canonical-relative` | low | Canonical href is relative (absolute URLs are recommended) |
| `canonical-in-body` | high | rel=canonical is outside <head>, so search engines ignore it |
| `canonical-other-host` | medium | Canonical points to another host or protocol |
| `canonical-target-missing` | high | Canonical target has no page in the build |
| `canonical-target-not-final` | high | Canonical target is an error page or meta-refresh stub |
| `canonical-target-noindex` | high | Canonical target is noindex |
| `canonical-chain` | medium | Canonical target itself canonicalises somewhere else |
| `canonical-noindex-conflict` | medium | Page is noindex and also canonicalises to another URL (mixed signals) |
| `canonical-has-query-or-fragment` | low | Canonical URL contains a #fragment or tracking query parameters |
| `canonical-og-url-mismatch` | low | og:url differs from the canonical URL |
| `canonical-header-mismatch` | medium | Link: rel=canonical header disagrees with the HTML canonical |
| `hreflang-invalid-code` | high | hreflang value is not a valid language(-region) code or x-default |
| `hreflang-duplicate-code` | high | Same hreflang code points to different URLs |
| `hreflang-no-self` | medium | hreflang cluster does not include the page itself |
| `hreflang-no-return` | high | Alternate page does not link back (non-reciprocal hreflang) |
| `hreflang-target-missing` | high | hreflang alternate has no page in the build |
| `hreflang-target-non-canonical` | high | hreflang alternate is noindex or canonicalises elsewhere |
| `hreflang-on-non-canonical` | medium | Page with hreflang canonicalises elsewhere |
| `hreflang-relative` | medium | hreflang href is relative (must be fully-qualified) |
| `hreflang-no-x-default` | info | hreflang cluster has no x-default |
| `hreflang-lang-mismatch` | low | Page <html lang> does not match its own hreflang code |
| `hreflang-in-body` | high | hreflang link is outside <head> |
| `allowlist-expired` | medium | An allowlist entry is past its `expires` date |
| `allowlist-unused` | info | An allowlist entry matched nothing |

## Install and run

```bash
npx canonical-beacon dist
npx canonical-beacon dist --base-url https://example.com --fail-on medium
npx canonical-beacon out --clean-urls --exclude "/drafts/**"
npx canonical-beacon public --allow-cross-domain --format sarif > canonical.sarif
```

Pages are mapped to URLs the way static hosts serve them: `index.html` → `/`, `blog/index.html` → `/blog/`, `about.html` → `/about.html` (or `/about` with `--clean-urls`). Pass `--base-url` with your public URL, or let it be inferred from canonical / `og:url` tags. Meta-refresh redirect stubs and `404.html` are skipped. `X-Robots-Tag` and `Link` headers are read from Netlify/Cloudflare `_headers` and `vercel.json`.

### Sample output

```text
canonical-beacon — https://example.com
11 page(s); 9 with canonical, 2 with hreflang at https://example.com

HIGH     a.html:1 /a.html declares 2 canonicals: https://example.com/a.html, https://example.com/b.html [canonical-multiple]
         ↳ fix: Keep exactly one rel=canonical; search engines may ignore all of them otherwise.
HIGH     c.html:1 Canonical https://example.com/d.html is noindex [canonical-target-noindex]
         ↳ fix: Canonicalise to an indexable page, or remove noindex from the target.
HIGH     e.html:1 /e.html declares 2 canonicals: https://example.com/gone.html, https://example.com/e.html [canonical-multiple]
         ↳ fix: Keep exactly one rel=canonical; search engines may ignore all of them otherwise.
HIGH     e.html:1 rel=canonical on line 1 is outside <head> [canonical-in-body]
         ↳ fix: Move it into <head>.
HIGH     e.html:1 Canonical https://example.com/gone.html has no page in the build [canonical-target-missing]
```

## Options

```text
canonical-beacon 1.0.0 — check canonical tags and hreflang clusters in your built static site

Usage: canonical-beacon [site-dir] [options]

Site
      --base-url <url>        Public URL of the site, e.g. https://example.com (default: inferred from canonical/og:url)
      --include <globs>       Only check these pages (file or URL path globs, comma-separated)
      --exclude <globs>       Skip these pages
      --clean-urls            Pages are served without .html (about.html -> /about)
Checks
      --no-require-canonical   Do not report pages without rel=canonical
      --allow-cross-domain     Accept canonicals that point to another host

Common
  -c, --config <file>     JSON config (default: .canonical-beacon.json or "canonicalBeacon" in package.json)
  -f, --format <fmt>      text (default) | json | sarif | markdown
      --json <file>       Also write a JSON report
      --sarif <file>      Also write SARIF 2.1.0
      --markdown <file>   Also write Markdown (e.g. for a job summary)
      --fail-on <sev>     critical | high | medium | low | info | none (default: high)
      --list-rules        Print rules and default severities
      --no-fixes          Hide fix suggestions in text output
      --no-color          Disable colours
  -v, --version / -h, --help

Exit codes: 0 = passed, 1 = findings at or above --fail-on, 2 = usage, config or read error.
```

## Configuration and allowlist

Options can live in `.canonical-beacon.json` (or a `"canonicalBeacon"` key in `package.json`, or `--config <file>`):

```json
{
  "failOn": "medium",
  "severity": {
    "canonical-missing": "low"
  },
  "allowlist": [
    {
      "rule": "canonical-missing",
      "subject": "/legacy/*",
      "reason": "Legacy pages are being migrated",
      "expires": "2027-03-31"
    }
  ],
  "requireCanonical": true,
  "allowCrossDomain": false,
  "xDefaultOptional": false
}
```

- **`severity`** changes a rule's severity, or turns it `"off"`.
- **`allowlist`** entries suppress matching findings. Each needs a `reason` and matches on any combination of `rule`, `file`, `subject` (globs with `*`) and `match` (a substring of the message). Add `expires` (`YYYY-MM-DD`) so the exception is time-boxed: once it lapses the finding comes back along with an `allowlist-expired` finding (medium). Entries that no longer match anything are reported as `allowlist-unused` (info).

Config can also set `baseUrl`, `include`, `exclude` and `cleanUrls`. The config file is looked up in the site directory first, then in the current directory, so `.canonical-beacon.json` can live at your repository root. Other keys: `requireCanonical` (default true), `allowCrossDomain` (default false) and `xDefaultOptional` (default false; set true to silence `hreflang-no-x-default`).

## Output and exit codes

- `--format text` (default), `json`, `sarif` (SARIF 2.1.0 for GitHub code scanning) or `markdown` (for job summaries and PR comments). `--json`, `--sarif` and `--markdown` write extra report files in the same run.
- `--fail-on <severity>` sets the threshold (`critical`, `high`, `medium`, `low`, `info`, `none`; default `high`).
- Exit codes: **0** passed, **1** findings at or above `--fail-on`, **2** usage, config or read error.

## GitHub Action

```yaml
permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload
jobs:
  canonical-beacon:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with: { persist-credentials: false }
      - run: npm ci && npm run build   # produce the static site first
      - uses: MrLouisWright/canonical-beacon@v1
        with:
          path: dist
          fail-on: high
          sarif: canonical-beacon.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with: { sarif_file: canonical-beacon.sarif }
```

| Input | Description | Default |
|---|---|---|
| `path` | Built site directory (e.g. dist, public, _site) | `.` |
| `base-url` | Public URL of the site, e.g. https://example.com | |
| `fail-on` | Failure threshold | `high` |
| `config` | Config file path | |
| `sarif` / `json` | Write SARIF / JSON report to this path | |
| `job-summary` | Add the Markdown report to the job summary | `true` |
| `args` | Extra CLI arguments | |

The action runs the bundled CLI with Node 20; it has no dependencies to install. Pin it to a commit SHA if your policy requires it.

## Library

```js
import { check, validHreflang } from "canonical-beacon";
const report = check("dist", { baseUrl: "https://example.com" });
console.log(report.counts, report.findings[0]);
validHreflang("en-UK"); // { ok: false, reason: ... }
```

Types are included.

## Requirements

Node.js 18 or newer. Zero runtime dependencies.

## Support

If this project is useful to you, you can support its development with a donation: [Buy me a coffee](https://donate.stripe.com/aFa00lek3cvX4Ds2Fk9EI0b). It helps keep these tools maintained, documented and free for everyone.

## Licence

MIT © Louis Wright ([Louis Wright](https://github.com/MrLouisWright))

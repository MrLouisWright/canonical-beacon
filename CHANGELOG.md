# Changelog

## 1.0.1 - 2026-10-20

- Docs: README badges, credit and support sections, links to the project site; homepage now points to the project site.
- No changes to the package code.

## 1.0.0 (2026-10-14)

First release, by Louis Wright.

- Canonical checks: missing, multiple, invalid, relative, outside `<head>`, tracking parameters/fragments, `og:url` and `Link` header mismatches.
- Canonical targets: must exist in the build, not be an error page or meta-refresh stub, not be `noindex`, and not chain to another canonical; cross-host/protocol canonicals flagged unless allowed.
- `noindex` + cross-page canonical conflict.
- hreflang: code validation (ISO 639-1 / ISO 3166-1 / UN M.49 / x-default), self-reference, reciprocal return links, duplicate codes, relative hrefs, missing/noindex/non-canonical alternates, hreflang on non-canonical pages, x-default and `<html lang>` agreement.
- Text/JSON/SARIF/Markdown output, `--fail-on`, exit codes 0/1/2, allowlist with expiry, severity overrides.
- Composite GitHub Action with job summary.

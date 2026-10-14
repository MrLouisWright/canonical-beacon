import type { Report, Rule } from './core.js';
export * from './core.js';
export interface CanonicalOptions {
  /** Public URL of the site, e.g. "https://example.com". Inferred from canonical/og:url when omitted. */
  baseUrl?: string; include?: string[]; exclude?: string[]; cleanUrls?: boolean;
  /** Report pages without rel=canonical (default true). */
  requireCanonical?: boolean;
  /** Accept canonicals that point to another host. */
  allowCrossDomain?: boolean;
  now?: Date; toolVersion?: string; [option: string]: unknown;
}
export declare const RULES: Record<string, Rule>;
export declare const SITE_OPTIONS: Record<string, { type: 'string' | 'boolean'; multiple?: boolean }>;
export declare const SITE_HELP: string;
export declare function check(dir: string, opts?: CanonicalOptions, config?: Record<string, unknown>, configFile?: string): Report;
export declare function analyze(site: unknown, opts?: CanonicalOptions, config?: Record<string, unknown>): { findings: Report['findings']; info: Record<string, unknown>; summary: string };
export declare function validHreflang(value: string): { ok: boolean; xDefault?: boolean; lang?: string; region?: string | null; reason?: string };

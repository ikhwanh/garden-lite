/**
 * The base path the SPA is served from, without a trailing slash.
 *
 * Comes from Vite's configured `base` (`/garden-lite/` in dev and on GitHub
 * Pages) so routes can be written as `${BASE}/timeline`. At the site root this
 * is `""`, making `${BASE}/` resolve to `/`.
 */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Strip the base prefix from a pathname, e.g. `/garden-lite/timeline` -> `/timeline`. */
export function toAppPath(pathname: string): string {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return rest || "/";
}

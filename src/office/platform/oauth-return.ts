// What an OAuth redirect brought back to the office page: an error (?error= / error_description, in the
// query or the hash) or a PKCE ?code= to exchange; and the same URL without those parameters.
const QUERY_KEYS = ['code', 'state', 'error', 'error_code', 'error_description'];
const isErrorParams = (p: URLSearchParams): boolean => p.has('error') || p.has('error_description');

const hashParams = (u: URL): URLSearchParams => new URLSearchParams(u.hash.replace(/^#/, ''));

export function oauthReturn(href: string): { readonly error: boolean; readonly code: boolean } {
  const u = new URL(href);
  return { error: isErrorParams(u.searchParams) || isErrorParams(hashParams(u)), code: u.searchParams.has('code') };
}

/** href without the OAuth query parameters, and without a hash that only carried an OAuth error */
export function cleanOAuthUrl(href: string): string {
  const u = new URL(href);
  for (const k of QUERY_KEYS) u.searchParams.delete(k);
  if (isErrorParams(hashParams(u))) u.hash = '';
  return u.toString();
}

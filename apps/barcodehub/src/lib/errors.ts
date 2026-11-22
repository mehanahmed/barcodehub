/** A message fit to show a user, from anything an API call or other code may throw. */
export function errMsg(e: unknown, fallback = 'Something went wrong') {
  const x = e as { userFacingMessage?: string; message?: string } | undefined;
  if (x?.userFacingMessage) return x.userFacingMessage;
  const msg = x?.message ?? '';
  // zitejs API callers throw "API call failed (<status>): <response body>"; show the server's own message instead.
  const body = /^API call failed \(\d+\): ([\s\S]*)$/.exec(msg)?.[1];
  if (body === undefined) return msg || fallback;
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.message ?? (typeof j?.error === 'string' ? j.error : undefined);
    if (typeof m === 'string' && m) return m;
  } catch {
    // not JSON (e.g. an HTML error page): never show it raw
  }
  return fallback;
}

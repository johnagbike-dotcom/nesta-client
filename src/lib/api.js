const API_BASE = (process.env.REACT_APP_API_BASE || 'http://localhost:4000/api').replace(/\/$/, "");

export async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPatch(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
} 

export function withRangeParams(path, range) {
  const u = new URL(API_BASE + (path.startsWith("/") ? path : `/${path}`));
  if (range?.from) u.searchParams.set("from", range.from);
  if (range?.to)   u.searchParams.set("to", range.to);
  return u.toString();
}

const KEY = 'nesta:user';

export function saveUserSession(user) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function getUserSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearUserSession() {
  localStorage.removeItem(KEY);
} 

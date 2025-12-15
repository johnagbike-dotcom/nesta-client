import { getAuth } from "firebase/auth";

export default async function adminFetch(url, options = {}) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error("Not authenticated");

  const token = await user.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

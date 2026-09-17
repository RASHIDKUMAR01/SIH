/**
 * SkyGuard AI Authentication Client Service.
 * Manages JWT tokens, session persistence, and auth headers.
 */
const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "skyguard_auth_token";
const USER_KEY = "skyguard_auth_user";
const REMEMBER_KEY = "skyguard_remember_me";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function getAuthUser() {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setStoredAuth(token, user, rememberMe = false) {
  if (typeof window === "undefined") return;
  // Clear both first
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
  if (rememberMe) {
    localStorage.setItem(REMEMBER_KEY, "true");
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function loginUser(username, password, rememberMe = false) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: username.trim(),
      password: password,
      remember_me: Boolean(rememberMe),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || "INVALID CREDENTIALS");
  }

  if (data?.token && data?.user) {
    setStoredAuth(data.token, data.user, rememberMe);
  }
  return data;
}

export async function verifySession() {
  const token = getAuthToken();
  if (!token) return { valid: false };

  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      clearStoredAuth();
      return { valid: false };
    }

    const data = await res.json();
    return { valid: true, user: data.user };
  } catch (err) {
    console.warn("Session verification network error:", err);
    // If backend is unreachable but token is locally stored, retain session optimistically
    const localUser = getAuthUser();
    return { valid: Boolean(localUser), user: localUser };
  }
}

export async function logoutUser() {
  const token = getAuthToken();
  try {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
    }
  } catch (err) {
    console.warn("Logout API call error:", err);
  } finally {
    clearStoredAuth();
  }
}

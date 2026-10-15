export function isSafeRedirectPath(p: string): boolean {
  if (!p.startsWith("/")) return false;
  if (
    p.startsWith("//") ||
    p.startsWith("/\\") ||
    p.startsWith("/%5C") ||
    p.startsWith("/%5c")
  )
    return false;
  if (p.includes("\\") || p.includes("%5C") || p.includes("%5c")) return false;
  if (p.includes("://")) return false;
  if (p.startsWith("/login") || p.startsWith("/companion")) return false;
  // Final origin check
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function redirectToLogin(currentPath?: string) {
  if (window.location.pathname === "/login") {
    return;
  }
  const path =
    currentPath ?? `${window.location.pathname}${window.location.search}`;
  let target = "/login";
  if (isSafeRedirectPath(path)) {
    target += `?redirect=${encodeURIComponent(path)}`;
  }
  window.location.assign(target);
}

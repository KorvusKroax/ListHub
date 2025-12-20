let authCallback: ((authenticated: boolean) => void) | null = null;

export function setAuthCallback(callback: (authenticated: boolean) => void) {
  authCallback = callback;
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Session lejárt vagy nincs auth
    if (authCallback) {
      authCallback(false);
    }
    // Redirect login-ra (kivéve ha már ott vagyunk)
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  return response;
}

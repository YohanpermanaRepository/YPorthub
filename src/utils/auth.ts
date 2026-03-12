export type AuthRole = 'admin' | 'demo' | string;

export type AuthTokenPayload = {
  id?: number | string;
  username?: string;
  role?: AuthRole;
  exp?: number;
  iat?: number;
};

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  );
}

export function decodeJwtPayload(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as AuthTokenPayload;
  } catch {
    return null;
  }
}


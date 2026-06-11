import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { ensureAdminUser, getUserByUsername, createSession, getSession, deleteSession } from './db';

const SESSION_COOKIE = 'session_token';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!username || !passwordHash) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD_HASH must be set');
  }
  ensureAdminUser(username, passwordHash);
}

export async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const user = getUserByUsername(username);
  if (!user) return { ok: false, error: 'Invalid credentials' };
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return { ok: false, error: 'Invalid credentials' };
  const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const expiresAt = Date.now() + SESSION_MS;
  createSession(user.id, token, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(expiresAt),
    path: '/',
  });
  return { ok: true };
}

export async function logout() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    deleteSession(token);
  }
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUserId(): Promise<number | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = getSession(token);
  if (!session) {
    (await cookies()).delete(SESSION_COOKIE);
    return null;
  }
  return session.user_id;
}

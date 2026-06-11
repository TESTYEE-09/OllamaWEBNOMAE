import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'app.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      model_id TEXT NOT NULL,
      thinking TEXT NOT NULL DEFAULT 'off',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      images_json TEXT,
      model_id TEXT,
      thinking TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);
  `);
}

export function ensureAdminUser(username: string, passwordHash: string) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!existing) {
    db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(username, passwordHash, Date.now());
  }
}

export function getUserByUsername(username: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as { id: number; username: string; password_hash: string } | undefined;
}

export function createSession(userId: number, token: string, expiresAt: number) {
  const db = getDb();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
}

export function getSession(token: string) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, Date.now()) as { token: string; user_id: number; expires_at: number } | undefined;
  if (!session) return null;
  return session;
}

export function deleteSession(token: string) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function createConversation(id: string, userId: number, title: string, modelId: string, thinking: string) {
  const db = getDb();
  const now = Date.now();
  db.prepare('INSERT INTO conversations (id, user_id, title, model_id, thinking, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, userId, title, modelId, thinking, now, now);
}

export function getConversations(userId: number) {
  const db = getDb();
  return db.prepare('SELECT id, title, model_id, thinking, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200').all(userId);
}

export function getConversation(id: string, userId: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(id, userId) as { id: string; user_id: number; title: string; model_id: string; thinking: string; created_at: number; updated_at: number } | undefined;
}

export function updateConversation(id: string, updates: { title?: string; model_id?: string; thinking?: string }) {
  const db = getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (updates.title) { sets.push('title = ?'); vals.push(updates.title); }
  if (updates.model_id) { sets.push('model_id = ?'); vals.push(updates.model_id); }
  if (updates.thinking) { sets.push('thinking = ?'); vals.push(updates.thinking); }
  sets.push('updated_at = ?'); vals.push(Date.now());
  vals.push(id);
  db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteConversation(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function createMessage(id: string, conversationId: string, role: string, content: string, extra: { images_json?: string; model_id?: string; thinking?: string }) {
  const db = getDb();
  db.prepare('INSERT INTO messages (id, conversation_id, role, content, images_json, model_id, thinking, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, conversationId, role, content, extra.images_json || null, extra.model_id || null, extra.thinking || null, Date.now());
}

export function getMessages(conversationId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId) as Array<{ id: string; conversation_id: string; role: string; content: string; images_json: string | null; model_id: string | null; thinking: string | null; created_at: number }>;
}

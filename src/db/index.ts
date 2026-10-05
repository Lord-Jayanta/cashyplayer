import type { SQLiteDatabase } from "expo-sqlite";

/** Stable key across sources: a Jamendo 12 must never collide with an iTunes 12. */
export type TrackKey = string;

export const trackKey = (source: string, sourceId: string | number): TrackKey =>
  `${source}:${sourceId}`;

/** Downloads live 7 days past the last play. Kept here, free of native imports,
 *  so the self-check can exercise it without an Expo runtime. */
export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
export const expiryFor = (from = Date.now()) => from + SEVEN_DAYS;
export const isExpired = (expiresAt: number, now = Date.now()) => expiresAt < now;

const SCHEMA_VERSION = 1;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");

  const { user_version: current } = (await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  ))!;

  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tracks (
        id           TEXT PRIMARY KEY,
        source       TEXT NOT NULL,
        title        TEXT NOT NULL,
        artist       TEXT NOT NULL,
        artwork_url  TEXT,
        stream_url   TEXT NOT NULL,
        download_url TEXT,
        license_url  TEXT,
        duration     INTEGER
      );

      CREATE TABLE IF NOT EXISTS downloads (
        track_id       TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
        local_uri      TEXT NOT NULL,
        bytes          INTEGER NOT NULL,
        downloaded_at  INTEGER NOT NULL,
        expires_at     INTEGER NOT NULL,
        last_played_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        position    INTEGER NOT NULL,
        added_at    INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id)
      );

      CREATE INDEX IF NOT EXISTS idx_pt_playlist ON playlist_tracks(playlist_id, position);
      CREATE INDEX IF NOT EXISTS idx_dl_expiry ON downloads(expires_at);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  await seedFavorites(db);
}

/** Favorites is a playlist row, not a table: one add/remove/reorder path. */
async function seedFavorites(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM playlists WHERE is_default = 1"
  );
  if (existing?.n) return;

  await db.runAsync(
    "INSERT INTO playlists (id, name, is_default, created_at) VALUES (?, ?, 1, ?)",
    "favorites",
    "Favorites",
    Date.now()
  );
}
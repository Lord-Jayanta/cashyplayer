# CashyPlayer — Architecture

Expo SDK 57 / React Native 0.86 / Expo Router 57.

## 1. Decisions

| Area | Choice | Why |
|---|---|---|
| Nav | JS tabs + custom `tabBar` | Pill shape is not expressible with native tabs |
| Audio | `expo-audio` | Only first-party option; lock screen + background for free |
| Files | `expo-file-system` (new `File`/`Directory` API) | Ships with the SDK |
| DB | `expo-sqlite` + `SQLiteProvider` | One module, offline-first, no extra dep |
| Search results | Separate route | Home stays logo + one input |
| Downloads | 7-day expiry, extended on play | As specced |
| Sources | Adapter interface | Swap without touching UI |

## 2. Why not YouTube as the audio source

The product was specced around YouTube. That is not buildable as a shippable app, so it is recorded here rather than silently dropped.

**Terms.** YouTube API Developer Policies §III.G.1 forbids API Clients from downloading, caching or storing YouTube audiovisual content, from making it available for offline playback, and from separating the audio component. All three are the product.

**The API cannot do it regardless.** The Data API returns metadata only, never audio stream URLs. Also: default quota is 10,000 units/day and `search.list` costs 100, so ~100 searches/day before approval is required.

**The named libraries do not rescue it.**

- `youtubei.js` supports Node.js, Deno and browsers. Hermes is neither. More fundamentally, YouTube audio-only streams are **WebM/Opus** — ExoPlayer decodes that, **AVFoundation has no WebM/Opus decoder**, so `expo-audio` cannot play one on iOS. Resolving a URL is the easy half; pulling the bytes depends on signature/PoToken values Google rotates, which is why the project breaks repeatedly.
- `yt-dlp` is a Python CLI with no React Native binding. Hosting it makes you the operator of a download service (DMCA/seizure exposure on a known schedule); bundling Python + yt-dlp is hundreds of MB and store-fatal.

**Cost inversion.** Jamendo is free: a client id, 35,000 requests/month, no approval. YouTube costs an API key application, a quota audit, and the specific use required is the prohibited one.

**Conclusion.** YouTube is not the audio source. The source layer is an interface (§6) so this remains a reversible decision, not an architectural commitment.

## 3. Sources

No source requires an API key or a signup. `npx expo start` works on a fresh clone with no `.env` — there is nothing to configure.

| Source | Key | Serves | Downloads |
|---|---|---|---|
| Audius | No | Full MP3 | Yes |
| iTunes | No | 30s preview | No |
| Jamendo | Yes (optional) | Full MP3 | Yes |

### Primary — Audius

Community-run music network. Chosen because it needs **no API key and no signup** — only an `app_name` query param — while serving **complete audio files**, not previews. That combination is what makes the download + 7-day expiry path work without any setup.

```
GET https://discoveryprovider.audius.co/v1/tracks/search
  ?query=<query>
  &app_name=cashyplayer
```

| Field | Use |
|---|---|
| `id` | Stable track key |
| `title` | Title |
| `user.name` | Artist |
| `artwork["480x480"]` | Cover art |
| `duration` | Seconds |
| `license` | Per-track terms when the creator sets one |

Audio, and the download source:

```
GET https://discoveryprovider.audius.co/v1/tracks/<id>/stream?app_name=cashyplayer
```

Returns a 302 to CDN storage. Verified serving a full **320 kbps stereo MP3** (~20 MB for a 509s track) with no auth. The same URL both streams and downloads, so the download path needs no separate endpoint.

Licence note: Audius is creator-uploaded and the `license` field is often absent. That is weaker provenance than a Creative Commons URL, so persist the field when present and treat a missing one as unknown rather than permissive.

`is_downloadable: false` appears on some tracks while the stream endpoint still serves the file. The field was therefore not used as a gate — the endpoint is the source of truth.

### Secondary — Jamendo (optional, needs a key)

Not wired into the registry. Retained as `jamendoSearch()` because it ships a per-track `license_ccurl`, the cleanest licence position of any source here — worth enabling if a client id is ever obtained, since it returns tracks Audius lacks.

Two gates are required for a download: `audiodownload_allowed === true` **and** a non-empty `audiodownload`. The API returns an empty string for the latter when the artist disallows it.

ponytail: unreachable without `EXPO_PUBLIC_JAMENDO_CLIENT_ID`. Delete the file and its import rather than shipping a source that always throws.

### Tertiary — iTunes Search (metadata only)

```js
await fetch(`https://itunes.apple.com/search?term=${q}&media=music&limit=25`)
```

Also keyless. Gives mainstream artist and real artwork, but only a 30s `previewUrl` — **no download**, so `downloadable` is always false. Included so users can locate chart releases and open them externally. Its `trackId` seeds deep links.

## 4. Layering

```
src/app/                     routes only — Expo Router
  _layout.tsx                providers + player host
  (tabs)/
    _layout.tsx              JS Tabs + custom tabBar + MiniPlayer
    index.tsx                home: logo + search bar, nothing else
    search.tsx               results list
    library.tsx              playlists incl. Favorites
    settings.tsx
src/features/
  player/                    context, queue, playback actions
  library/                   playlists, favorites
  downloads/                 fetch, expiry sweep
src/sources/                 the swap point
  types.ts                   TrackSource interface
  jamendo.ts
  itunes.ts
  index.ts                   registry
src/db/                      schema, migrations, queries
src/ui/                      design tokens + shared components
```

`src/app/` holds screens and nothing else. Business logic lives in `src/features/` so it is testable and reusable across routes. `src/sources/` is the only place that knows which catalogue is in use.

## 5. Data model

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE tracks (
  id            TEXT PRIMARY KEY,   -- '<source>:<sourceTrackId>'
  source        TEXT NOT NULL,      -- 'jamendo' | 'itunes'
  title         TEXT NOT NULL,
  artist        TEXT NOT NULL,
  artwork_url   TEXT,
  stream_url    TEXT NOT NULL,
  download_url  TEXT,
  license_url   TEXT,
  duration      INTEGER
);

-- Local state, kept separate so catalogue refreshes never clobber it
CREATE TABLE downloads (
  track_id      TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  local_uri     TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  downloaded_at INTEGER NOT NULL,   -- epoch ms
  expires_at    INTEGER NOT NULL,   -- epoch ms
  last_played_at INTEGER
);

CREATE TABLE playlists (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX idx_pt_playlist ON playlist_tracks(playlist_id, position);
CREATE INDEX idx_dl_expiry   ON downloads(expires_at);
```

Favorites is a `playlists` row with `is_default = 1`, seeded on first launch. Not a separate table — one code path for add/remove/reorder.

Migrations follow the documented `PRAGMA user_version` pattern, using the `db.sql` tagged-template API so parameters are escaped by construction.

## 6. Source adapter

```ts
export type Track = {
  id: string;
  source: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  streamUrl: string;
  downloadUrl?: string;
  licenseUrl?: string;
  duration?: number;
  downloadable: boolean;
};

export interface TrackSource {
  readonly name: string;
  search(query: string): Promise<Track[]>;
  resolve(rawUrl: string): Promise<Track | null>;   // for pasted links
  webUrl(track: Track): string;                     // "open externally"
}
```

`resolve` covers the pasted-YouTube-URL flow: detect the URL, pull the id, return whatever the source can legally provide. When YouTube is passed it returns a non-downloadable track whose `webUrl` opens the app — search still works, no audio is extracted.

`src/sources/index.ts` picks active sources and merges results. Adding a source is one file plus one registry line; no screen, component or query changes.

## 7. Downloads and expiry

```
play(track)
  → local file exists?  play local
  → else stream_url     play remote, download in parallel
       → on complete: INSERT downloads (expires_at = now + 7d)
  → UPDATE downloads.last_played_at = now, expires_at = now + 7d
```

Expiry sweep runs on app foreground:

```sql
DELETE FROM tracks WHERE id IN (
  SELECT track_id FROM downloads WHERE expires_at < ?
);
```

Cascade removes the `downloads` and `playlist_tracks` rows. Files are then deleted from disk by `File(Paths.document, 'tracks', id).delete()` guarded on `exists`.

Deliberate omissions:

- **No `expo-background-task`.** Foreground sweep is sufficient until the catalogue is large enough that a week's expiry notices matter. Add when downloads pass a few thousand.
- **No download queue.** One in-flight download at a time, keyed by track id; a second request for the same track joins it.
- **Download state is not persisted mid-flight.** A download interrupted by app death restarts. `DownloadTask.savable()` exists for resume but adds a resume-state table; not worth it yet.

## 8. Player

`createAudioPlayer` held in a `PlayerProvider` above the navigator, not `useAudioPlayer` — the player must outlive any screen unmount. `release()` on provider teardown.

```ts
await setAudioModeAsync({
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',   // required for lock screen controls
});
```

`interruptionMode: 'doNotMix'` is mandatory, not cosmetic: without it the OS may not associate the player with lock screen controls. On Android, `setActiveForLockScreen(true, {...})` is also required or playback stops after ~3 minutes in background (OS limit).

Requires a **development build** — `expo-audio`'s background playback is configured by its config plugin, so Expo Go cannot do it.

## 9. Navigation

Custom `tabBar` in JS Tabs. Floating pill, `expo-glass-effect` for blur, Reanimated for the active-indicator spring.

The mini player renders inside the custom `tabBar`, above the pill — so there is one floating element rather than a player that needs its own absolute positioning against a system bar.

Tab transitions animate per-screen via Reanimated on focus. Screens stay mounted (preserving scroll and input state); heavy content gates on `useIsFocused` or a load-once flag.

Home is deliberately near-empty: logo + one `TextInput`. Submitting navigates to `/search?q=...`.

## 10. Dependencies

Install:

```
expo-audio  expo-file-system  expo-sqlite
```

Already present and used: `expo-router`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `expo-image`, `expo-glass-effect`, `expo-web-browser`, `expo-haptics`.

Not installed: any downloader, HTTP cache, ORM, state manager, or icon library. SQLite tagged templates cover query safety; `useSQLiteContext` plus context covers state; SF Symbols and Material cover icons.

## 11. Build phases

1. Scaffolding — install deps, tokens, `PlayerProvider`, `SQLiteProvider`, custom tab bar with two empty tabs.
2. Database — schema, migrations, seed Favorites.
3. Sources — interface, Jamendo, search route rendering real results.
4. Playback — player context, mini player, lock screen.
5. Library — playlists, favorites, settings.
6. Downloads — fetch to disk, expiry sweep, local-first playback.

## 12. Open risks

| Risk | Impact | Response |
|---|---|---|
| Audius is creator-uploaded with sparse `license` | Weaker provenance than CC | Persist the field when present; absent ≠ permissive |
| Audius stream URL is a 302 to CDN | Signature expiry if cached | Re-resolve per play; don't persist the CDN URL |
| Audius has no mainstream chart catalogue | Users can't find what they know | iTunes metadata + external deep links; licensed API if traction justifies |
| Opus/WebM iOS gap | Blocks any future YouTube source | `expo-audio` plays MP3/AAC; Audius serves MP3 |
| Audius is small and community-run | Availability risk | Two independent sources; Jamendo as an opt-in third |
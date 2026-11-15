# ORS multi-app API contract

The one backend (horacio) serves three client apps plus the web:

| app id  | client                         | bundle / package            | URL scheme  |
|---------|--------------------------------|-----------------------------|-------------|
| `ors`   | alfa (RN) + murray (web)       | co.openroadsociety.app      | openroadsociety:// |
| `photo` | photo (RN) — "ORS Photo"       | co.openroadsociety.photo    | orsphoto:// |
| `spot`  | spot (RN) — "Car Spotter"      | co.openroadsociety.spot     | orsspot://  |

Conventions (match horacio): CommonJS, Express routers, `protect` / `optionalAuth` /
`adminOnly` middleware, `internal_id = helpers.rand()`, images through
`images.processGallery(req.files?.gallery, process.env.AWS_BUCKET_IMAGES, res)` which
returns `[{ filename, internal_id, index }]`, lists return `{ entries, total }`, single
reads `{ entry }`, writes are POST. Users are referenced by the `user_id` string.
Public user projection everywhere below ("UserLite"):
`{ user_id, username, firstName, lastName, gallery, profilePicture, avatarColor, accountType }`.

---

## 1. Accounts — which apps a member has joined

**User model**: add `accounts: { type: [String], default: undefined }`.
Values: `'ors' | 'photo' | 'spot'`. A missing/empty field means `['ors']` (every
pre-existing user). A migration script backfills `accounts: ['ors']` on users lacking it.

**App identification**: every request from the new apps sends header `x-ors-app: photo|spot`.
Auth calls also send `app` in the body. Absent → `'ors'` (alfa + murray send nothing).
A tiny middleware (`middleware/orsApp.js`) sets `req.orsApp` (whitelisted, default `'ors'`),
mounted globally after `express.json()`.

**Tagging**: `login`, `google-auth`, `apple-auth` `$addToSet` `accounts: req.orsApp`
on success (for legacy users with no field: set `['ors', app]` — they were ORS
members already). `register-mobile` / `register` create the user with
`accounts: [req.orsApp]` — so a photo-app signup is `['photo']` only. Google/Apple
*creation* likewise `[req.orsApp]`. Responses (login, google, apple, loggedInUser)
include `accounts` (normalized: missing → `['ors']`).

**Scoping member lists**: `helpers/orsAccounts.js` exports
`accountFilter(app)` →
`app === 'ors' ? { $or: [{ accounts: 'ors' }, { accounts: { $exists: false } }, { accounts: { $size: 0 } }] } : { accounts: app }`.
Apply it (with `req.orsApp`) to every *member-listing / member-search / suggestion /
featured-members* query in horacio (user search, members directory, suggested
members, mention search, featured users, group invite search, etc.). Do NOT apply it
to single-user lookups by id/username (links must still resolve) or to auth.

`POST /api/users/accounts/join` (protect) body `{ app }` → adds `app` to accounts,
returns `{ accounts }`. Used when a photo/spot-only member chooses to share to ORS
(which makes them an ORS member).

---

## 2. Shared-to-ORS posts (alfa + murray feed)

Post model gains:
- `source_app: String` — `'photo' | 'spot'` (absent for native ORS posts)
- `source_id: String` — photo gallery internal_id, or car-spot play internal_id
- `carspot: Object` (only for `type: 'spot_result'`), shape below.

Both are ordinary Posts (`entry_type: 'post'`, `user_objectid` set) so they flow
through `/api/post` and `/api/feed`, following filters, likes and comments unchanged.
Sharing requires the member to have `'ors'` in accounts: if they don't, the endpoint
returns 409 `{ error, code: 'NOT_ORS_MEMBER' }` and the client offers
`/api/users/accounts/join` first.

Clients (alfa FeedItemCard + PostDetail, murray Feed/Item): when `source_app` is set,
show a small chip with the app's icon — "Shared from ORS Photo" / "Shared from Car
Spotter" — that deep-links: `orsphoto://gallery/<source_id>` or `orsspot://play`
(fallback: store listing / website if the app isn't installed).

---

## 3. Car Spotter (`/api/carspot`, app id `spot`)

### Models
**CarSpotEntry** (admin-authored puzzle):
```
internal_id, image (S3 filename), make, model, year?: String, hint?: String,
position: Number (queue order, ascending), focus_x: Number 0..1 (default .5),
focus_y: Number 0..1 (default .5), zoom: Number (initial zoom factor, default 3.5, 1.5–8),
play_date: String 'YYYY-MM-DD' | null (stamped when it becomes a day's puzzle),
puzzle_number: Number | null (1,2,3… stamped with play_date),
created_by, created_at, updated_at, deleted: Boolean
```
**CarSpotPlay** (one member's game on one day):
```
internal_id, user_id, user_objectid, entry_id, play_date, puzzle_number,
guesses: [{ make, model, make_correct: Boolean, model_correct: Boolean, at: Date }],
make_solved: Boolean, model_solved: Boolean,
status: 'playing' | 'won' | 'lost', attempts: Number, finished_at,
shared_post_id: String | null, created_at
unique index { user_id, play_date }
```

### Scheduling — "in order, once per day"
Day key is `YYYY-MM-DD` in `process.env.CARSPOT_TZ || 'America/Los_Angeles'`.
Today's puzzle: the entry with `play_date === today`; if none, atomically claim the
lowest-`position` entry with `play_date: null, deleted: false` (findOneAndUpdate,
sort `{position:1, created_at:1}`) and stamp `play_date = today`,
`puzzle_number = (max puzzle_number) + 1`. Race-safe: after claiming, if another
entry already has today's date, release ours (set back to null) and use theirs.
If the queue is empty → no puzzle today.

### Endpoints (protect unless noted)
- `GET /api/carspot/today` →
  `{ puzzle: PuzzlePublic | null, play: PlayPublic | null, next_at: ISO (next day boundary) }`
  - `PuzzlePublic = { internal_id, puzzle_number, play_date, image, focus_x, focus_y, zoom, hint? }`
    — never make/model.
  - `PlayPublic = { internal_id, status, attempts, max_attempts: 5, guesses, make_solved, model_solved, shared_post_id, answer?: { make, model, year } }`
    — `answer` present only when status !== 'playing'.
- `POST /api/carspot/guess` body `{ make, model }` → `{ play: PlayPublic }`.
  Compares case/space-insensitively against the entry. Once make is solved, later
  guesses keep make correct (client locks the make field). 400 if already finished
  or 5 attempts used. Won when make & model both correct; lost at 5 attempts.
  Creates the play on first guess.
- `GET /api/carspot/history?page=&limit=` →
  `{ entries: [PlayPublic + { image, focus_x, focus_y, zoom, answer }], total, stats }` (finished plays only, newest first)
  `stats = { played, won, win_rate (0-100), current_streak, max_streak, distribution: {1..5: n}, average_attempts }`
  Streak = consecutive puzzle days won (by play_date).
- `POST /api/carspot/share` body `{ play_id }` → `{ post }` — creates Post
  `type:'spot_result', source_app:'spot', source_id: play.internal_id,
  title: 'Car Spotter #<n>', body: '<won? "Got it in X/5" : "Stumped X/5"> ' + emoji grid lines (🟩/🟥 make, 🟩/🟥 model per guess),
  carspot: { puzzle_number, play_date, attempts, won, grid: [[bool,bool]...], image, focus_x, focus_y, zoom }`.
  No answer in the post (no spoilers). Only finished plays; idempotent (returns existing `shared_post_id` post). 409 NOT_ORS_MEMBER as in §2.
- `GET /api/carspot/leaderboard/today` (optionalAuth) → `{ entries: [{ user: UserLite, attempts, won }], total }` — members scoped by `accountFilter('spot')`, winners sorted by attempts then finish time. (Nice-to-have.)

Admin (protect + adminOnly):
- `GET /api/carspot/admin/entries` → `{ entries: CarSpotEntry[] (all fields incl. answer, sorted: played desc first? no — upcoming by position asc, then played by play_date desc), total, today: entry_id|null, stats: { upcoming, played } }`
  Each entry also has `plays` / `wins` counts for played entries.
- `POST /api/carspot/admin/create` (multipart: `gallery` single image, `make`, `model`, `year?`, `hint?`, `focus_x?`, `focus_y?`, `zoom?`) → `{ entry }` — appended at end (`position = max+1`).
- `POST /api/carspot/admin/update` (multipart, `internal_id`, same fields; image optional) → `{ entry }`. Changing make/model of an already-played entry is allowed but warns nothing.
- `POST /api/carspot/admin/delete` `{ internal_id }` → soft delete; refuses (400) for an entry that is today's or already played.
- `POST /api/carspot/admin/reorder` `{ order: [internal_id...] }` → rewrites `position` for unplayed entries.

---

## 4. ORS Photo (`/api/photo`, app id `photo`)

### Models
**PhotoGallery**:
```
internal_id, user_id, user_objectid, title (required), body?,
gallery: [{ filename, internal_id, index }] (1–10, required),
make?, model?, year?,
camera_id?, lens_id?  (PhotoGear internal_ids)
camera?: { brand, model, name }  lens?: { brand, model, name }   (snapshots at save)
settings?: { focal_length?, aperture?, shutter?, iso? }  (strings)
location?: String, place_id?, lat?: Number, lng?: Number,
photospot_id?: String (link to an alfa/photo PhotoSpot),
score: Number (up - down, default 0), upvotes: Number, downvotes: Number,
shared_post_id?: String, deleted: Boolean, created_at, updated_at
indexes { user_id, created_at }, { score, created_at }, { created_at }
```
**PhotoVote**: `{ gallery_id, user_id, value: 1 | -1, created_at }` unique `{gallery_id, user_id}`.
**PhotoFollow**: `{ follower_id, following_id, created_at }` (user_id strings) unique pair. Separate from ORS `Follow`.
**PhotoGear**: `{ internal_id, user_id, kind: 'camera'|'lens', brand, model, name? (nickname), notes?, created_at, deleted }`.

Gallery responses ("GalleryPublic") = the doc + `user: UserLite` + `my_vote: 1|-1|0`.

### Endpoints
- `GET /api/photo/galleries?sort=new|top|following&user_id=&make=&page=&limit=` (optionalAuth; `following` requires auth) → `{ entries: GalleryPublic[], total }`. `top` = score desc then newest; optional `window=week|month|all` for top. Exclude authors not in `accountFilter('photo')`? No — galleries only exist from photo members; skip.
- `GET /api/photo/galleries/:id` (optionalAuth) → `{ entry: GalleryPublic }`
- `POST /api/photo/galleries/create` (protect, multipart `gallery` files + fields; `settings` as JSON string) → `{ entry }`
- `POST /api/photo/galleries/update` (protect, owner; multipart; `internal_id`; `existing_gallery` JSON array of filenames to keep in order; new files appended) → `{ entry }`
- `POST /api/photo/galleries/delete` `{ internal_id }` (owner or admin) → `{ success }`
- `POST /api/photo/galleries/vote` `{ internal_id, value: 1 | -1 | 0 }` (0 = clear) → `{ score, upvotes, downvotes, my_vote }`. Can't vote own gallery (400).
- `POST /api/photo/galleries/share-ors` `{ internal_id }` (owner) → `{ post }` — creates Post `type:'general', title, body, gallery (same filenames), make, model, year, source_app:'photo', source_id`. Idempotent via `shared_post_id`. 409 NOT_ORS_MEMBER as in §2.
- `GET /api/photo/users/:userId` (optionalAuth; accepts user_id or username) → `{ user: UserLite + { bio, cityState, created_at }, stats: { galleries, followers, following, score }, is_following, gear: PhotoGear[] }`. 404 if the user doesn't have `'photo'` in accounts.
- `GET /api/photo/users/:userId/followers?page=&limit=` / `/following` → `{ entries: (UserLite + { is_following })[], total }`
- `POST /api/photo/follow` `{ user_id }` / `POST /api/photo/unfollow` `{ user_id }` → `{ is_following, followers }`
- `GET /api/photo/members?q=&page=&limit=` (optionalAuth) → `{ entries: (UserLite + { galleries })[], total }` — `accountFilter('photo')`.
- Gear: `GET /api/photo/gear` (protect, mine) → `{ entries }`; `POST /api/photo/gear/create` `{ kind, brand, model, name?, notes? }` → `{ entry }`; `POST /api/photo/gear/update` `{ internal_id, ... }`; `POST /api/photo/gear/delete` `{ internal_id }`.

Photography map in the photo app reuses `/api/photospot/*` unchanged (shared pins with alfa).

---

## 5. Notifications, push, follows & suggestions (phase 2)

### 5.1 Shared posts don't count toward the monthly post limit
`helpers/limits.js`: `postsThisMonth`, `postUsage`, `checkPostAllowance` pass
`extra = { source_app: { $in: [null, ''] } }` (null also matches a missing field).

### 5.2 Notifications know their app
- `Notification.app: String` (`'ors' | 'photo' | 'spot'`; missing = `'ors'`), indexed with recipient.
- `createNotification({..., app })`: if `app` is omitted it is inferred from
  `content_type` via `APP_FOR_CONTENT = { photo_gallery: 'photo', carspot_play: 'spot' }`,
  else `'ors'`. So the generic comment/like/mention code needs no changes: a comment on a
  `photo_gallery` becomes a photo-app notification automatically.
- `push_title` default = that app's name (`Open Road Society`, `ORS Photo`, `Car Spotter`).
- Push `data` always also carries `app` and `type`.
- `GET /api/notifications`, `/unread-count`, `PATCH /read-all`, `/archive-all`, `DELETE /delete-all`
  filter by `req.orsApp` (ors → `app` missing or `'ors'`). Single-id routes unchanged.
- New Notification `type` enum values: `vote`, `spot_solved`.
  `notificationPrefs`: `PREFERENCE_FOR.vote = 'like'`; new row
  `{ key: 'spot_solved', label: 'Friends solving the daily car', group: <people you follow group>, push: true, email: false }`.
  Each registry row gets `apps` (default `['ors','photo','spot']` for the generic ones —
  comment, like, follow, mention, system; ORS-only for car/group/marketplace/etc.;
  `['spot']` for `spot_solved`). `GET /api/users/settings/notification-types` returns only
  rows whose `apps` include `req.orsApp`.

### 5.3 Push tokens know their app
- `User.app_devices: [{ token, app, platform, updated_at }]` (max 5 per app).
- `POST /api/users/device-token` `{ token, platform }`: `req.orsApp === 'ors'` → the legacy
  `devices` array exactly as today (alfa unchanged); otherwise upsert into `app_devices`
  under that app (and remove the token from `devices` if present).
- `sendPushToUser(userId, title, body, data, app = 'ors')`: `'ors'` → `devices`;
  otherwise `app_devices.filter(d => d.app === app)`. `createNotification` passes its app.
- `POST /api/users/device-token/remove` `{ token }` (protect) — removes from both; apps call
  it on sign-out.

### 5.4 One follow model for the per-app graphs
- Replace `PhotoFollow` with **`AppFollow`** `{ app, follower_id, following_id, created_at }`,
  unique `{ app, follower_id, following_id }`, index `{ app, following_id, created_at: -1 }`.
  (Unshipped — no migration needed.) `helpers/appFollow.js`: `follow(app, a, b)` →
  `{ created: bool }`, `unfollow`, `isFollowing`, `followedSet(app, viewer, ids)`,
  `counts(app, userId)`, `list(app, userId, 'followers'|'following', page, limit, viewerId)`.
- A new follow notifies: `type: 'follow', app, content_type: 'user', content_id: follower.user_id`,
  message `"<username> started following you"`.
- Photo endpoints (§4) keep their paths, backed by AppFollow('photo').
- **Car Spotter gets the same social graph**, backed by AppFollow('spot'):
  - `POST /api/carspot/follow` / `unfollow` `{ user_id }` → `{ is_following, followers }`
    (404 unless target has `'spot'`).
  - `GET /api/carspot/users/:userId` (user_id or username) →
    `{ user: UserLite + { bio, cityState, created_at }, stats (same shape as history stats),
       follow: { followers, following }, is_following,
       recent: [finished plays, newest first, max 10: { internal_id, puzzle_number, play_date,
                 status, attempts, grid, answer? }] }`
    — `answer` only for puzzle days before today (no spoilers), and the viewer's own.
  - `GET /api/carspot/users/:userId/followers|following?page=&limit=` → `{ entries: (UserLite + { is_following })[], total }`
  - `GET /api/carspot/members?q=&page=&limit=` → `{ entries: (UserLite + { is_following, played, won })[], total }` (accountFilter('spot')).
  - `GET /api/carspot/friends/today` (protect) → `{ entries: [{ user: UserLite, status, attempts, grid }], total }`
    — people I follow who have played today (no answer, no guesses' text).

### 5.5 Nearby suggestions (why the zip is required)
`GET /api/photo/suggestions?limit=` and `GET /api/carspot/suggestions?limit=` (protect) →
`{ entries: (UserLite + { cityState, distance_miles?, is_following: false })[], near: bool }`.
Members of that app, not me, not already followed, not banned/ghost, nearest first using my
`location_lat/lng` and `helpers/memberLocation` (100 mi; if fewer than `limit`, widen to 500 mi;
then fill with the newest members of the app, `near:false` for those). If I have no location,
newest members only. Default limit 12, max 30.

### 5.6 Notification triggers
| app   | event | type | recipient | content_type / content_id |
|-------|-------|------|-----------|---------------------------|
| photo | first upvote on a gallery by a user (dedupe like likes) | `vote` | owner | `photo_gallery` / gallery id |
| photo | comment / reply / @mention on a gallery (generic comment system) | `comment` / `mention` | owner / parent author / mentioned | `photo_gallery` / gallery id |
| photo | new follow | `follow` | followed | `user` / follower id |
| spot  | someone I follow wins today's puzzle | `spot_solved` | each spot follower of the winner | `carspot_play` / play id, `metadata: { username, attempts, puzzle_number }`, message `"<username> spotted today's car in 3/5"` (never the answer) |
| spot  | new follow | `follow` | followed | `user` / follower id |

`helpers/contentRef.js` `CONTENT` gains `photo_gallery: { model: PhotoGallery, label: 'photo' }`
so comments/likes on galleries resolve an owner. Gallery responses gain `comment_count`.
Comments on galleries use the existing `/api/comment` endpoints with
`document_type: 'photo_gallery'`.

# Ionagrams build contract (v1)

Every module is written against this file. If a module needs something not listed here, add it to its own file and note it in its report; don't change another module's API.

Game summary: Bananagrams with ions. 2–5 players per room. Each player gets their own hand of ion tiles, groups them into compounds, **locks** each compound by entering its total + and total − charge (and naming it, if the room's naming mode is on), and races to use every tile. Nothing is checked during the build. When a player calls **Done**, everyone freezes, the room checks that player's compounds for 25 s and flags any they think are wrong, then the game reveals the verdict. All correct = that player wins. Any wrong = that player is out ("rotten") and everyone else resumes. Every player then sees a personal review of their own compounds, and earns ⚛ for every correct locked compound.

Students: grades 10–12. Half read below grade level, a quarter are English learners. Interface text: short, literal, plain English (English only for v1).

## Files

```
Ion-games/                      (repo; served at https://gibsonm1.github.io/Ion-games/)
  shared/ions.js                ion data -> window.IONS / require()   (DONE; do not edit)
  ionagrams/
    index.html                  markup + CSS + CONFIG block + loads the scripts below
    rules.js                    window.IonRules / require()  pure logic, no DOM
    music.js                    window.IonSound              Web Audio music + sound effects
    ui.js                       the game (screens, input, networking glue)
  tests/
    rules.test.js               node tests for rules.js
    ...
theme/                          (repo; served at https://gibsonm1.github.io/theme/)
  login-v1.js                   shared login (exists; do not edit)
  rooms-v1.js                   window.GibsonRooms   Firebase room layer, reusable by later games
  database.rules.json           Firebase Realtime Database security rules (Mr. G pastes into the console)
  tests/fakebase/               local fake of the Firebase compat SDK subset + a Node server, for testing
```

`index.html` loads, in order: `https://gibsonm1.github.io/theme/login-v1.js`, `https://gibsonm1.github.io/theme/rooms-v1.js`, `../shared/ions.js`, `rules.js`, `music.js`, `ui.js`. Plain scripts, no modules, no build step. Must run when served from any origin (tests serve from localhost and route gibsonm1.github.io).

## Ion data (shared/ions.js)

`IONS.BY_KEY[k]` -> `{k, s, c, n?, ide?, poly?, tm?}`. Keys: `Na`, `NH4`, `Fe2`, `Fe3`, `SO4`, ...
- Cation name = `n` (e.g. `iron(III)`, `ammonium`). Anion name = `ide` (e.g. `sulfate`, `oxide`).
- A compound's correct name = cation `n` + ' ' + anion `ide` (`iron(III) sulfate`).
- Display symbol: digits in `s` are subscripts (`SO₄`). Charge text: `2+`, `3−` (use the real minus sign U+2212), `+` and `−` for 1.

A **tile** is `{id, k}`; `id` is unique within one player's hand (`h0`..`h11` for dealt tiles, `d0a`/`d0b`, `d1a`... for draws).

## rules.js -> `IonRules` (pure, deterministic, works in Node and browser)

```js
IonRules.PTS = { compound:10, perIon:2, win:40, flagRight:15, flagWrong:-10, extraScale:0.5 }
IonRules.rng(seedString) -> () => float in [0,1)          // mulberry32 over a string hash
IonRules.shuffle(arr, rand) -> arr                          // Fisher–Yates in place
IonRules.ion(k) -> IONS.BY_KEY[k]

// sets = { mono:true, poly:true, poly2:false, tm:false }  (which ions can be dealt; poly = the 6 basic polyatomic ions,
//   poly2 = also the advanced ones: HCO3, C2H3O2, ClO3, CN, CrO4, SCN, SO3, NO2)
IonRules.targets(sets) -> [{cat, an, a, b, size, diff}]   // every valid lowest-ratio compound with size=a+b <= 5,
                                                           // excluding NH4 + OH; diff = difficulty score (see below)
IonRules.deal({ seed, uid, sets, size, missed }) -> { tiles:[{id,k}], targets:[...], diff }
   // seed: room round seed (string). uid: player id. size: tile count (12 normal, 10 for Extra time).
   // missed: { ionKey: count } from this student's history; compounds containing missed ions are more likely.
   // Every player's hand in the same round has about the same total difficulty: build many candidate hands from
   // rng(seed+uid) and keep the one closest to IonRules.targetDiff(seed, sets, size) (same for everyone in the room).
   // Tiles are shuffled. Exactly `size` tiles.
IonRules.targetDiff(seed, sets, size) -> number
IonRules.drawAt({ seed, uid, sets }, dumpIndex) -> [tile, tile]
   // the player's private draw pile: a deterministic stream of whole target compounds (ions shuffled within each
   // compound), dealt 2 at a time. dumpIndex 0 -> stream tiles 0,1; 1 -> 2,3; ... ids 'd{dumpIndex}a','d{dumpIndex}b'.

// a group is what a player builds: { ions:[k,...], pos:number|null, neg:number|null, name:string|null }
//   pos = total positive charge the student entered; neg = total negative charge as a POSITIVE number (6 means −6)
IonRules.formulaText(ions) -> 'Al₂(SO₄)₃'     // as built, NOT reduced; cations first; one part per distinct ion
IonRules.formulaHTML(ions) -> same with <sub>, cation part in <span class="m">, anion part in <span class="x">
IonRules.totals(ions) -> { pos, neg }          // true totals (neg positive number)
IonRules.correctName(ions) -> string | null     // null unless exactly one cation kind and one anion kind
IonRules.nameChoices(ions, rand) -> [4 strings] // correct + 3 believable wrong names, shuffled (Fisher–Yates).
   // wrong-name sources: anion look-alikes (IONS.NAME_TRAPS), element name instead of -ide ("calcium chlorine"),
   // prefixes ("calcium dichloride"), missing Roman numeral on a tm metal ("iron sulfate"), wrong Roman numeral,
   // unneeded Roman numeral on a one-charge metal ("calcium(II) chloride"), CAT_TRAPS. Never a duplicate.
IonRules.nameTiles(ions, rand) -> [strings]     // word tiles for "Build the name": the correct words
   // (e.g. 'iron','(III)','sulfate') plus 3–4 decoys (e.g. '(II)','sulfite','sulfide','iron'), shuffled.
IonRules.joinName(words) -> string              // 'iron' + '(III)' + 'sulfate' -> 'iron(III) sulfate'
IonRules.sameName(a, b) -> bool                 // case/space-insensitive, accepts IONS alt spellings

IonRules.checkGroup(group, { naming }) -> { ok, errors:[code], why:[sentence], truth:{pos,neg,formula,name} }
   // naming: 'off' | 'pick' | 'build'
   // error codes, checked in this order (report all that apply):
   //  'one-side'  only cations or only anions     why: "A compound needs a positive ion and a negative ion."
   //  'mixed'     2+ different cation kinds or 2+ different anion kinds
   //              why: "Use one kind of positive ion and one kind of negative ion. This has Na⁺ and Ca²⁺."
   //  'charge'    totals don't cancel            why: "Ca²⁺ + N³⁻: +2 − 3 = −1, not 0."  (show the real sums:
   //              "3 × (+2) = +6 and 1 × (−3) = −3. +6 − 3 = +3, not 0.")
   //  'ratio'     balanced but not lowest ratio  why: "Ca₂O₂ can be simplified to CaO. Use the smallest ratio."
   //  'pos'       entered + total wrong          why: "Total + charge is +6, not +4."
   //  'neg'       entered − total wrong          why: "Total − charge is −6, not −3."
   //  'name'      (naming != 'off', and only when there is no one-side/mixed error) wrong or missing name
   //              why: "The name is iron(III) sulfate."
   //  A group with pos or neg null is never valid ('pos'/'neg').
IonRules.checkBoard(groups, { naming }) -> { ok, results:[checkGroup result] }   // ok only if every group ok
IonRules.scoreRound({ results, won, flagsRight, flagsWrong, extra })
   -> { total, lines:[{label, pts}] }
   // per correct group: compound + perIon*ions.length; won: +win; flags; extra: total *= extraScale (rounded);
   // total never below 0. labels: "3 correct compounds", "Won the round", "Caught 1 mistake", "1 wrong flag", "Extra time ×½"
IonRules.missedKeys(results, groups) -> [ionKey]  // ion keys in groups that were wrong (for the missed tally)
```

Difficulty (diff) of one compound: 1 + 1 if polyatomic in it + 1 if tm cation + 0.5 × (size − 2) + 0.5 if either charge is 3 or 4. Hand diff = sum.

Deal must never produce a hand without at least one full valid grouping (it's built from targets, so it always has one).

## rooms-v1.js -> `GibsonRooms` (theme repo; generic, not Ionagrams-specific)

Uses the Firebase **compat** SDK v10.12.2, loaded on demand from
`https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-database-compat.js`.
Anonymous sign-in (the uid persists per browser). CONFIG block at the top holds the firebaseConfig:

```js
apiKey: "AIzaSyCnhjG5gfVSAx2-dmcnCd8ZAEjYdeWsPLk", authDomain: "gibson-chem-games.firebaseapp.com",
databaseURL: "https://gibson-chem-games-default-rtdb.firebaseio.com", projectId: "gibson-chem-games",
storageBucket: "gibson-chem-games.firebasestorage.app", messagingSenderId: "1008525772732",
appId: "1:1008525772732:web:186022bda28322e3e5cdb9"
```

```js
GibsonRooms.on() -> bool                         // false in the Claude preview (same test as login-v1.js) or if no config
GibsonRooms.ready() -> Promise<{uid}>            // load SDK + sign in; rejects {error:'offline'} on failure (8 s timeout)
GibsonRooms.serverNow() -> ms                    // Date.now() + .info/serverTimeOffset
GibsonRooms.connected() -> bool ; event 'gibson-rooms' on window with detail {connected}
GibsonRooms.watchLobby(game, period, cb) -> unsubscribe
   // cb([{id, name, state, count, max, players:[{name,buddy,hat}], settings, created}]) sorted newest first.
   // Also removes (best effort) rooms with 0 players that are older than 2 minutes.
GibsonRooms.create(game, period, { name, max, settings, countdownMs }) -> Promise<roomId>
GibsonRooms.join(game, period, roomId, me) -> Promise<Room>
   // me = { name, buddy, hat, ...anything small }. Rejects {error:'full'|'started'|'gone'}.
   // Joining is allowed in 'lobby'/'countdown', or in 'play' if this uid is in meta.roster (rejoin after reload).
GibsonRooms.watchSettings(game, period, cb) / setSettings(game, period, obj)   // per-period teacher settings
```

Paths: `rooms/{game}/{period}/{roomId}` = `{ meta, players, data }`; teacher settings at `settings/{game}/{period}`.
`period`: string matching `/^[A-Za-z0-9]{1,12}$/` (guests use `guest`). `roomId`: Firebase push key.

```
meta:    { name, max, created, countdownMs, settings:{...game's}, state:'lobby'|'countdown'|'play',
           countdownEnd, startAt, seed, round, roster:{uid:true} }
players/{uid}: { name, buddy, hat, joined, ready, ...me }      // removed by onDisconnect
data/...       game-owned; the room layer only clears it on reset()
```

`Room` object:
```js
room.id, room.uid, room.snap              // snap = latest {meta, players, data} (players/data may be {})
room.isHost() -> bool                     // host = present player with the smallest `joined` (tie: uid). Everyone
                                          // computes the same answer, so the host hands off automatically.
room.onChange(cb) -> unsubscribe          // cb(snap) on every change (also called once right away)
room.setMe(fields) -> Promise             // update players/{uid}
room.ready(bool) -> Promise
room.set(path, v), room.update(path, obj), room.remove(path) -> Promise      // path is relative to data/
room.txn(path, fn) -> Promise<{committed, value}>                           // Firebase transaction under data/
room.leave() -> Promise                   // remove me; if I was the last player, remove the room
room.reset() -> Promise                   // host only: state 'lobby', clear data, everyone not ready (play again)
```

Lobby automation, run by the host's browser (every 500 ms and on change):
- `lobby` and players ≥ 2 -> `countdown` with `countdownEnd = serverNow + countdownMs` (default 15000).
- `countdown` and players < 2 -> back to `lobby`.
- `countdown` and (every player ready, or serverNow ≥ countdownEnd) -> `play` with `startAt = serverNow + 3000`,
  `seed` = random string, `round` + 1, `roster` = current players.
- In `play` the room layer does nothing more; the game drives `data/`.

## Ionagrams room data (`data/`), written by ui.js

```
data/progress/{uid}: { left, groups, locked }            // tiles not in locked groups; shown to opponents
data/boards/{uid}:   { groups:[{ions,pos,neg,name}], at } // published right before calling Done
data/done:           { uid, n, at, endsAt }               // set by transaction only when empty: first caller wins
data/flags/{n}/{uid}: { "0":true, "3":true }              // indices of the caller's groups this player flags
data/verdict/{n}:    { uid, ok }                          // host writes at endsAt (everyone can compute it too)
data/out/{uid}:      true                                 // rotten
data/over:           { at, winner: uid|null, why:'win'|'time'|'allout' }
data/results/{uid}:  { name, pts, correct, locked, won }
```
Room `meta.settings` for Ionagrams: `{ naming:'off'|'pick'|'build', sets:{mono,poly,tm}, shapes:false, size:12 }`.
Teacher settings `settings/ionagrams/{period}`: `{ minNaming:'off'|'pick'|'build', sets:{mono,poly,tm}, shapes:false }`.

Round flow (times from CONFIG in index.html):
1. `play` + serverNow ≥ startAt: each client deals its own hand with `IonRules.deal({seed: meta.seed, uid, sets, size, missed})`.
2. Build. Tap a tile to select it, then tap a group, "New compound", the tray, or the Swap bin. Drag works too.
3. Lock a group: dialog with + total and − total steppers (scaffold toggle shows "2 × (+3) = __" rows), plus the name
   (pick from 4, or build from word tiles) when the room's naming isn't off. Locked groups show a lock icon and the claims;
   tapping a locked group unlocks it to edit.
4. Swap: put one tile in the Swap bin -> it disappears, 2 tiles from `IonRules.drawAt` arrive. Allowed any time in build.
5. **Done** is enabled when every tile is in a locked group. Publish `boards/{uid}`, then transaction on `done`.
6. Challenge (`CHALLENGE_MS` = 25 s): everyone sees the caller's groups (formula, claimed totals, name) and taps to flag.
   The caller sees "Others are checking your compounds."
7. Reveal (`REVEAL_MS` = 7 s): each group ✓/✗ with the `why` sentences; flag results. Host writes `verdict/{n}`; if not ok
   host sets `out/{uid}` and removes `done`; others resume building with their boards unchanged.
8. Round ends when: a verdict is ok (`why:'win'`), `ROUND_MS` (8 min) passes (`'time'`), or fewer than 1 player is
   still in (`'allout'`). Host writes `data/over`.
9. Personal review (each player, about 20 s or until they tap Continue): their own groups ✓/✗/not locked with `why`,
   and the `scoreRound` lines. Each client writes its own `results/{uid}` and adds the ⚛ to the shared login save.
10. Room results screen: everyone's points this round. "Play again" (host: `room.reset()`) or "Leave".

Solo practice (no Firebase needed; also what the Claude preview and tests use when offline): deal a hand, build, Done ->
self-check reveal -> personal review. Same screens, no challenge step.

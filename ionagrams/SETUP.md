# Ionagrams: setup and first live test

Game address once merged: **https://gibsonm1.github.io/Ion-games/ionagrams/** (also linked from iBond's home screen).

## 1. Firebase security rules (once, before the first live test)
1. Firebase console › **gibson-chem-games** › Databases & Storage › Realtime Database › **Rules** tab.
2. Replace everything with the contents of `database.rules.json` from the `theme` repo. Click **Publish**.
3. Optional: Rules Playground checks are listed in `theme/tests/rules-notes.md`.

## 2. Code.gs (so logged-in students' ⚛ save)
In the Apps Script project, add this line inside `GAMES`, **after** the `bohr` entry (keep the others in order):
```js
  ionagrams: { tab: 'Ionagrams', cols: ['Rounds', 'Wins', 'Accuracy', 'Most missed'], extra: ['Extra time'] },
```
Then **Suite › Set up / repair tabs**, then **Deploy › Manage deployments › pencil › Version: New version › Deploy**.
Until this is done, logged-in ⚛ wait on the student's computer and are sent later (nothing is lost). Guests are unaffected.

## 3. Merge
GitHub shows a **Compare & pull request** button on each repo for the `ionagrams` branch. Merge **theme first**
(it has `rooms-v1.js`), then **Ion-games**. Pages takes a few minutes to update.

## 4. First live test (2–3 devices)
1. Device A: open the game, log in (or play as a guest and pick a period), **Play with classmates › New room**.
2. Devices B and C: same period → tap the room → **I'm ready** on all three.
3. Check: the 15 s countdown, the deal, opponents' "tiles left" updating, Swap, Lock (try Pick the name), Done,
   the challenge on the other devices, the reveal, review, results, Play again.
4. Close the tab on the device that made the room mid-round: the others should keep going.
5. If the lobby says it can't connect: check the rules were published (step 1) and that Anonymous sign-in is still Enabled.

## Settings you might change
- `ionagrams/ui.js`, CONFIG block at the top: timings, hand size, `TEACHERS` (usernames that see Teacher settings; set to `gibsonm1`, which needs a Roster row for that username).
- Teacher settings on the start screen (per period): which ions are dealt (single-atom, basic polyatomic, more polyatomic, metals with Roman numerals), puzzle-shape tiles on/off, and the least naming a room can use.

## Tests (for Claude sessions)
`node tests/rules.test.js` · `node ../theme/tests/rooms.test.js` (from theme) · `node tests/practice.test.js` · `node tests/endings.test.js` · `node tests/playtest.js` (4-bot multiplayer against the local fake Firebase in `theme/tests/fakebase`).

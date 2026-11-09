# Music tracks by game

Each scene has a short **pool** of tracks. Every time a game (or screen) starts, it picks one track from its pool at random, but never the same one as last time for that scene. The track then stays the same until the game ends. Music is off until a student turns it on.

To change a pool, edit the plain list in the file named in the last column. Use the track ids below. A track that fails to load is skipped (the pool just gets smaller).

| Game | Scene | Pool | Feel | Edit here |
|---|---|---|---|---|
| iBond | Home screen | `boombap`, `quintal`, `crush` | Calm and relaxed: slow boom-bap and backyard pagode | `HOME` in `MUSIC_CFG`, `index.html` |
| iBond | Bond (Free build, Build the name) | `stutter`, `boombap-up`, `roda` | Steady and thoughtful, never frantic | `BUILD` in `MUSIC_CFG`, `index.html` |
| iBond | Name drop: Pick the name, Pick the formula | `trap16`, `jersey`, `rage` | Driving, for time pressure | `DROP` in `MUSIC_CFG`, `index.html` |
| iBond | Name drop: Type the name | `boombap-up`, `bateria`, `quintal` | Calm focus for reading and typing; drums-only or soft groove; music level is capped (`TYPE_MAX`) | `TYPE` in `MUSIC_CFG`, `index.html` |
| iBond | Say my name | none | No music, so it cannot confuse the microphone | |
| iBond | Charge Command | its own spooky loop | Not part of the pools | |
| Ionagrams | Lobby | `bounce`, `partido`, `enredo` | Upbeat and friendly, party feel | `BEATS.lobby` in `CONFIG`, `ionagrams/music.js` |
| Ionagrams | Build | `drill`, `bateria`, `trap16`, `stutter` | Driving but steady; the drums-only and puzzle tracks help focus | `BEATS.build` in `CONFIG`, `ionagrams/music.js` |
| Ionagrams | Review | `boombap`, `quintal`, `crush`, `roda` | Calm and relaxed | `BEATS.review` in `CONFIG`, `ionagrams/music.js` |

Ka-BOHR! keeps its own music (it is tied to its game rules).

## The 14 tracks

| Id | Name | Tempo | Feel |
|---|---|---|---|
| `boombap` | Boom-Bap Beaker | 90 | Calm, jazzy, laid back. For menus and review |
| `boombap-up` | Boom-Bap Beaker+ | 100 | Same groove, a little faster. Steady gameplay |
| `quintal` | Backyard Bonds | 98 | Calm pagode: pandeiro, cavaquinho, banjo |
| `crush` | Covalent Crush | 96 | Gentle, romantic samba with cuica and choir |
| `roda` | Roda Reaction | 106 | Warm, steady partido: banjo, cavaquinho, call and response |
| `stutter` | Stutter Catalyst | 98 | Playful, bouncy, good for puzzles |
| `partido` | Partido Periodic | 110 | Upbeat, clapping and call-and-response singing |
| `bounce` | Bayou Bounce | 100 | Party feel: shakers, congas, whistle lead |
| `enredo` | Enredo Elements | 138 | Energetic samba parade with band and singers |
| `bateria` | Bateria Blast | 142 | Drums only (parade percussion). Good for focus |
| `trap16` | Throwback Trap | 140 | Driving, clean bass and bells |
| `jersey` | Jersey Bounce | 140 | Driving club bounce |
| `drill` | Glide Reaction | 142 | Tense and fast, with sliding bass |
| `rage` | Rage Reactor | 150 | The most aggressive track |

Tips:

- Keep `rage` and `drill` out of scenes where students read or type a lot.
- A pool of one track always plays that track. A pool of two or more never repeats the last pick.
- The last pick for each scene is remembered on that device only (`ibond-music-last-<scene>` and `ionagrams-beat-last-<scene>` in the browser's storage).
- The track tests (`node tests/musicpick.test.js`) fail if a pool has a typo, has fewer than 2 or more than 4 tracks, or leaves one of the 14 tracks out.

# The Stone Halls

A walking exhibit of cathedrals and castles — a thousand years of architecture hung in seven halls.

**Visit: https://tgon21.github.io/stone-halls/**

Choose an era on the timeline, walk its hall in first person, and click any painting
to open its catalogue entry: the history, the architecture, and a gallery of
exterior, interior and detail photographs.

- 7 halls: Romanesque → Early Gothic → High Gothic → Castles → Late Gothic → Renaissance & Baroque → Revival & Modern
- 41 buildings, ~360 photographs, all from [Wikimedia Commons](https://commons.wikimedia.org) (see [CREDITS.md](CREDITS.md))
- No frameworks, no build step: the halls are CSS 3-D transforms, the stone and rose
  windows are generated SVG, the room tone is synthesised in the browser
- `tools/` holds the Python pipeline that surveys Commons imagery, grades it,
  and builds the exhibit data

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | walk and turn |
| drag | look around |
| scroll | walk |
| click a painting | step up and open the catalogue |
| `T` | guided walk |

Built with Claude Code.

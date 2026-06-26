# 🌱 Garden Lite

A local-first garden planner. Pick plants suited to your site, plant them on a
calendar, and get an auto-generated care schedule (fertilization, pest scouting,
pruning, growth checks). Everything is stored in the browser (IndexedDB via
Dexie) and can be backed up / published to a private GitHub Gist.

## Features

- **Site profile** — name, altitude (masl), average temperature & humidity.
- **Plant compatibility** — each preset is checked against your site and rated
  *compatible / marginal / incompatible* with reasons.
- **Calendar + day detail** — month grid (left) with event dots; selected-day
  detail (right) with an **Add +** button. Responsive single-column on mobile.
- **Preset-driven schedule** — planting a crop expands its preset across days
  after planting (DAP): crop protection, pruning, pest & disease scouting, soil
  targets, growth benchmarks, and a recurring fertilization schedule.
- **Export / import** — full data as JSON; calendar as `.ics`.
- **GitHub Gist sync** — back up/restore data and publish a subscribable `.ics`
  calendar to a private gist (token needs only the `gist` scope).
- **Themes** — light and dark, switchable and persisted.

## Stack

TypeScript · [Lit](https://lit.dev) · SCSS (CSS-custom-property theming) ·
[Dexie](https://dexie.org) (IndexedDB) · Vite.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
```

## Preset data

Plant presets live in [`src/data/presets.json`](src/data/presets.json)
(crops + nurseries). Each entry carries `growing_conditions` and a `presets`
block with the seven care categories, keyed by DAP range / interval. The schema
and seed data were ported from the companion `garden` Rails app.

## Notes on the GitHub token

The token is stored in IndexedDB on this device only and is **never** included
in JSON/ICS exports. Create a fine-grained or classic token scoped to **gist
only**. To revoke access, delete the token in GitHub settings.

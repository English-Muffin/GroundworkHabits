# Contributing to Groundwork Habits

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an [issue](https://github.com/English-Muffin/GroundworkHabits/issues/new/choose) with the version,
the platform (Windows, macOS, Android or browser), the steps to reproduce it, and a screenshot if it's visual.

## Working on the code

The whole app is [`www/index.html`](www/index.html): CSS, HTML and plain JavaScript in one file, with no
build step and no runtime dependencies. Read [`CLAUDE.md`](CLAUDE.md) first: it explains the data model,
rendering, conventions and the gotchas that have already been hit.

```bash
python -m http.server 8765 --directory www     # run it
pip install playwright && playwright install chromium
python tests/smoke.py                          # must pass before a pull request
```

Before you open a pull request:

- Run `python tests/smoke.py`. When you fix a bug, add a check for it.
- For layout changes, also run `LAYOUT_ONLY=1 python tests/stress.py out/` and look at the screenshots
  at 390 px and 1280 px.
- Keep it one file, no frameworks, no new runtime dependencies. Escape user text with `esc()`.
- UI copy: sentence case, typographic apostrophes, no emoji. Icon-only buttons need an `aria-label`,
  and nothing may depend on hover.
- Bump `VERSION` in `www/sw.js` when shipped files change.

By contributing you agree that your work is released under the [GNU AGPL-3.0-or-later](LICENSE).

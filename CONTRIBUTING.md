# Contributing

## Code

- Keep folder clustering code in `src/folder-clustering`.
- Prefer pure functions for calculations. Keep side effects at integration boundaries.
- Extract functions when the result improves reuse or readability.
- Use ECMAScript 2026 syntax and semantics. Do not use proposal-only features.
- Follow the MDN guidelines for [HTML](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/HTML), [CSS](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/CSS), and [JavaScript](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/JavaScript).
- Use HTML5 and CSS3 standard features. Do not use obsolete, deprecated, or nonstandard elements and properties.

## Text

- Use direct sentences in code, comments, documentation, and UI text.
- Remove repetition, slogans, ornamental quotations, and inflated summaries.
- Do not use middle dots or em dashes.
- Add comments only when the code cannot state the reason directly.

## Commits and releases

- Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/ko/v1.0.0/).
- Run `npm run check` before committing.
- Keep `package.json`, `manifest.json`, and `versions.json` versions aligned.
- Attach `main.js`, `manifest.json`, and `styles.css` to each GitHub release.

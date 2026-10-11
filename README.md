# Equilibrium: Divya Bhatia's portfolio

A single-page portfolio built around one idea from Divya's ocean-chemistry work: adding alkalinity shifts an equilibrium. As you scroll, the page moves along a universal pH indicator scale from acidic red (top) to alkaline violet (bottom).

Plain HTML, CSS and JavaScript. There is no framework and no build step. Pushing to GitHub is the whole deploy.

---

## Editing content (no code needed)

**Everything you'd want to change is in [`content.json`](content.json).** Edit it, save, and push.

| To change… | Edit this part of `content.json` |
|---|---|
| Name, one-line thesis, intro | `person` |
| Headshot (small circle in the hero) | put the image in `assets/` (square, about 300×300px), then set `person.photo` to e.g. `"assets/headshot.jpg"`. Empty = blank circle. |
| Show GPA on the résumé | `resume.education[0].showGpa`: `true` or `false` (currently `false`) |
| A project (notebook entry and network node) | `projects[]` |
| Which fields a project bonds to | `projects[].domains`: any of `chem`, `bio`, `eng`, `comm` |
| The short label on the network | `projects[].short` |
| Conference status pills (SCCUR, IYRC) | `projects[].status` |
| Archive timelines | `archive.history`, `archive.community` |
| Table of elements tiles (Achievements) | `elements[]`; `group` is `program`, `publication` or `recognition`. `isotope` is the small superscript (e.g. `"05"`). |
| What opens when a tile is clicked | `elements[].detail` (one-line summary), `details` (paragraphs), `impact`, `related` (project ids, shown as buttons), `media` (images: `src`, `alt`, `caption`) |
| Questions, quiz, personal notes | `curiosities` |
| Résumé page | `resume` |
| Email and links | `contact` |

**Adding a project:** copy an existing object in `projects`, give it a new unique `id`, and fill in the fields. It appears in the reaction network, the mobile list and the notebook automatically.

**Hero text:** the hero copy also appears in `index.html` so the first paint is instant. If you change `person` in `content.json`, the site still shows the new text, but update the matching lines in `index.html` too (search for `data-person`) to avoid a flicker.

**Placeholders:** anything written as `[TODO: …]` shows on the site as a striped, dashed marker so it can't be missed. Before sharing the site publicly, either fill them in or set `"hideTodos": true` in `meta`. That hides every remaining TODO, and projects without a question (Period 5 for now) drop out entirely.

Formatting: wrap text in asterisks for italics, e.g. `*Beloved*`.

JSON tip: keep the quotes and commas. If the page shows "Content failed to load", paste `content.json` into a JSON validator to find the typo.

---

## Previewing locally

`content.json` is loaded with `fetch`, so opening `index.html` directly from the Finder won't work. Serve the folder instead:

```bash
cd divyabhatia.github.io
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying to GitHub Pages

1. Commit and push to the `main` branch of the GitHub repo.
2. On GitHub, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
3. After a minute the site is live.

**URL:** the repo is `DivyaB1130/DivyaB1130.github.io`, so the site is served at **https://divyab1130.github.io/** (also set as `meta.url` in `content.json`).

**Vercel (alternative):** import the repo and set Framework Preset to "Other". It needs no build command and the output directory is the root.

---

## How it's built

```
index.html          page skeleton, meta/OG tags, section containers
content.json        ALL content
css/styles.css      layout, typography, print styles (résumé)
js/main.js          loads content, renders sections, lazy-loads demos
js/ph.js            scroll → pH → colour engine + side gauge (WCAG contrast enforced here)
js/network.js       reaction-network hero (SVG + small force layout)
js/sections.js      notebook, archive, elements, curiosities, résumé, contact, dialog
js/theme.js         light/dark switch with circular View Transition (the stopcock)
js/equilibrium.js   OAE carbonate-chemistry model + rotatable carbonate ion (lazy)
js/titration.js     titration toy (lazy)
js/quiz.js          "Pick a side" greenhouse quiz (lazy)
js/reader.js        full-screen document reader using pdf.js from cdnjs (lazy)
assets/             favicon, OG image, self-hosted fonts
assets/docs/        PDFs readable on the site: slide decks, research paper, MUN guide, magazines
assets/media/       WebP images for the Achievements tiles (from Divya's own slides, magazines, paper, photos, certificates)
```

- **Colour and accessibility.** `js/ph.js` derives every colour from the current pH. Text colours are automatically pushed toward the ink colour until they reach a 4.6:1 contrast ratio against both the background and card surfaces, so WCAG AA holds at every point of the gradient, in both themes. Non-text marks get 3:1.
- **Motion.** Network drift, the stopcock reveal, reveal-on-scroll and the molecule's idle spin all stop under `prefers-reduced-motion`. The drift also pauses when off-screen or when the tab is hidden.
- **Keyboard.** Every network node is a focusable button (Enter or Space opens it, focus returns on close). Domains toggle a pinned highlight. The molecule rotates with the arrow keys.
- **Side gauge.** Works like a scrollbar on the pH scale: drag the marker, click the track, or hover to see every section as a clickable label. With keyboard focus on the marker, arrow keys step between sections and Home/End jump to the ends.
- **Mobile.** Below 720px the network becomes a stacked list with bond tags, and the side gauge becomes a thin progress bar.
- **Résumé PDF.** "Save résumé as PDF" opens the print dialog. Print styles hide everything except a clean one-page résumé. There's no PDF file to keep in sync.

### Verified (local, 8 Oct 2026)
- Lighthouse (mobile, uncompressed local server): Performance 97, Accessibility 100, Best Practices 100, SEO 100. CLS 0, total weight about 223 KB on first load. On GitHub Pages, compression makes it smaller still.
- Contrast sweep: pH 0–14 in steps of 0.05, light and dark, 0 failures.
- No console errors. Keyboard open/close, dark switch, all three demos, print view, `hideTodos` mode and 390px mobile with no horizontal scroll were all checked.

---

**Adding a readable document:** put the PDF in `assets/docs/`, add an entry to `documents` in `content.json` (`id`, `kind`, `title`, `file`, `pages`), then list its `id` under `documents` on any tile in `elements` or any project in `projects`. A "Read" card appears there and opens the in-page reader. Large PDFs can be shrunk first with Ghostscript: `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dFastWebView=true -o out.pdf in.pdf`.

**Adding an image to a tile:** save it as a `.webp` or `.jpg` around 1000px wide in `assets/media/`, then add `{ "src": "assets/media/name.webp", "alt": "what it shows", "caption": "short caption" }` to that tile's `media` list. Images load only when a tile is opened, so they don't slow the first page load.

**Navigation labels:** the top bar uses plain section names (Projects, Community & History, Achievements, Interests, Résumé, Contact). The section headings keep their creative titles, with the plain name above each one.

## Credits
Fonts: [Fraunces](https://github.com/undercasetype/Fraunces) and [IBM Plex Mono](https://github.com/IBM/plex), both SIL Open Font License, self-hosted. All illustrations are original SVG.

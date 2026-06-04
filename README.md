# Anneal Click-List

A small static web app for programming a Lindberg tube furnace / furnace controller from simple anneal text like:

```text
900C for 2 hr
1200C for 30 min
```

The app outputs:

- Exact controller parameters: `Pnr`, `Pr1`, `PL1`, `Pd1`, `Pr2`, `PL2`, `Pd2`, `Pr3 = END`
- A full button-by-button click list
- Running verification notes
- An ideal ETA estimate from current PV, target temperature, and ramp rate

## Use

Open `index.html` in a browser, or deploy the folder to GitHub Pages. No backend or build step is required.

On iPhone Safari, use Share -> Add to Home Screen to install it as a simple app.

## Files

- `index.html` - app markup
- `style.css` - phone-friendly styling
- `script.js` - parser, validation, localStorage, and output generation
- `manifest.json` - basic PWA metadata

# Foamwright

A browser-based CAD tool for designing foam postural support devices: seat cushions, back supports, thoracic laterals, headrests, pommels and wedges. You dimension the foam blocks, place the mounting brackets and specify the covers. The tool then produces a cut list, a drawing sheet and a printable specification for the fabricator.

It runs entirely in the browser with no build step and no dependencies. Projects are saved as JSON files and autosaved to the browser's local storage. Nothing is sent to a server.

## Running it

ES modules do not load from `file://` URLs, so serve the folder over HTTP:

```sh
npm start            # zero-dependency static server on http://localhost:8080
# or
python3 -m http.server 8080
```

To host it, publish the repository root as a static site (GitHub Pages, Netlify and so on). There is no build step.

## Features

**Foam parts**
- Eight parametric shapes: rectangular block, chamfered block, wedge (separate front and back heights), contoured/scooped block (for thigh troughs), curved lateral pad, L-shaped block, half-round bolster and cylindrical roll.
- Position (X/Y/Z), rotation in 90° steps, "drop to rest" and "align to part below" for stacking layers.
- Foam grade catalogue (HR, visco-elastic, latex, closed-cell PE/EVA, reconstituted), with density and indicative hardness.
- Optional rigid base board (plywood, ABS, HDPE, aluminium).

**Drawing and dimensioning**
- Four linked views: Top, Front and Right side (third-angle orthographic), plus an orbitable 3D view.
- Automatic dimensions for the selected part and for the whole assembly. Click a highlighted dimension to type a new value and the part resizes.
- A dimension tool (`D`) for your own annotations: horizontal, vertical, aligned or automatic, with snapping to vertices, edge midpoints and the grid.
- Drag parts to move them (snapped to the grid), drag brackets to slide them across their face, pan by dragging empty space, and zoom with the mouse wheel.
- Units in millimetres or inches.

**Mounting brackets**
- Catalogue: swing-away and fixed lateral brackets, headrest mounts, seat drop hooks, back hardware clamps, quick-release plates, T-nuts, hook-and-loop, straps, hinges and custom.
- Place on any face with offsets from the face centre. The inspector and spec sheet also give the distance from the edges.
- Size, quantity, material, fixing and notes for each bracket.

**Covers**
- Material (PU-coated knit, vinyl, spacer mesh, velour, neoprene, incontinence-proof laminate), colour, closure type and position, fire standard, and options for removable, waterproof liner and anti-slip base.
- Fabric area estimate that includes 15% for seams and wastage.

**Checks and outputs**
- Design checks for impossible geometry, thin foam, brackets that overhang their face, screw fixings without a rigid base, overlapping parts, missing covers and fire standards, and latex allergy.
- Weight estimate covering foam, boards, fabric and hardware.
- Specification sheet (print or save as PDF), SVG drawing sheet, CSV cut list and a JSON project file.
- Undo and redo, plus six starting templates.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `V` / `D` | Select tool / dimension tool |
| `Esc` | Cancel the dimension in progress, or deselect |
| `Delete` | Delete the selected part, bracket or dimension |
| Arrow keys, `PgUp` / `PgDn` | Nudge the selected part by one grid step in X/Y or Z |
| `R` | Rotate the selected part 90° |
| `F` | Zoom all views to fit |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Ctrl+D` | Duplicate the part |
| `Ctrl+S` | Save the project file |

Shift-drag or middle-drag pans in any view. In the 3D view, a plain drag orbits.

## Coordinate conventions

All geometry is stored in millimetres. X runs across (left to right), Y runs from front to back, and Z runs up. A part's position is the front-left-bottom corner of its foam. A base board, if fitted, sits below that point. Bracket faces are named in this assembly frame, so "Right (+X)" always means the right-hand side of the device.

## Project layout

```
index.html        App shell
css/app.css       Styles, including light/dark themes and print styles for the spec sheet
js/catalog.js     Foam, board, bracket and cover catalogues
js/geometry.js    Parametric shapes (extruded profiles), transforms, volumes, bracket placement
js/model.js       Project model, validation, weight and fabric calculations, file I/O
js/templates.js   Starting templates
js/render.js      SVG renderer for all views and dimension drawing
js/viewport.js    Interactive viewport: pan, zoom, select, drag, dimension tool
js/panels.js      Side-panel HTML
js/spec.js        Specification sheet, CSV cut list, SVG drawing sheet
js/app.js         Application controller: state, undo, events, files
tests/            Node test runner tests for the geometry and model
```

## Tests

```sh
npm test
```

## Disclaimer

Foamwright is a design and communication aid. Material properties are typical values. Confirm density, hardness and fire performance with your supplier. Every device must be prescribed, checked and fitted by a qualified clinician.

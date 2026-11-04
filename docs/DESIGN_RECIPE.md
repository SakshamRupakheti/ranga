# Editable design recipes

Open **Creative tools** in the editor. Enter a brief, select references, then use **Copy instructions & open ChatGPT**. In desktop this focuses the existing ChatGPT pane; on the web it attempts a normal browser tab. If a browser blocks the tab, use the separate **Open ChatGPT** link. The copy operation is deterministic and sends nothing to an AI service. The prompt contains the discovery query, text descriptions/source attribution, dimensions, background, and IDs of available project images. Attach permitted reference images in ChatGPT yourself when useful.

Use **Import result** to paste JSON or load a `.json` file. Validation shows the composition title, dimensions, and layer count before applying. Applying saves a version, replaces the composition, and preserves the reference board. Invalid input leaves the current design intact.

The exact version 1 exchange schema is published at `/ranga-recipe.schema.json` and generated from `recipeSchema` in `src/lib/design-recipe.ts`. Unknown fields are rejected. No HTML, JavaScript, SVG markup, commands, or external image URLs are executed or fetched.

```json
{
  "format": "ranga.recipe",
  "version": 1,
  "title": "College design night",
  "canvas": { "width": 900, "height": 1200, "background": "#eee9dc" },
  "elements": [
    {
      "type": "text",
      "name": "Headline",
      "text": "Design night",
      "x": 60,
      "y": 120,
      "width": 700,
      "height": 180,
      "fill": "#20241f",
      "fontFamily": "Arial",
      "fontSize": 72
    },
    {
      "type": "ellipse",
      "name": "Accent",
      "x": 260,
      "y": 520,
      "width": 320,
      "height": 320,
      "fill": "#bd442d"
    }
  ]
}
```

Elements are ordered back to front. Coordinates are top-left canvas pixels. Supported types are `text`, `rect`, `ellipse`, and `image`. Fonts are Arial, Georgia, Courier New, and Impact. Images require `assetId` pointing to an existing image-layer ID listed in the generated prompt; imports resolve that ID to its permitted asset and create a new stable layer ID. Image results uploaded separately remain one raster layer.

Limits: 2 MB recipe text, 200 elements, canvas dimensions 100–4096, six-digit hex colors, bounded geometry/typography. See the machine-readable schema for every bound. Normal Ranga backup files use the full document format and are imported through Projects, not through the recipe interface.

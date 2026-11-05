# Editable design recipes

Open **Creative tools** in the editor. Enter a brief, select references, then use **Copy instructions & open ChatGPT**. In desktop this focuses the existing ChatGPT pane; on the web it attempts a normal browser tab. If a browser blocks the tab, use the separate **Open ChatGPT** link. The copy operation is deterministic and sends nothing to an AI service. The prompt contains the discovery query, text descriptions/source attribution, dimensions, background, and IDs of available project images. Attach permitted reference images in ChatGPT yourself when useful.

Use **Changes for ChatGPT** in Creative tools or References to describe what to keep, replace, rewrite, recolor or rearrange, including logo and originality requirements. These fields save with the project. The prompt includes selected reference names, intended use and descriptions, without image bytes or private asset URLs. Permitted owned/generated image cards have a download action for manual attachment. Changing the instructions clears the previous copied indication.

Use **Creative tools → Bring into Ranga**, or the desktop **Bring into Ranga** button, to paste a result or choose a file. **Read clipboard** runs only when clicked; when permission is unavailable, use the focused Ctrl/Cmd+V area or a file. There is no background clipboard monitoring, remote session reading or automatic message submission. Leaving the panel discards temporary previews, including late clipboard results.

JSON or fenced JSON is strictly validated as a recipe. Validation shows the composition title, dimensions, and editable layer count. **Apply validated design** waits for a saved version, rechecks the destination, edit access and current composition, then replaces title/canvas/layers through the normal editor commit. References, brief, discovery query and change instructions survive. If the canvas changed after preview, use **Preview again**. A failed checkpoint retains the current design and preview; invalid input leaves the current design intact. Use Undo or History for recovery.

Plain descriptions, source links and supported images use the existing reference preview and **Add reference** flow. Source links are never fetched. Images require explicit permission and remain raster references; they are not inserted into the canvas by this panel yet. The editor's normal Image control remains available for raster canvas layers.

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

Limits: 2 MB UTF-8 recipe text, 200 elements, canvas dimensions 100–4096, six-digit hex colors, bounded geometry/typography. Reference descriptions and source links accept 2,000 characters; images retain the 5 MB, 24-megapixel and 10,000-pixel-side limits. See the machine-readable schema for every recipe bound. Normal Ranga backup files use the full document format and are imported through Projects, not through the recipe interface.

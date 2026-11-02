# Ranga design system

## Identity

An editorial studio desk: warm paper, dark ink, precise controls, and one warm accent. Ranga is the name. The wordmark is provisional text; no final logo or favicon has been designed. The founder intends to create those in Ranga.

## Tokens and rules

| Area | Decision |
| --- | --- |
| Colors | Paper `#f6f5f0`, panel `#fffefa`, ink `#252922`, muted `#6c7065`, border `#dedfd6`, vermilion `#b9422c`, canvas surround `#e9ebe3` |
| Typography | Georgia for editorial headings and provisional wordmark; Arial/Helvetica for UI. Explicit system fallbacks. Four editable canvas families: Arial, Georgia, Courier New, Impact. |
| Type hierarchy | Landing headline 61–100 px depending on width; workspace heading 28–38; body 12–16; dense editor controls 10–13. Small uppercase labels are secondary, never the sole accessible control name. |
| Spacing | 4 px base with 8/12/16/20/24/32/40/48/64 steps. Dense editor rows are separate from larger project-page rhythm. |
| Grids | Desktop editor tools / canvas / inspector. Project templates and projects use a responsive grid. Landing pairs a typographic brief with an editable composition. |
| Components | Crisp 1 px borders, mostly 3–5 px corner radii, real disabled states, purposeful selected states. Modest shadows only for the artboard and popover. |
| Canvas | Quiet sage-neutral surround, small artboard label and dimensions, original artwork visually separate from application chrome. Full artwork resolution is independent of zoom. |
| Iconography | Lucide SVGs, consistent stroke and sizes. No emoji controls. Icon-only controls have labels. |
| States | Visible keyboard focus, hover, selected, disabled, saving, save failure, loading, unavailable integrations, actual browser-empty projects. No fabricated progress percentages. |
| Accessibility | Semantic headings and buttons, named fields, real status/alert regions, native select/input behavior, reduced motion. DOM layer list and property fields provide alternatives to dragging. Full assistive-technology canvas audit remains open. |
| Responsive behavior | Desktop shows both panels. Tablet defaults to canvas plus inspector. Phone defaults to canvas with mutually exclusive tools/properties drawers. No desktop dashboard squeezed into the phone screen. |

## Content

All buttons perform an action or disclose an unavailable feature. AI has no fake chat or generated responses. No testimonials, customer counters, decorative marketing metrics, third-party customer logos, or people imagery. No gradients, glass effects, cursor animation, or parallax. No em dashes in product copy.

The Form & Field and A Fresh Perspective templates are authored original compositions with real text and shape layers. They are starting points, not customer work or evidence of AI generation.

## Follow-up

Revisit tiny secondary labels and touch target sizes during full accessibility testing. Browser and OS font metrics may vary; exported SVGs retain text rather than outlining it. Color contrast needs a formal audit before public release.

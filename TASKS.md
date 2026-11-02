# Living task list

## Current milestone: local graphic editor

- [x] Use Ranga throughout; defer final logo creation to the product itself.
- [x] Set up Next.js, React, strict TypeScript, Tailwind tokens, Lucide, Fabric, and validation.
- [x] Define and document visual identity, architecture, integration boundaries.
- [x] Build landing, projects, editor, brand kit, and accurate local settings.
- [x] Add editable text, rectangles, ellipses, image/logo upload, transforms, properties, and layer controls.
- [x] Implement undo/redo, autosave, reopening, version snapshots/restoration.
- [x] Implement PNG, SVG, and validated JSON backups/imports.
- [x] Add user-uploaded references, selection, and creative-direction notes.
- [x] Add local brand kit and real application to designs.
- [x] Add model tests and browser tests; record final outcomes in docs/VERIFICATION.md.
- [x] Prepare GitHub Actions and Dependabot configuration.
- [ ] Create private GitHub remote, push branches, verify hosted CI, enable main branch protection.
- [ ] Verify Vercel private preview setup; do not launch publicly.

## Next editor milestone, no paid API required

- [ ] Persistent groups/ungroups and group inspector.
- [ ] Dedicated pan tool, keyboard nudge, snapping, and alignment guides.
- [ ] More robust multi-tab conflict detection and browser quota recovery.
- [ ] Image cropping/masks, richer type controls, licensed custom fonts.
- [ ] Asset deduplication separate from scene JSON before larger projects or cloud migration.
- [ ] Full accessibility review including screen readers, contrast, touch targets, and focus restoration.
- [ ] Firefox/Safari and real phone/tablet testing.
- [ ] Make Ranga's actual logo in Ranga after the editor direction is accepted.

## Deferred service milestone (founder explicitly requested setup later)

- [ ] Secure OpenAI key setup, current pricing/model review, server-side assistant and image generation.
- [ ] Validated AI command interpreter with actual editable-layer updates and evaluations.
- [ ] Managed authentication; account/profile/deletion flows; tested cross-user isolation.
- [ ] Managed PostgreSQL, Drizzle migrations, object storage, encrypted OAuth token storage.
- [ ] Background generation jobs, rate limits, retries, abuse and spend controls.
- [ ] Pinterest app/access approval and least-privilege supported boards/Pins workflow.
- [ ] Canva OAuth and proven import/export workflow with explicit fidelity limitations.
- [ ] Domain, favicon, legal review, monitoring, backup/restore drills, public launch checklist.

## Known dependency work

- [ ] Resolve development-only minimatch advisory chain when upstream lint plugins support fixed compatible versions. Do not apply `npm audit fix --force` downgrades or incompatible major overrides.
- [ ] Upgrade ESLint together with Next lint plugin compatibility; ESLint 10 currently produces unsupported peer ranges in several bundled plugins, so this milestone pins the compatible 9.39.5 version and documents its deprecation.

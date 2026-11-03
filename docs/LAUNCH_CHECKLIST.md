# Public launch gate

**Local development application only. Public launch remains gated.** Updated 2026-11-03.

## Verified local foundations

- [x] Native editor saves/reloads and exports real graphics.
- [x] Maintained account library, server-side role enforcement and private project/asset access.
- [x] Multi-session editing, text merge, offline reconnect, revocation, persistence after restart.
- [x] Reference import and manual handoff with untrusted recipe validation.
- [x] No fabricated metrics, testimonials, external account connections, AI chat, or external API calls.
- [x] Unit/integration/browser check configuration and reproducible local verification.

## Required before public exposure

- [ ] Private GitHub repository connected; branches pushed; hosted CI passed; branch protection enabled.
- [ ] Private hosted preview verified with persistent WebSocket infrastructure and authenticated proxy routing.
- [ ] Managed PostgreSQL/object storage migrated and isolated with least-privilege access.
- [ ] HTTPS/WSS and secure production cookie/session settings reviewed; session-secret management and rotation established.
- [ ] Email ownership verification and real recovery delivery configured/tested; restricted invitations verified against mailbox ownership.
- [ ] Production HTTP/WebSocket authorization and CSRF/XSS/security review, rate limits, account quotas and abuse controls tested.
- [ ] Cross-user reads/writes/uploads/previews/invitations tested in the hosted environment.
- [ ] Load/performance tests with realistic large compositions and concurrent teams.
- [ ] Scheduled encrypted backups, restore rehearsal, deletion/retention policy, unused-asset collection and outage recovery.
- [ ] Error monitoring, support channel, incident handling and operational ownership.
- [ ] Full accessibility review, keyboard/screen-reader coverage, contrast/touch targets and physical devices.
- [ ] Supported-browser checks including Firefox/Safari; export fidelity verified for intended destinations.
- [ ] Accurate privacy policy, terms, support page and consent practices reviewed against actual hosting.
- [ ] Custom domain and HTTPS verified; final Ranga logo/favicon created using the product.
- [ ] No unfinished feature represented as production-ready; all current critical checks pass.
- [ ] Development dependency advisories reviewed and accepted or resolved compatibly.

No AI/social-platform OAuth integration is a launch requirement for this MVP. Pinterest and ChatGPT remain separate-tab manual tools. API integration would be a separate explicitly approved phase.

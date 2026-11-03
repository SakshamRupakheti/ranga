# Security

Ranga is currently a local development application. Public source availability does not make the application ready for public hosting. The account/collaboration service intentionally binds to loopback and rejects public origins. See `docs/LAUNCH_CHECKLIST.md` before changing that boundary.

Do not include account databases, authentication cookies, session secrets, password reset links, invitation tokens, personal designs, or browser profiles in issues or pull requests. Use synthetic data for reproductions.

For a suspected vulnerability, contact the repository maintainer privately before publishing technical details. If GitHub private vulnerability reporting is available on the Security tab, use it. Do not create a public issue containing an exploit against private user data.

Dependencies retain their own licenses. Ranga's MIT license covers the original code and included original design examples; it does not license users' uploaded artwork or third-party websites, accounts, brands, or assets.

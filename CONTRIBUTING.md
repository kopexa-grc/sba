# Contributing

Thanks for helping to improve the Kopexa Schutzbedarfsanalyse. Bug reports, ideas and pull requests are welcome.

The canonical repository is [github.com/kopexa-grc/sba](https://github.com/kopexa-grc/sba). The copy on
[OpenCoDE](https://gitlab.opencode.de/kopexa/sba) is a read-only mirror, so please open issues and pull requests on
GitHub.

## Before you start

- **Bugs:** open an [issue](https://github.com/kopexa-grc/sba/issues) with the steps to reproduce, what you expected and
  what happened. Browser and version help. Never attach real analyses; they may contain confidential information.
  The sample analysis ("Beispiel ansehen") is usually enough to reproduce a problem.
- **Features:** open an issue first, so we can agree on the approach before you spend time on it. The app is
  deliberately small: one person, one browser, BSI 200-2. Integrations with other tools are out of scope.
- **Security issues:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Development setup

Requires Node.js 22+ and pnpm.

```sh
pnpm install
pnpm exec playwright install chromium   # once, for the end-to-end tests
pnpm dev                                # http://localhost:5173
```

Before you open a pull request, all of these must pass. CI runs the same checks and `main` only accepts green builds.

```sh
pnpm typecheck
pnpm lint
pnpm test        # unit tests (Vitest)
pnpm test:e2e    # end-to-end and accessibility tests (Playwright + axe)
```

## Guidelines

### Code

- Code, identifiers and comments are in **English**. Everything the user sees is in **German**.
- Keep the domain logic in `src/domain` pure: no I/O, no React. Cover it with unit tests.
- A change the user can see needs an end-to-end test for the flow it touches.
- Match the surrounding code: naming, comment density and structure.

### Design

Read [`docs/STYLEGUIDE.md`](docs/STYLEGUIDE.md) before changing the UI. The live reference is the `/styleguide` page. The
interface is deliberately quiet, and the patterns listed there as forbidden are rejected in review: accent borders,
tinted boxes, pastel pills, decorative icons. New patterns go into the styleguide first, then into the app.

### Accessibility

The app targets WCAG 2.2 AA. Every control must be operable by keyboard, have a visible focus and an accessible name.
Hints and errors are linked to their fields. The axe checks in `pnpm test:e2e` must stay free of violations.

### Wording

UI texts are plain and factual. Use sentence case, active voice and the formal "Sie". Buttons say what happens
("Version abschließen", not "OK"). No marketing, no exclamation marks.

### File format

The `.sba` format is versioned (`SCHEMA_VERSION` in `src/io/json.ts`). Files written by older versions must keep
opening. Changes to the format need a migration and a test that reads the previous version.

## Commits and pull requests

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). They are not decoration:
[release-please](https://github.com/googleapis/release-please) builds the version number and `CHANGELOG.md` from them.

| Prefix | Use for | Release |
| --- | --- | --- |
| `feat:` | New behaviour users notice | minor, listed under Features |
| `fix:` | Bug fixes | patch, listed under Bug Fixes |
| `docs:` | README, handbook, guides | listed under Documentation |
| `refactor:`, `test:`, `style:`, `ci:`, `chore:` | Everything else | no release, not listed |

A breaking change, for example a file format that older versions cannot open, gets a `!` (`feat!:`) and a
`BREAKING CHANGE:` note in the body.

Write the subject in the imperative and describe the change for users, not the implementation:
`fix: keep justifications when closing a version`, not `fix: update repo.ts`.

Keep pull requests focused on one change. Include screenshots for visible changes, before and after.

## Releases

Maintainers merge the release pull request that release-please keeps open. Merging it tags `vX.Y.Z`, publishes the
GitHub release and updates `CHANGELOG.md`, `package.json` and `publiccode.yml`. Every push to `main` is deployed to
[schutzbedarf.kopexa.com](https://schutzbedarf.kopexa.com/).

## License

By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE), like the rest of
the project.

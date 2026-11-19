# carbon-next-test

This repo installs Carbon packages published from the
[next](https://github.com/carbon-design-system/carbon/tree/next) and uses them
the same way consumers do: in fresh installs, real bundlers, server rendering,
Sass builds, and browsers. The goal is to catch problems that only appear in the
published packages, such as missing files, mismatched internal versions, broken
entry points, or builds that fail in a framework.

Component behavior, accessibility, and visual regressions are tested upstream.
This repo does not repeat those tests.

## What runs

| Check                    | Where                         | Catches                                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package contract         | `tests/contract`              | Version mismatches between packages in a release, duplicate installs, files missing from a package, `publint` errors, entry points Node cannot resolve or load                                                                                                  |
| Public API diff          | `tests/contract/src/api.*`    | Exports, custom elements, attributes, and Sass modules removed since the previous release                                                                                                                                                                       |
| v12 defaults             | `tests/contract/src/v12.*`    | v12 enabled by default in JavaScript, React, and Sass; components migrated from `@carbon/ibm-products`; Temporal polyfill; manifest format. Each check tied to a section of `docs/migration/v12.md` only runs once that section exists at the release's git tag |
| React + Vite             | `apps/react-vite`             | Strict TypeScript, production build, jsdom unit tests, browser smoke tests. Also runs against React 18                                                                                                                                                          |
| React + Next.js          | `apps/react-nextjs`           | App Router build, server rendering, hydration                                                                                                                                                                                                                   |
| Web Components + Vite    | `apps/web-components-vite`    | TypeScript, production build, element registration, browser smoke tests                                                                                                                                                                                         |
| Web Components + webpack | `apps/web-components-webpack` | webpack 5 with `sass-loader`, browser smoke tests                                                                                                                                                                                                               |
| Sass                     | `apps/styles-sass`            | `@carbon/styles`, `@carbon/react`, `@carbon/elements`, grid, type, and every theme compile; custom `$prefix` is applied everywhere; Sass deprecations are reported                                                                                              |

## Running locally

Requires the Node version in `.nvmrc`. Yarn 4.10.3 is included in the repo;
Corepack is not required.

```sh
node .yarn/releases/yarn-4.10.3.cjs install --immutable
node .yarn/releases/yarn-4.10.3.cjs workspace @carbon-next-test/e2e playwright install chromium
node .yarn/releases/yarn-4.10.3.cjs test
```

`test` runs contracts, builds, unit tests, and end-to-end tests, stopping at the
first failure. Run one part at a time by replacing `test` in the command above
with `test:contract`, `build`, `test:unit`, or `test:e2e`. Prefix the end-to-end
command with `APPS=react-vite,web-components-vite` to limit it to some apps.

To update the Carbon packages under test:

```sh
node scripts/use-carbon.mjs --tag v12-alpha   # or --ref v12.0.0-alpha.5
node .yarn/releases/yarn-4.10.3.cjs install
```

## Choosing what to test

`scripts/use-carbon.mjs` writes `carbon-release.json` and the Yarn catalog in
`.yarnrc.yml`. Every workspace depends on Carbon through `catalog:`, so all
packages come from one release.

| Option                  | Tests                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `--tag v12-alpha`       | The version each package has under an npm dist-tag (default)                         |
| `--ref v12.0.0-alpha.5` | The versions in each `package.json` at an upstream git ref, which must all be on npm |
| `--tarballs <dir>`      | Unpublished `npm pack` output, for testing commits before they are released          |
| `--release <file>`      | A `carbon-release.json` from an earlier run, so CI jobs share one set                |
| `--react 18`            | React 18 instead of 19                                                               |

Only direct dependencies are pinned. Each package's own `@carbon/*` dependencies
resolve from the ranges it declares, as they would for a consumer, so a stale
range shows up as a duplicate install instead of being hidden. In `--tarballs`
mode, resolutions are required to reach unpublished versions, so the contract
tests check the declared ranges directly.

The packages under test are listed in `carbon.config.json`.

## Public API removals

The API diff fails when a release removes an export, custom element, attribute,
or Sass module that the previous release in the same prerelease line had.
Removals are expected in a major release, so acknowledge intended ones in
`api-changes.json`:

```json
{
  "@carbon/react": {
    "2.0.0-alpha.6": ["OldComponent"]
  }
}
```

Each run writes the full diff, including additions, to `reports/api-diff.md` and
the workflow summary.

## CI

On PRs and pushes to `main`, `.github/workflows/test.yml` tests the versions
saved in the repo. React 19 jobs install with `--immutable`, so the lockfile
must stay unchanged. The React 18 job uses the same Carbon package versions with
a separate React 18 install.

Manual runs can still select an npm tag or an upstream tag or commit.

When enabled in the official repo, `.github/workflows/update.yml` checks
`v12-alpha` hourly. It can also receive a `carbon-published` event or run
manually with a published alpha tag. It checks that all required packages are on
npm, then opens or updates one PR with `carbon-release.json`, `.yarnrc.yml`, and
`yarn.lock`. No update PR is needed when these files already match `main`.

For GitHub App setup, repository secrets, and upstream integration, see the
[developer handbook](docs/developer-handbook.md). These instructions are for
repository maintainers. You do not need a GitHub App or secrets to run the tests
locally.

## Consumer workarounds in the apps

These match v11 behavior and are configured the way a consumer would, so they do
not hide new problems:

- **Fonts with Next.js.** Turbopack cannot resolve the default
  `$font-path: '~@ibm/plex'`, so `apps/react-nextjs` sets
  `$use-akamai-cdn: true`. Vite leaves the URLs unresolved with a warning, and
  the end-to-end tests ignore font requests.
- **jsdom.** `apps/react-vite/src/setup-tests.ts` stubs `ResizeObserver`,
  `IntersectionObserver`, and `matchMedia`, which jsdom lacks and several
  components call when they mount.
- **Custom `$prefix`.** `--cds-grid-*`, `--cds-layer`, and
  `--cds-ai-border-start`/`-end` ignore `$prefix` in v11 too. The Sass build
  only fails on other names.
- **`skipLibCheck`.** The TypeScript apps use `skipLibCheck: true`, as most
  projects do. The `@carbon/react` declarations import `prop-types` without a
  dependency on `@types/prop-types`.

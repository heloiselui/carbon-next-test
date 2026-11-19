# Developer handbook

This guide is for the people who maintain
`carbon-design-system/carbon-next-test`. It covers GitHub App setup, repository
secrets, and the connection to Carbon release workflows.

To install dependencies and run the tests locally, follow the
[README](../README.md).

## Automatic dependency updates

The update job runs only in `carbon-design-system/carbon-next-test` when
`ENABLE_DEPENDENCY_UPDATES` is `true`. These steps are for that repo:

1. Install the Carbon GitHub App with **Contents: write** and **Pull requests:
   write** permissions.
2. Add `APP_ID` and `APP_PRIVATE_KEY` as GitHub Actions repository secrets.
3. Add `ENABLE_DEPENDENCY_UPDATES` as a GitHub Actions repository variable and
   set it to `true`. This enables scheduled, manual, and release-event updates.
4. Run **Update Carbon** manually. Leave `ref` empty to use `v12-alpha`, or
   enter a published tag such as `v12.0.0-alpha.10`.

The job checks out `main`, checks that all required package versions are on npm,
and updates the catalog and lockfile. It opens or updates a PR from
`chore/update-carbon-alpha` to `main`. If there is no change, no new PR is
needed. The App token lets tests run when the update PR is opened or updated.

Once you have checked that CI works, add `Report` as a required check in the
rules for `main`. This blocks merging while that check fails.

Secrets:

| Secret              | Used for                                                      |
| ------------------- | ------------------------------------------------------------- |
| `APP_ID`            | Required for automatic updates. Carbon GitHub App ID          |
| `APP_PRIVATE_KEY`   | Required for automatic updates. Carbon GitHub App private key |
| `SLACK_WEBHOOK_URL` | Optional. Posts failures to Slack                             |

## Optional notifications

Slack notifications are off unless `ENABLE_SLACK_NOTIFICATIONS` is `true`. To
enable them, add that repository variable and the `SLACK_WEBHOOK_URL` secret.
The test workflow sends failure notices for pushes to `main` and manual runs in
the official repo. It does not send notices for PR runs.

Leave `ENABLE_UPSTREAM_STATUS` unset. Posting a commit status back to Carbon is
not connected to the current workflow triggers. `CARBON_REPO_TOKEN` is not
needed for the current flow.

## Connecting upstream

The update workflow accepts `carbon-published` events when updates are enabled.
Carbon must send this event after the alpha packages are published. The hourly
check also finds releases without this event.

### After each release

Add these steps to the end of the `build` job in upstream
`.github/workflows/release.yml`, after `Publish packages`. They need the GitHub
App already used upstream to be installed on this repository.

```yaml
- name: Generate token for carbon-next-test
  if: env.DIST_TAG == 'v12-alpha'
  id: next_test_token
  uses: actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510 # v3.3.0
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    repositories: carbon-next-test

- name: Request a dependency update
  if: env.DIST_TAG == 'v12-alpha'
  env:
    GH_TOKEN: ${{ steps.next_test_token.outputs.token }}
  run: |
    gh api repos/carbon-design-system/carbon-next-test/dispatches \
      -f event_type=carbon-published \
      -f "client_payload[ref]=${{ github.ref_name }}" \
      -f "client_payload[sha]=${{ github.sha }}"
```

### Published and unpublished commits

When package changes on `next` produce an alpha release, `next-release.yml`
creates the tag and `release.yml` publishes the packages. The same
`carbon-published` event can request an update after publication succeeds.

For unpublished packages, run the tests locally with `--tarballs <dir>` and
`--git-ref <source-tag-or-commit>`. Follow the
[README](../README.md#running-locally) for installation and test commands. The
current workflows do not accept a `carbon-tarballs` event or download tarballs
from an upstream workflow run.

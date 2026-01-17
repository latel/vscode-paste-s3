# Changeset Workflow

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and releases.

## How it works

1. **Adding Changes**: When you make changes that should be included in a release, create a changeset:
   ```bash
   yarn changeset
   ```
   This will prompt you to describe the changes and select the type of version bump (patch, minor, or major).

2. **Version Bumping**: When changesets are merged to the master branch, a GitHub Action will automatically:
   - Create or update a "Version Packages" PR
   - Update `package.json` with the new version
   - Update `CHANGELOG.md` with the changes

3. **Publishing**: When the version bump PR is merged to master:
   - The changeset-publish workflow detects the version change in `package.json`
   - Automatically runs the build, test, and publish steps
   - Publishes the extension to VSCode Marketplace and Open VSX Registry

## Manual Release

You can also manually trigger a release by merging the "Version Packages" PR or by updating the version in `package.json` directly.

## Commands

- `yarn changeset` - Create a new changeset
- `yarn changeset:version` - Apply changesets and bump version (done automatically by CI)
- `yarn changeset:publish` - Publish packages (done automatically by CI)

## Workflow Files

- `.github/workflows/changeset-version.yml` - Creates version bump PRs
- `.github/workflows/changeset-publish.yml` - Publishes when version changes on master
- `.github/workflows/release.yml` - Manual/tag-based publishing (kept for compatibility)

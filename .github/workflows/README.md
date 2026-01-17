# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated CI/CD.

## Workflows

### CI Workflow (`ci.yml`)

Runs on every push to `master`/`main` branches and on pull requests.

**Steps:**
1. Checkout code
2. Setup Node.js and install dependencies
3. Run linter
4. Build the extension
5. Run tests
6. Upload build artifacts

### Changeset Version Workflow (`changeset-version.yml`)

**NEW** Automated version management using changesets.

**Triggers:**
- When changeset files (`.changeset/*.md`) are pushed to master
- Manually via workflow dispatch

**What it does:**
1. Detects new changeset files
2. Creates or updates a "Version Packages" PR
3. Applies version bumps and updates CHANGELOG.md
4. Merging this PR will trigger the publish workflow

### Changeset Release Workflow (`changeset-publish.yml`)

**NEW** Automatically publishes when version changes are merged to master.

**Triggers:**
- When `package.json` is modified on master branch

**What it does:**
1. Detects if the version number changed
2. If changed, automatically builds, tests, and publishes
3. Publishes to both VSCode Marketplace and Open VSX Registry

**Benefits:**
- No manual release creation needed
- Automatic publishing when version bumps are merged
- Integrated with changeset workflow

### Release Workflow (`release.yml`)

Publishes the extension to VSCode Marketplace and Open VSX Registry.

**Triggers:**
- Automatically when a GitHub release is published
- Manually via workflow dispatch

**Steps:**
1. Checkout code
2. Setup Node.js and install dependencies
3. Run linter and tests
4. Build and package the extension
5. Publish to VSCode Marketplace
6. Publish to Open VSX Registry (optional)
7. Upload VSIX as artifact

## Setup Instructions

### Required Secrets

Configure the following secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

#### VSCE_TOKEN (Required)

Personal Access Token for publishing to VSCode Marketplace.

**How to obtain:**
1. Go to https://dev.azure.com/
2. Sign in with your Microsoft account
3. Click on your profile icon → Security
4. Click "New Token" under Personal Access Tokens
5. Configure the token:
   - Name: VSCode Marketplace Publishing
   - Organization: All accessible organizations
   - Expiration: Choose appropriate duration
   - Scopes: Select "Marketplace" → "Manage"
6. Copy the generated token
7. Add it as `VSCE_TOKEN` in GitHub repository secrets

#### OVSX_TOKEN (Optional)

Personal Access Token for publishing to Open VSX Registry.

**How to obtain:**
1. Go to https://open-vsx.org/
2. Sign in with your GitHub account
3. Click on your profile → Access Tokens
4. Click "New Access Token"
5. Copy the generated token
6. Add it as `OVSX_TOKEN` in GitHub repository secrets

### Publishing a Release

**Option 1: Using Changesets (Recommended for ongoing development)**
1. Create a changeset for your changes:
   ```bash
   yarn changeset
   ```
2. Follow the prompts to select version bump type and describe changes
3. Commit the changeset file (`.changeset/*.md`)
4. Push to master branch
5. The `changeset-version.yml` workflow will create a "Version Packages" PR
6. Review and merge the PR
7. The `changeset-publish.yml` workflow will automatically publish

**Option 2: Via GitHub Release (Traditional method)**
1. Create a new tag: `git tag v0.x.x`
2. Push the tag: `git push origin v0.x.x`
3. Go to GitHub repository → Releases → Draft a new release
4. Select the tag you just created
5. Write release notes
6. Click "Publish release"
7. The workflow will automatically trigger and publish the extension

**Option 3: Via Manual Workflow Dispatch**
1. Go to Actions → "Publish to VSCode Marketplace"
2. Click "Run workflow"
3. Select the branch
4. Optionally specify a version
5. Click "Run workflow"

### Version Management

**With Changesets (Recommended):**

This project now uses [Changesets](https://github.com/changesets/changesets) for version management.

1. **Creating a changeset:**
   ```bash
   yarn changeset
   ```
   This will prompt you to:
   - Select the type of version bump (patch/minor/major)
   - Describe the changes

2. **The changeset file:**
   - A markdown file is created in `.changeset/`
   - Commit this file with your changes
   - Multiple changesets can accumulate before a release

3. **Version bumping:**
   - When changesets are merged to master, a PR is automatically created
   - The PR updates `package.json` and `CHANGELOG.md`
   - Merging this PR automatically publishes the extension

See [CHANGESET_WORKFLOW.md](../../docs/CHANGESET_WORKFLOW.md) for detailed information.

**Manual Version Management (Legacy):**

The extension version is defined in `package.json`. Make sure to:
1. Update the version number before creating a release
2. Follow semantic versioning (MAJOR.MINOR.PATCH)
3. Update CHANGELOG.md with release notes

### Testing Locally

Before pushing, you can test the build locally:

```bash
# Install dependencies
yarn install

# Run linter
yarn run lint

# Build the extension
yarn run package

# Run tests
yarn test

# Package the extension
yarn vsce package
```

## Troubleshooting

### Build Failures

- Check that all dependencies are properly installed
- Verify that the build passes locally
- Check the workflow logs for specific error messages

### Publishing Failures

- Verify that `VSCE_TOKEN` is correctly set in repository secrets
- Check that the token has not expired
- Ensure the version in `package.json` is higher than the published version
- Check the marketplace for any policy violations

### Test Failures

- Tests run in a headless environment using `xvfb-run`
- Ensure tests don't require interactive elements
- Check test logs for specific failures

## Additional Resources

- [VSCode Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Open VSX Registry](https://open-vsx.org/)

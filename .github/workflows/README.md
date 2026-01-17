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

**Option 1: Via GitHub Release (Recommended)**
1. Create a new tag: `git tag v0.x.x`
2. Push the tag: `git push origin v0.x.x`
3. Go to GitHub repository → Releases → Draft a new release
4. Select the tag you just created
5. Write release notes
6. Click "Publish release"
7. The workflow will automatically trigger and publish the extension

**Option 2: Via Manual Workflow Dispatch**
1. Go to Actions → "Publish to VSCode Marketplace"
2. Click "Run workflow"
3. Select the branch
4. Optionally specify a version
5. Click "Run workflow"

### Version Management

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

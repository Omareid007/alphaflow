# GitHub Actions Workflows

This directory contains CI/CD workflows for the AlphaFlow Trading Platform.

## Available Workflows

### 1. `ci.yml` - Main CI Pipeline

**Purpose**: Runs code quality checks, builds, security audits, and tests.

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs**:
- Code quality (TypeScript, ESLint, Prettier)
- Build verification
- Security audit
- Test execution

### 2. `openspec-ci.yml` - OpenSpec Validation & Automation

**Purpose**: Validates OpenSpec specifications, checks API coverage, generates metrics, and auto-generates OpenAPI documentation.

**Triggers**:
- Push to `main` branch
- Pull requests
- Changes to `openspec/**` or `server/routes/**` files
- Manual workflow dispatch

**Jobs**:

#### Job 1: Validate OpenSpec
Validates all OpenSpec specifications using strict mode:
```bash
openspec validate --specs --strict
openspec validate --changes --strict  # PRs only
```

**Validation checks**:
- Specification syntax correctness
- Schema validation
- Requirements completeness
- Scenario validity

**Outputs**: Validation report artifact

#### Job 2: Check API Coverage
Analyzes API documentation coverage:

**Metrics calculated**:
- Total endpoints in codebase
- Documented endpoints in OpenSpec
- Coverage percentage
- Per-module breakdown

**Coverage threshold**: 60% minimum (warning if below)

**Counting logic**:
```bash
# OpenSpec endpoints
grep -E "^\s*(GET|POST|PUT|DELETE|PATCH)\s+" openspec/specs/*/spec.md

# Actual route endpoints
grep -rh "router\.(get|post|put|delete|patch)" server/routes/*.ts
```

**Outputs**: Coverage report artifact

#### Job 3: Generate Metrics
Generates comprehensive metrics and badges:

**Metrics collected**:
- Requirements count
- Scenarios count
- Coverage percentage
- Endpoint counts

**Badge generation**:
- Color-coded by coverage level:
  - Green (≥80%): `brightgreen`
  - Yellow (≥60%): `yellow`
  - Red (<60%): `red`

**Outputs**: Metrics summary with badge URLs

#### Job 4: Post PR Comment
Posts automated comment on pull requests with:
- Validation status
- Coverage metrics
- Badge preview
- Links to detailed reports

#### Job 5: Auto-generate OpenAPI
Automatically generates OpenAPI specification (if generator exists):

**Process**:
1. Checks for `scripts/generate-openapi.ts` or `.js`
2. Runs generator script
3. Validates generated OpenAPI spec using `@ibm/openapi-validator`
4. Commits changes if modified (with `[skip ci]` tag)

**Outputs**: Generated OpenAPI specification artifact

#### Job 6: Summary
Provides comprehensive workflow summary in GitHub Actions UI.

**Usage**:

```yaml
# Manual trigger
gh workflow run openspec-ci.yml

# Check status
gh run list --workflow=openspec-ci.yml

# View latest run
gh run view --workflow=openspec-ci.yml
```

**Configuration**:

No additional configuration required. The workflow automatically:
- Detects OpenSpec directory structure
- Counts endpoints from route files
- Generates appropriate badges
- Handles missing generator scripts gracefully

**Best Practices**:

1. **Keep specs in sync**: Update OpenSpec when adding/modifying endpoints
2. **Maintain coverage**: Aim for >80% API coverage
3. **Review PR comments**: Check coverage impact of changes
4. **Fix validation errors**: Don't merge PRs with failing validations
5. **Use strict mode**: Catch issues early in development

### 3. `api-docs-deploy.yml` - API Documentation Deployment

**Purpose**: Deploys Swagger UI with OpenAPI specification to production environments.

**Triggers**:
- Push to `main` branch (changes to `docs/api/**` or `openspec/**`)
- Manual workflow dispatch with environment selection
- Successful completion of `openspec-ci.yml`

**Jobs**:

#### Job 1: Build Swagger UI
Builds complete Swagger UI distribution:

**Process**:
1. Checks for OpenAPI specification (`openapi.json`, `openapi.yaml`, or `openapi.yml`)
2. Validates OpenAPI spec using `@ibm/openapi-validator`
3. Downloads Swagger UI v5.11.0
4. Configures Swagger UI with custom branding
5. Applies custom styles (including dark mode)
6. Generates API metadata

**Custom features**:
- AlphaFlow branding
- Dark mode support
- Custom color scheme
- Persistent authorization
- Try-it-out enabled by default
- Filter and search enabled

**Outputs**: Complete Swagger UI artifact

#### Job 2: Deploy to GitHub Pages
Deploys to GitHub Pages (primary deployment target):

**Configuration**:
- Uses `actions/deploy-pages@v4`
- Enables GitHub Pages in repository settings
- Sets custom domain if configured

**Deployment URL**: `https://<owner>.github.io/<repo>/api-docs`

#### Job 3: Deploy to S3 (Optional)
Deploys to AWS S3 bucket if configured:

**Requirements**:
- `AWS_S3_BUCKET` variable set
- `DEPLOY_TO_S3` variable set to `true`
- AWS credentials in secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`

**Features**:
- Syncs files to S3 with `--delete` flag
- Sets cache headers (`max-age=3600`)
- Invalidates CloudFront cache (if configured)

**Configuration**:
```yaml
# Repository variables
AWS_S3_BUCKET: "your-bucket-name"
AWS_REGION: "us-east-1"
AWS_CLOUDFRONT_DISTRIBUTION_ID: "E1234567890ABC"  # Optional
DEPLOY_TO_S3: "true"

# Repository secrets
AWS_ACCESS_KEY_ID: "AKIA..."
AWS_SECRET_ACCESS_KEY: "..."
```

#### Job 4: Verify Deployment
Verifies successful deployment:

**Checks**:
1. HTTP 200 status on deployment URL
2. OpenAPI spec accessibility
3. Required Swagger UI assets present:
   - `swagger-ui.css`
   - `swagger-ui-bundle.js`
   - `swagger-ui-standalone-preset.js`

**Failure handling**: Triggers rollback on verification failure

#### Job 5: Notify Deployment Status
Generates comprehensive deployment summary:

**Summary includes**:
- Deployment status by job
- Deployment URL
- Environment details
- Deployment badge

#### Job 6: Rollback on Failure (Optional)
Automatically rolls back to previous version on failure:

**Trigger**: Deployment verification fails on `main` branch

**Process**:
1. Checks out previous commit
2. Initiates redeployment
3. Notifies team of rollback

**Usage**:

```bash
# Manual deployment (production)
gh workflow run api-docs-deploy.yml

# Deploy to staging
gh workflow run api-docs-deploy.yml -f environment=staging

# Check deployment status
gh run list --workflow=api-docs-deploy.yml

# View deployment URL
gh run view --workflow=api-docs-deploy.yml
```

**Setup Requirements**:

1. **Enable GitHub Pages**:
   - Settings → Pages
   - Source: GitHub Actions
   - Custom domain (optional)

2. **Configure AWS (optional)**:
   ```bash
   # Set repository variables
   gh variable set AWS_S3_BUCKET --body "your-bucket-name"
   gh variable set AWS_REGION --body "us-east-1"
   gh variable set DEPLOY_TO_S3 --body "true"

   # Set repository secrets
   gh secret set AWS_ACCESS_KEY_ID --body "AKIA..."
   gh secret set AWS_SECRET_ACCESS_KEY --body "..."
   ```

3. **OpenAPI Specification**:
   - Ensure `docs/api/openapi.json` or `openapi.yaml` exists
   - Run `openspec-ci.yml` to auto-generate if needed

**Customization**:

**Branding**: Edit custom styles in workflow:
```yaml
- name: Create custom styles
  run: |
    cd swagger-ui
    # Modify custom.css content
```

**Configuration**: Edit Swagger UI config:
```yaml
- name: Configure Swagger UI
  run: |
    cd swagger-ui
    # Modify index.html SwaggerUIBundle options
```

**Deployment targets**: Add additional deployment jobs:
```yaml
deploy-to-netlify:
  name: Deploy to Netlify
  runs-on: ubuntu-latest
  needs: build-swagger-ui
  steps:
    # Add Netlify deployment steps
```

### 4. `deploy.yml` - Application Deployment

**Purpose**: Deploys the main application to production.

**Triggers**:
- Push to `main` branch
- Manual workflow dispatch

## Workflow Dependencies

```
openspec-ci.yml
    ↓ (on success)
api-docs-deploy.yml
```

## Best Practices

### For `openspec-ci.yml`

1. **Always validate before merging**:
   ```bash
   openspec validate --specs --strict
   ```

2. **Monitor coverage trends**: Check PR comments for coverage changes

3. **Fix validation errors immediately**: Don't accumulate technical debt

4. **Keep specs synchronized**: Update OpenSpec when changing routes

5. **Review generated OpenAPI**: Verify auto-generation accuracy

### For `api-docs-deploy.yml`

1. **Test locally before deploying**:
   ```bash
   # Serve Swagger UI locally
   npx serve swagger-ui
   ```

2. **Verify OpenAPI spec validity**:
   ```bash
   npx @ibm/openapi-validator docs/api/openapi.json
   ```

3. **Check deployment URL accessibility**: Test from different networks

4. **Monitor CloudFront invalidation**: Ensure cache is cleared (if using AWS)

5. **Use staging environment**: Test deployments before production

## Common Issues

### OpenSpec CI

**Issue**: Validation fails with "spec not found"
**Solution**: Ensure `openspec/specs/*/spec.md` files exist

**Issue**: Coverage below threshold
**Solution**: Add missing endpoint documentation to OpenSpec

**Issue**: OpenAPI auto-generation fails
**Solution**: Check `scripts/generate-openapi.ts` exists and runs correctly

### API Docs Deploy

**Issue**: GitHub Pages deployment fails
**Solution**: Enable GitHub Pages in repository settings

**Issue**: Swagger UI shows "Failed to load API definition"
**Solution**: Verify OpenAPI spec is valid and accessible

**Issue**: S3 deployment fails
**Solution**: Check AWS credentials and bucket configuration

**Issue**: CloudFront invalidation fails
**Solution**: Verify distribution ID is correct

## Monitoring

### Key Metrics to Track

1. **OpenSpec validation success rate**: Should be 100%
2. **API coverage percentage**: Target >80%
3. **Deployment success rate**: Should be >95%
4. **Deployment time**: Track for performance optimization

### Alerts to Configure

1. **Validation failures**: Alert on any validation errors
2. **Coverage drops**: Alert if coverage decreases >5%
3. **Deployment failures**: Alert on failed deployments
4. **Long-running workflows**: Alert if >10 minutes

## Security Considerations

1. **Secrets management**: Use GitHub Secrets for sensitive data
2. **Permission scope**: Limit workflow permissions to minimum required
3. **Dependency pinning**: Pin action versions (e.g., `@v4` not `@latest`)
4. **OpenAPI exposure**: Ensure no sensitive data in OpenAPI spec
5. **AWS credentials**: Use IAM roles with least privilege

## Maintenance

### Regular Updates

1. **Update Swagger UI version**: Check for updates quarterly
2. **Update GitHub Actions**: Keep actions up to date
3. **Review coverage threshold**: Adjust based on team capacity
4. **Optimize workflow performance**: Reduce redundant steps

### Quarterly Review

1. Check workflow efficiency
2. Review coverage trends
3. Update documentation
4. Optimize deployment process
5. Review security settings

## Support

For workflow issues:
1. Check GitHub Actions logs
2. Review this documentation
3. Contact DevOps team
4. Open issue in repository

## References

- [OpenSpec Documentation](https://github.com/bjsi/openspec)
- [Swagger UI Documentation](https://swagger.io/docs/open-source-tools/swagger-ui/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [OpenAPI Specification](https://swagger.io/specification/)

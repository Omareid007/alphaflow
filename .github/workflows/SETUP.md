# GitHub Actions Workflows Setup Guide

This guide walks through setting up the OpenSpec CI and API Documentation deployment workflows.

## Prerequisites

- GitHub repository with admin access
- OpenSpec installed locally (`npm install -g @bjsi/openspec`)
- OpenAPI specification (or ability to generate one)
- Node.js 20+ installed

## Quick Start

### 1. Enable GitHub Actions

```bash
# Workflows are automatically enabled when you commit them
git add .github/workflows/
git commit -m "chore: add OpenSpec CI and API Docs deployment workflows"
git push
```

### 2. Enable GitHub Pages

**Via GitHub UI**:
1. Go to repository Settings → Pages
2. Source: Select "GitHub Actions"
3. (Optional) Add custom domain

**Via GitHub CLI**:
```bash
# Enable GitHub Pages with GitHub Actions source
gh api repos/{owner}/{repo}/pages \
  --method POST \
  -f source[branch]=main \
  -f source[path]=/
```

### 3. Configure Repository Variables (Optional)

#### For AWS S3 Deployment:

```bash
# Set repository variables
gh variable set AWS_S3_BUCKET --body "your-api-docs-bucket"
gh variable set AWS_REGION --body "us-east-1"
gh variable set DEPLOY_TO_S3 --body "true"

# Set repository secrets
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY

# Optional: CloudFront distribution
gh variable set AWS_CLOUDFRONT_DISTRIBUTION_ID --body "E1234567890ABC"
```

## OpenSpec CI Setup

### Step 1: Verify OpenSpec Directory Structure

```bash
# Your directory structure should look like:
openspec/
├── project.md
├── AGENTS.md
├── specs/
│   ├── authentication/
│   │   └── spec.md
│   ├── trading-orders/
│   │   └── spec.md
│   ├── portfolio-management/
│   │   └── spec.md
│   └── ... (other modules)
└── changes/
    └── ... (change logs)
```

### Step 2: Validate Locally

```bash
# Validate all specs
openspec validate --specs --strict

# Validate changes (for PRs)
openspec validate --changes --strict
```

### Step 3: Test Coverage Calculation

```bash
# Count OpenSpec endpoints
find openspec/specs -name "spec.md" -exec grep -E "^\s*(GET|POST|PUT|DELETE|PATCH)\s+" {} \; | wc -l

# Count actual route endpoints
grep -rh "router\.(get|post|put|delete|patch)" server/routes/*.ts | wc -l

# Calculate coverage percentage
echo "scale=2; (openspec_count / route_count) * 100" | bc
```

### Step 4: Create OpenAPI Generator (Optional)

If you want auto-generation, create `scripts/generate-openapi.ts`:

```typescript
#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';

// Your OpenAPI generation logic here
// This should parse your OpenSpec specs and route files
// to generate a complete OpenAPI specification

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'AlphaFlow Trading Platform API',
    version: '1.0.0',
    description: 'API for algorithmic trading platform',
  },
  servers: [
    {
      url: 'https://api.alphaflow-trading.com',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  paths: {
    // Generated from OpenSpec specs
  },
  components: {
    // Generated from schema files
  },
};

// Write to file
const outputPath = path.join(process.cwd(), 'docs/api/openapi.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));

console.log('✅ OpenAPI specification generated');
```

Add to `package.json`:
```json
{
  "scripts": {
    "generate:openapi": "tsx scripts/generate-openapi.ts"
  }
}
```

### Step 5: Test Workflow Locally (Using act)

```bash
# Install act (GitHub Actions local runner)
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run OpenSpec CI workflow locally
act push -W .github/workflows/openspec-ci.yml

# Run with specific event
act pull_request -W .github/workflows/openspec-ci.yml
```

## API Docs Deployment Setup

### Step 1: Ensure OpenAPI Spec Exists

```bash
# Create docs/api directory
mkdir -p docs/api

# Option 1: Copy existing spec
cp your-openapi-spec.json docs/api/openapi.json

# Option 2: Generate from OpenSpec
npm run generate:openapi

# Validate the spec
npx @ibm/openapi-validator docs/api/openapi.json
```

### Step 2: Test Swagger UI Locally

```bash
# Download Swagger UI
curl -L "https://github.com/swagger-api/swagger-ui/archive/v5.11.0.tar.gz" | tar xz
cp -r swagger-ui-5.11.0/dist/* swagger-ui/

# Copy your OpenAPI spec
cp docs/api/openapi.json swagger-ui/

# Serve locally
npx serve swagger-ui

# Open http://localhost:3000 in browser
```

### Step 3: Configure Custom Branding (Optional)

Edit the workflow to customize Swagger UI appearance:

```yaml
- name: Create custom styles
  run: |
    cd swagger-ui
    cat > custom.css << 'EOF'
    /* Your custom styles */
    .swagger-ui .topbar {
      background-color: #your-brand-color;
    }
    EOF
```

### Step 4: Set Up AWS S3 (Optional)

#### Create S3 Bucket:

```bash
# Create bucket
aws s3 mb s3://your-api-docs-bucket --region us-east-1

# Configure bucket for static hosting
aws s3 website s3://your-api-docs-bucket \
  --index-document index.html \
  --error-document index.html

# Set bucket policy for public read
cat > bucket-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-api-docs-bucket/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket your-api-docs-bucket \
  --policy file://bucket-policy.json
```

#### Create IAM User for Deployment:

```bash
# Create deployment user
aws iam create-user --user-name github-actions-api-docs

# Attach policy
cat > deployment-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-api-docs-bucket",
        "arn:aws:s3:::your-api-docs-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::*:distribution/*"
    }
  ]
}
EOF

aws iam put-user-policy \
  --user-name github-actions-api-docs \
  --policy-name S3DeploymentPolicy \
  --policy-document file://deployment-policy.json

# Create access key
aws iam create-access-key --user-name github-actions-api-docs
```

#### Set Up CloudFront (Optional):

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name your-api-docs-bucket.s3-website-us-east-1.amazonaws.com \
  --default-root-object index.html

# Note the distribution ID for GitHub variable
```

## Workflow Triggers

### OpenSpec CI

**Automatic triggers**:
- Push to `main` (if `openspec/**` or `server/routes/**` changed)
- Pull requests (if `openspec/**` or `server/routes/**` changed)

**Manual trigger**:
```bash
gh workflow run openspec-ci.yml
```

### API Docs Deploy

**Automatic triggers**:
- Push to `main` (if `docs/api/**` or `openspec/**` changed)
- After successful `openspec-ci.yml` completion

**Manual trigger**:
```bash
# Production deployment
gh workflow run api-docs-deploy.yml

# Staging deployment
gh workflow run api-docs-deploy.yml -f environment=staging
```

## Verification

### Check Workflow Status

```bash
# List recent runs
gh run list --workflow=openspec-ci.yml

# View specific run
gh run view <run-id>

# Watch run in real-time
gh run watch <run-id>
```

### Verify OpenSpec Validation

```bash
# Check validation status
gh run view --workflow=openspec-ci.yml --json conclusion,jobs

# Download validation report
gh run download <run-id> --name validation-report
```

### Verify API Docs Deployment

```bash
# Check deployment status
gh run view --workflow=api-docs-deploy.yml --json conclusion

# Get deployment URL
gh api repos/{owner}/{repo}/pages | jq -r '.html_url'
```

### Access Deployed Documentation

```bash
# GitHub Pages URL (default)
open "https://<owner>.github.io/<repo>/api-docs"

# S3 URL (if configured)
open "http://your-api-docs-bucket.s3-website-us-east-1.amazonaws.com"

# CloudFront URL (if configured)
open "https://d1234567890abc.cloudfront.net"
```

## Troubleshooting

### OpenSpec CI Issues

**Issue**: Workflow not triggering on push
```bash
# Check workflow file syntax
gh workflow view openspec-ci.yml

# Verify path filters
git log --oneline --name-only | grep -E "openspec/|server/routes/"
```

**Issue**: Validation failing
```bash
# Run validation locally
openspec validate --specs --strict

# Check specific spec
openspec validate --file openspec/specs/authentication/spec.md
```

**Issue**: Coverage calculation incorrect
```bash
# Manually count endpoints
find openspec/specs -name "spec.md" -exec grep -E "^\s*(GET|POST|PUT|DELETE|PATCH)\s+" {} \; | wc -l
grep -rh "router\.(get|post|put|delete|patch)" server/routes/*.ts | wc -l
```

### API Docs Deploy Issues

**Issue**: GitHub Pages deployment fails
```bash
# Check GitHub Pages status
gh api repos/{owner}/{repo}/pages

# Enable GitHub Pages
# Go to Settings → Pages → Source: GitHub Actions
```

**Issue**: Swagger UI not loading
```bash
# Verify OpenAPI spec is valid
npx @ibm/openapi-validator docs/api/openapi.json

# Check browser console for errors
# Verify spec URL is accessible
```

**Issue**: S3 deployment fails
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check bucket exists
aws s3 ls s3://your-api-docs-bucket

# Test upload manually
aws s3 cp docs/api/openapi.json s3://your-api-docs-bucket/
```

## Monitoring

### Set Up Workflow Notifications

```bash
# Watch workflow runs
gh workflow enable openspec-ci.yml
gh workflow enable api-docs-deploy.yml

# Configure email notifications
# Settings → Notifications → Actions
```

### Create Status Checks

Add to `.github/workflows/status-check.yml`:

```yaml
name: Status Check
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Check OpenSpec CI
        run: |
          STATUS=$(gh run list --workflow=openspec-ci.yml --limit 1 --json conclusion -q '.[0].conclusion')
          if [ "$STATUS" != "success" ]; then
            echo "::error::OpenSpec CI failing"
            exit 1
          fi
```

## Best Practices

1. **Always validate locally before pushing**
2. **Keep OpenSpec specs synchronized with code**
3. **Review coverage trends in PR comments**
4. **Test OpenAPI spec changes in Swagger UI locally**
5. **Monitor deployment success rate**
6. **Set up alerts for failures**

## Next Steps

1. [x] Enable GitHub Actions
2. [x] Enable GitHub Pages
3. [x] Configure AWS (optional)
4. [x] Create OpenAPI generator (optional)
5. [ ] Set up monitoring and alerts
6. [ ] Add custom branding
7. [ ] Configure CloudFront (optional)
8. [ ] Set up staging environment

## Support

- GitHub Actions logs: Check workflow runs for detailed error messages
- OpenSpec issues: https://github.com/bjsi/openspec/issues
- Swagger UI issues: https://github.com/swagger-api/swagger-ui/issues
- Internal support: Contact DevOps team

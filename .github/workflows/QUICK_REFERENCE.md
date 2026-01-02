# GitHub Actions Workflows - Quick Reference

## 🚀 Quick Start

```bash
# 1. Enable workflows
git add .github/workflows/
git commit -m "chore: add OpenSpec CI/CD workflows"
git push

# 2. Enable GitHub Pages
# Settings → Pages → Source: GitHub Actions

# 3. Run workflows
gh workflow run openspec-ci.yml
gh workflow run api-docs-deploy.yml
```

## 📋 Commands Cheat Sheet

### Workflow Management

```bash
# List all workflows
gh workflow list

# View workflow details
gh workflow view openspec-ci.yml

# Enable/disable workflow
gh workflow enable openspec-ci.yml
gh workflow disable openspec-ci.yml

# Run workflow manually
gh workflow run openspec-ci.yml
gh workflow run api-docs-deploy.yml -f environment=staging
```

### Run Management

```bash
# List recent runs
gh run list --workflow=openspec-ci.yml --limit 10

# View run details
gh run view <run-id>
gh run view --workflow=openspec-ci.yml

# Watch run in real-time
gh run watch <run-id>

# Download artifacts
gh run download <run-id>
gh run download <run-id> --name coverage-report

# Re-run failed jobs
gh run rerun <run-id>
gh run rerun <run-id> --failed
```

### OpenSpec Commands

```bash
# Validate all specs
openspec validate --specs --strict

# Validate changes only
openspec validate --changes --strict

# Validate specific file
openspec validate --file openspec/specs/authentication/spec.md
```

### Coverage Calculation

```bash
# Count OpenSpec endpoints
find openspec/specs -name "spec.md" -exec grep -E "^\s*(GET|POST|PUT|DELETE|PATCH)\s+" {} \; | wc -l

# Count route endpoints
grep -rh "router\.(get|post|put|delete|patch)" server/routes/*.ts | wc -l

# Calculate percentage
echo "scale=2; (openspec_count / route_count) * 100" | bc
```

### OpenAPI Management

```bash
# Generate OpenAPI spec
npm run generate:openapi

# Validate OpenAPI spec
npx @ibm/openapi-validator docs/api/openapi.json

# Test Swagger UI locally
npx serve swagger-ui
```

## 🔧 Configuration

### Repository Variables

```bash
# AWS S3 deployment
gh variable set AWS_S3_BUCKET --body "your-bucket-name"
gh variable set AWS_REGION --body "us-east-1"
gh variable set DEPLOY_TO_S3 --body "true"
gh variable set AWS_CLOUDFRONT_DISTRIBUTION_ID --body "E1234567890ABC"
```

### Repository Secrets

```bash
# AWS credentials
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY

# List secrets
gh secret list
```

### GitHub Pages

```bash
# Get Pages URL
gh api repos/{owner}/{repo}/pages | jq -r '.html_url'

# Check Pages status
gh api repos/{owner}/{repo}/pages
```

## 📊 Workflow Outputs

### OpenSpec CI

| Job | Outputs | Artifacts |
|-----|---------|-----------|
| validate-specs | `validation_status` | `validation-report` |
| check-coverage | `coverage_percentage`, `endpoints_total`, `endpoints_documented` | `coverage-report` |
| generate-metrics | `requirements`, `scenarios`, `badge_url` | `metrics-summary` |
| auto-generate-openapi | `generation_status`, `validation_status` | `openapi-spec` |

### API Docs Deploy

| Job | Outputs | Artifacts |
|-----|---------|-----------|
| build-swagger-ui | `spec_format`, `spec_found` | `swagger-ui` |
| deploy-to-github-pages | `deployment_url` | `swagger-ui` (uploaded to Pages) |
| verify-deployment | `deployment_status` | - |

## 🎯 Coverage Targets

| Level | Percentage | Badge Color | Status |
|-------|-----------|-------------|--------|
| Excellent | ≥80% | 🟢 Green | Recommended |
| Good | 60-79% | 🟡 Yellow | Acceptable |
| Needs Work | <60% | 🔴 Red | Warning |

## 🔍 Troubleshooting

### OpenSpec CI Fails

```bash
# Check validation errors
gh run view --workflow=openspec-ci.yml --log-failed

# Validate locally
openspec validate --specs --strict

# Check file syntax
cat openspec/specs/authentication/spec.md
```

### Coverage Below Threshold

```bash
# See which endpoints are missing
diff <(grep -rh "router\.(get|post|put|delete|patch)" server/routes/*.ts | sort) \
     <(find openspec/specs -name "spec.md" -exec grep -E "^\s*(GET|POST|PUT|DELETE|PATCH)\s+" {} \; | sort)

# Add missing endpoints to OpenSpec
# Edit openspec/specs/<module>/spec.md
```

### Deployment Fails

```bash
# Check deployment logs
gh run view --workflow=api-docs-deploy.yml --log-failed

# Verify OpenAPI spec
npx @ibm/openapi-validator docs/api/openapi.json

# Test Swagger UI locally
cd swagger-ui && npx serve .
```

### GitHub Pages Not Working

```bash
# Check Pages configuration
gh api repos/{owner}/{repo}/pages

# Enable Pages via UI
# Settings → Pages → Source: GitHub Actions

# Check deployment status
gh run list --workflow=api-docs-deploy.yml
```

## 📈 Monitoring

### Key Metrics Dashboard

```bash
# Get validation success rate
gh run list --workflow=openspec-ci.yml --limit 20 --json conclusion | \
  jq '[.[] | select(.conclusion == "success")] | length'

# Get average coverage
gh run download --pattern "coverage-report" && \
  grep "Coverage:" coverage-report/coverage-report.md

# Get deployment uptime
gh run list --workflow=api-docs-deploy.yml --limit 50 --json conclusion | \
  jq '[.[] | select(.conclusion == "success")] | length'
```

### Status Checks

```bash
# Check if workflows are passing
gh run list --workflow=openspec-ci.yml --limit 1 --json conclusion
gh run list --workflow=api-docs-deploy.yml --limit 1 --json conclusion

# Get latest coverage
gh run download $(gh run list --workflow=openspec-ci.yml --limit 1 --json databaseId -q '.[0].databaseId') \
  --name coverage-report
```

## 🎨 Badges

### Workflow Status Badges

```markdown
![OpenSpec CI](https://github.com/{owner}/{repo}/workflows/OpenSpec%20CI/badge.svg)
![API Docs Deploy](https://github.com/{owner}/{repo}/workflows/API%20Docs%20Deploy/badge.svg)
```

### Coverage Badges

```markdown
![API Coverage](https://img.shields.io/badge/API%20Coverage-{percentage}%25-{color})
```

Colors: `brightgreen` (≥80%), `yellow` (≥60%), `red` (<60%)

## 🔐 Security

### Secrets Required

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `AWS_ACCESS_KEY_ID` | AWS authentication | S3 deployment |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication | S3 deployment |

### Permissions Required

| Permission | Purpose | Workflow |
|------------|---------|----------|
| `contents: write` | Commit OpenAPI spec | OpenSpec CI |
| `pull-requests: write` | Post PR comments | OpenSpec CI |
| `pages: write` | Deploy to GitHub Pages | API Docs Deploy |
| `id-token: write` | OIDC authentication | API Docs Deploy |

## 📁 File Structure

```
.github/workflows/
├── openspec-ci.yml              # OpenSpec validation workflow
├── api-docs-deploy.yml          # API documentation deployment
├── ci.yml                       # Main CI pipeline
├── deploy.yml                   # Application deployment
├── README.md                    # Comprehensive documentation
├── SETUP.md                     # Setup instructions
├── IMPLEMENTATION_SUMMARY.md   # Implementation details
└── QUICK_REFERENCE.md          # This file
```

## 🌐 URLs

### GitHub Pages
```
https://{owner}.github.io/{repo}/api-docs
```

### S3 (if configured)
```
http://{bucket}.s3-website-{region}.amazonaws.com
```

### CloudFront (if configured)
```
https://{distribution-id}.cloudfront.net
```

## 📞 Support

| Issue Type | Resource |
|------------|----------|
| Workflow errors | Check Actions logs |
| OpenSpec issues | [OpenSpec Docs](https://github.com/bjsi/openspec) |
| Swagger UI issues | [Swagger Docs](https://swagger.io/docs/) |
| GitHub Actions | [GH Actions Docs](https://docs.github.com/actions) |

## ⚡ Quick Fixes

### Fix failing validation
```bash
openspec validate --specs --strict
# Fix reported issues in spec.md files
git commit -m "fix: resolve OpenSpec validation errors"
```

### Force deployment
```bash
gh workflow run api-docs-deploy.yml
```

### Reset workflow
```bash
# Cancel running workflows
gh run cancel <run-id>

# Re-run from scratch
gh run rerun <run-id>
```

### Update coverage
```bash
# Add missing endpoints to OpenSpec
vim openspec/specs/<module>/spec.md
git commit -m "docs: add missing API endpoints to OpenSpec"
```

## 📝 Notes

- Workflows automatically trigger on push/PR to relevant paths
- Coverage threshold is 60% (configurable in workflow)
- OpenAPI auto-generation requires `scripts/generate-openapi.ts`
- S3 deployment is optional (configure via variables)
- Artifacts retained for 30 days (OpenAPI spec: 90 days)

---

**Quick Links**:
- [Full Documentation](.github/workflows/README.md)
- [Setup Guide](.github/workflows/SETUP.md)
- [Implementation Summary](.github/workflows/IMPLEMENTATION_SUMMARY.md)

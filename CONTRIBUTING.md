# Contributing Guide

## Version Management

### Current Version
- **v1.x.x** - Stable release on `master` branch
- **v2.x.x** - Next major version (in development)

### Branch Structure

```
master (v1.x.x)
  ├── develop (v2 development)
  │   ├── feature/v2-realtime-monitoring
  │   ├── feature/v2-ai-prediction
  │   └── feature/v2-advanced-alerts
  └── hotfix/v1-bugfixes
```

### Working on V2

1. **Create develop branch for V2:**
```bash
git checkout -b develop
git push -u origin develop
```

2. **Create feature branches from develop:**
```bash
git checkout develop
git checkout -b feature/v2-new-feature
# Work on feature
git add .
git commit -m "feat(v2): add new feature"
git push origin feature/v2-new-feature
```

3. **Merge to develop when ready:**
```bash
git checkout develop
git merge feature/v2-new-feature
git push origin develop
```

4. **Release V2:**
```bash
git checkout develop
git checkout -b release/v2.0.0
# Final testing and fixes
git checkout master
git merge release/v2.0.0
git tag -a v2.0.0 -m "Release version 2.0.0"
git push origin master --tags
```

## Version Tags

### Creating Tags
```bash
# For major release
git tag -a v2.0.0 -m "Major release: V2 with advanced features"

# For minor update
git tag -a v2.1.0 -m "Add new analysis metrics"

# For patch/bugfix
git tag -a v2.0.1 -m "Fix calculation bug"

# Push tags
git push origin --tags
```

### Viewing Versions
```bash
# List all versions
git tag -l

# Show specific version
git show v2.0.0

# Checkout specific version
git checkout tags/v2.0.0
```

## Maintaining Multiple Versions

### Supporting V1 while developing V2

1. **Keep V1 stable on master:**
   - Only critical fixes
   - No new features
   - Tag as v1.x.x

2. **Develop V2 on develop branch:**
   - All new features
   - Breaking changes allowed
   - Tag as v2.0.0-beta.x for testing

3. **Backport critical fixes:**
```bash
# Fix bug in V1
git checkout master
git checkout -b hotfix/v1.x.x-fix
# Fix the bug
git checkout master
git merge hotfix/v1.x.x-fix
git tag -a v1.2.1 -m "Fix: critical bug"

# Apply same fix to V2
git checkout develop
git cherry-pick <commit-hash>
```

## Release Notes Template

### Version 2.0.0
```markdown
# Release v2.0.0

## 🚀 New Features
- Real-time WebSocket monitoring
- AI-powered prediction engine
- Advanced alert system
- Multi-token portfolio tracking

## 💥 Breaking Changes
- Changed API response format
- New configuration structure
- Updated CLI commands

## 🐛 Bug Fixes
- Fixed memory leak in monitoring
- Corrected volume calculations

## 📦 Dependencies
- Updated axios to v2.0
- Added websocket library

## 📝 Migration Guide
See [MIGRATION.md](./MIGRATION.md) for upgrading from v1.x to v2.x
```

## Commit Message Convention

Use conventional commits for better versioning:

- `feat:` New feature (bumps MINOR)
- `fix:` Bug fix (bumps PATCH)
- `BREAKING CHANGE:` Breaking change (bumps MAJOR)
- `docs:` Documentation only
- `style:` Code style changes
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding tests
- `chore:` Maintenance tasks

### Examples:
```bash
git commit -m "feat(v2): add real-time monitoring"
git commit -m "fix: correct volume calculation"
git commit -m "BREAKING CHANGE: new API format"
```

## Version Roadmap

### V1.x (Current Stable)
- ✅ Basic token fetching
- ✅ Graduation prediction
- ✅ Volume analysis

### V2.0 (Planned)
- [ ] Real-time WebSocket updates
- [ ] AI prediction models
- [ ] Advanced alerts
- [ ] Portfolio tracking
- [ ] Historical data analysis
- [ ] Custom strategies

### V3.0 (Future)
- [ ] Mobile app
- [ ] Cloud sync
- [ ] Team collaboration
- [ ] Backtesting engine
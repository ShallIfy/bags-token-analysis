# Migration Guide

## Migrating from v1.x to v2.x

### Overview
Version 2.0 introduces significant improvements and some breaking changes. This guide will help you migrate smoothly.

### Breaking Changes

#### 1. Configuration Structure
**v1.x:**
```javascript
// Direct API calls
const url = 'https://datapi.jup.ag/v1/dev/stats/...';
```

**v2.x:**
```javascript
// Centralized config
const config = require('./config/settings.json');
const api = new BagsAPI(config);
```

#### 2. Response Format
**v1.x:**
```javascript
{
  tokens: [...],
  statistics: {...}
}
```

**v2.x:**
```javascript
{
  data: {
    tokens: [...],
    metadata: {...}
  },
  pagination: {...},
  timestamp: "..."
}
```

#### 3. Script Names
**v1.x:**
- `fetch-latest-tokens.js`
- `analyze-graduation-candidates.js`

**v2.x:**
- `bags fetch:latest`
- `bags analyze:graduation`

### Step-by-Step Migration

#### Step 1: Backup Your Data
```bash
# Backup v1 data
cp -r data/ data-v1-backup/
```

#### Step 2: Install V2
```bash
# Checkout v2
git fetch origin
git checkout v2.0.0

# Install new dependencies
npm install
```

#### Step 3: Update Configuration
Create new config file:
```json
{
  "version": "2.0.0",
  "api": {
    "baseUrl": "https://datapi.jup.ag",
    "timeout": 15000
  },
  "analysis": {
    "checkpoints": [5, 10, 15, 30, 60],
    "thresholds": {
      "min5": 134325,
      "min10": 227514,
      "min30": 458057
    }
  }
}
```

#### Step 4: Update Your Scripts
If you have custom scripts using v1 functions:

**v1.x custom script:**
```javascript
const { fetchLatestTokens } = require('./src/fetchers/fetch-latest-tokens');
fetchLatestTokens().then(data => {
  console.log(data.tokens);
});
```

**v2.x updated script:**
```javascript
const BagsAPI = require('bags-token-analysis');
const api = new BagsAPI();

api.tokens.fetchLatest({ hours: 1 }).then(result => {
  console.log(result.data.tokens);
});
```

### New Features in V2

#### 1. Real-time Monitoring
```javascript
// New in v2
const monitor = api.monitor.start({
  tokens: ['token1', 'token2'],
  interval: 1000,
  onUpdate: (data) => console.log(data)
});
```

#### 2. Advanced Filtering
```javascript
// New in v2
const tokens = await api.tokens.fetch({
  minVolume: 100000,
  maxAge: 60, // minutes
  graduated: false,
  sortBy: 'volume'
});
```

#### 3. Batch Analysis
```javascript
// New in v2
const results = await api.analyze.batch([
  'token1',
  'token2',
  'token3'
]);
```

### Data Migration

#### Converting v1 data to v2 format:
```javascript
// migration-script.js
const fs = require('fs');

// Read v1 data
const v1Data = JSON.parse(fs.readFileSync('data/old-file.json'));

// Convert to v2 format
const v2Data = {
  version: '2.0.0',
  data: {
    tokens: v1Data.tokens,
    metadata: {
      fetchedAt: v1Data.fetchedAt,
      totalTokens: v1Data.totalTokens
    }
  },
  pagination: {
    limit: 100,
    offset: 0,
    total: v1Data.totalTokens
  }
};

// Save v2 data
fs.writeFileSync('data/new-file.json', JSON.stringify(v2Data, null, 2));
```

### Rollback Plan

If you need to rollback to v1:
```bash
# Rollback to v1
git checkout v1.2.0

# Restore v1 data
rm -rf data/
mv data-v1-backup/ data/

# Reinstall v1 dependencies
npm install
```

### Common Issues

#### Issue 1: Module not found
```
Error: Cannot find module 'bags-token-analysis'
```
**Solution:** Run `npm install` after checking out v2

#### Issue 2: Invalid configuration
```
Error: Configuration version mismatch
```
**Solution:** Update your config file to v2 format

#### Issue 3: API rate limiting
```
Error: Too many requests
```
**Solution:** V2 includes built-in rate limiting. Adjust in config:
```json
{
  "rateLimiting": {
    "maxRequests": 10,
    "perSeconds": 1
  }
}
```

### Support

For migration support:
- Open an issue: https://github.com/ShallIfy/bags-token-analysis/issues
- Tag with: `migration` and `v2`

### Deprecation Timeline

- **v1.0.x** - Security updates only until March 2025
- **v1.1.x** - Bug fixes until June 2025
- **v1.2.x** - Current stable, support until December 2025
- **v2.0.x** - New features and full support
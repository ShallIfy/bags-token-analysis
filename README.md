# Bags.fm Token Analysis Suite

## Overview

Comprehensive toolkit for analyzing BAGS tokens on Solana blockchain, including graduation prediction, volume pattern analysis, and real-time token monitoring.

## Features

- 🚀 **Token Fetching**: Get latest tokens, filter by time range
- 📊 **Graduation Analysis**: Predict which tokens will graduate based on volume patterns
- 📈 **Volume Pattern Analysis**: Backtest graduated tokens to identify success patterns
- 🎯 **Real-time Monitoring**: Track tokens created in the last hour
- 💰 **Market Analysis**: Comprehensive statistics on market cap, liquidity, and holders

## Key Findings: Graduation Requirements

Based on analysis of graduated tokens, here are the critical thresholds:

### Minimum Volume Requirements
- **10 minutes**: $227,514 (80% of average)
- **30 minutes**: $458,057 (80% of average)
- **Velocity**: $13,360/minute sustained

### Average Graduation Pattern
- Total volume: **$447,013**
- Time to graduation: **47 minutes**
- Volume spikes needed: **6-9 times** (3x normal volume)

### Critical Checkpoints
| Time | Average Volume | Minimum (80%) |
|------|---------------|---------------|
| 5 min | $167,906 | $134,325 |
| 10 min | $284,392 | $227,514 |
| 30 min | $572,572 | $458,057 |
| 60 min | $805,011 | $644,009 |

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/bags-project.git
cd bags-project

# Install dependencies
npm install
```

## Environment Variables

No API keys required! This tool uses public Jupiter API endpoints.

Optional configuration:
```env
# Custom RPC endpoint (if needed)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

## Usage

### 1. Fetch Latest Tokens (Last Hour)

```bash
npm run fetch:latest
```

Fetches all tokens created in the last hour, sorted by creation time.

### 2. Analyze Graduation Candidates

```bash
npm run analyze:graduation
```

Analyzes non-graduated tokens and predicts which are likely to graduate based on:
- Volume momentum
- Price stability
- Buy pressure
- Market cap growth
- Holder count

### 3. Predict Graduation (Real-time)

```bash
npm run predict:graduation
```

Monitors tokens in real-time and alerts when they meet graduation thresholds.

### 4. Backtest Volume Patterns

```bash
npm run analyze:patterns
```

Analyzes graduated tokens to identify common volume patterns.

### 5. Fetch 1000 BAGS Tokens

```bash
npm run fetch:1000
```

Fetches up to 1000 BAGS tokens using pagination.

## Scripts

| Script | Description |
|--------|-------------|
| `fetch-latest-tokens.js` | Fetch tokens from last hour |
| `analyze-graduation-candidates.js` | Analyze tokens likely to graduate |
| `predict-graduation.js` | Real-time graduation prediction |
| `analyze-graduated-volume-patterns.js` | Backtest graduated tokens |
| `fetch-bags-1000.js` | Fetch 1000 tokens with pagination |

## API Endpoints

### Jupiter API
- Base URL: `https://datapi.jup.ag/v1/dev/stats`
- Token: `BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv`

### Candlestick Data
- URL: `https://datapi.jup.ag/v2/charts/{tokenId}`
- Parameters: `interval=1_MINUTE&candles=301&type=mcap&quote=usd`

## Graduation Probability Indicators

### High Probability (>80%)
- ✅ 10-min volume > $227,514
- ✅ 30-min volume > $458,057
- ✅ Sustained velocity > $13,360/minute
- ✅ Minimum 6 volume spikes
- ✅ Early momentum > $167K in first 5 minutes

### Medium Probability (50-80%)
- 10-min volume > $142,196
- 30-min volume > $286,286
- Velocity > $9,542/minute
- 3-5 volume spikes

### Low Probability (<50%)
- 10-min volume < $85,317
- 30-min volume < $171,771
- Velocity < $5,725/minute
- Less than 3 volume spikes

## Data Structure

### Token Object
```json
{
  "id": "token_address",
  "name": "Token Name",
  "symbol": "SYMBOL",
  "mcap": 50000,
  "liquidity": 10000,
  "holderCount": 100,
  "volume24h": 250000,
  "isGraduated": false,
  "createdAt": "2025-01-10T12:00:00Z"
}
```

## Trading Strategy

### Entry Signal
- 5-min volume > $150K with rising velocity
- Strong buy pressure (>60%)
- Increasing holder count

### Hold Signal
- Maintaining > $13K/minute velocity
- Consistent volume spikes
- Price stability with upward trend

### Exit Warning
- Velocity drops below $10K/minute after 30 min
- Volume declining for 3+ consecutive minutes
- Buy pressure < 40%

### Graduation Signal
- Cumulative volume > $450K
- Sustained momentum for 30+ minutes
- Market cap approaching graduation threshold

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Disclaimer

This tool is for educational and research purposes only. Always do your own research before making investment decisions. Cryptocurrency trading carries significant risk.

## Support

For issues or questions, please open an issue on GitHub or contact the maintainers.

---

**Note**: Keep your API keys and private keys secure. Never commit them to version control.
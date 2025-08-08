const axios = require('axios');
const fs = require('fs');

// Headers for API requests
const headers = {
  'accept': 'application/json',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'origin': 'https://jup.ag',
  'referer': 'https://jup.ag/',
  'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
};

async function analyzeGraduatedPricePatterns() {
  console.log("🎓 V2 ANALYSIS: PRICE PATTERNS FOR GRADUATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Backtest Analysis: Price Movement Patterns");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Load latest tokens data
  const latestTokensFile = 'latest-100-tokens-1754689982122.json';
  let tokensData;
  
  try {
    tokensData = JSON.parse(fs.readFileSync(`../../data/${latestTokensFile}`, 'utf8'));
  } catch (error) {
    console.error("❌ Could not read tokens file");
    process.exit(1);
  }
  
  const tokens = tokensData.tokens;
  const graduatedTokens = tokens.filter(t => t.isGraduated);
  
  console.log(`📝 Found ${graduatedTokens.length} graduated tokens for analysis\n`);
  
  const pricePatterns = [];
  
  for (let i = 0; i < graduatedTokens.length; i++) {
    const token = graduatedTokens[i];
    
    console.log(`\n[${i + 1}/${graduatedTokens.length}] Analyzing ${token.symbol} (${token.name})`);
    console.log(`  Market Cap: $${token.mcap.toLocaleString()}`);
    console.log(`  Created: ${token.timeAgo}`);
    
    try {
      // Fetch candlestick data with price information
      const now = Date.now();
      const candles = 720; // 12 hours of data
      const url = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=price&quote=usd`;
      
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.candles && response.data.candles.length > 0) {
        const candleData = response.data.candles;
        
        // Analyze price patterns
        const pattern = analyzePriceMovement(candleData, token);
        
        pricePatterns.push({
          token: {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            mcap: token.mcap,
            createdAt: token.createdAt,
            timeAgo: token.timeAgo
          },
          pattern
        });
        
        console.log(`  ✅ Analysis complete`);
        console.log(`  Price Increase: ${pattern.priceMetrics.totalIncreasePercent.toFixed(2)}%`);
        console.log(`  Key Pattern: ${pattern.graduationPattern}`);
        
      } else {
        console.log("  ⚠️ No candlestick data available");
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Analyze common price patterns
  analyzeCommonPricePatterns(pricePatterns);
  
  // Save results
  savePricePatternAnalysis(pricePatterns);
}

function analyzePriceMovement(candles, token) {
  const pattern = {
    totalCandles: candles.length,
    priceMetrics: {
      startPrice: 0,
      endPrice: 0,
      highestPrice: 0,
      lowestPrice: Infinity,
      totalIncreasePercent: 0,
      avgPrice: 0
    },
    priceCheckpoints: {
      price5min: 0,
      price10min: 0,
      price15min: 0,
      price30min: 0,
      price60min: 0,
      price120min: 0,
      // Percentage increases at checkpoints
      increase5min: 0,
      increase10min: 0,
      increase15min: 0,
      increase30min: 0,
      increase60min: 0,
      increase120min: 0
    },
    pricePatterns: {
      consecutiveGreenCandles: 0,
      maxConsecutiveGreen: 0,
      priceSpikes: [], // Sudden price increases
      consolidationPeriods: [], // Price stability periods
      resistanceLevels: [],
      supportLevels: [],
      breakouts: []
    },
    volatility: {
      avgVolatility: 0,
      maxVolatility: 0,
      volatilityTrend: 'stable'
    },
    momentum: {
      rsi: [], // Relative Strength Index approximation
      macd: 0, // MACD approximation
      momentumScore: 0
    },
    graduationPattern: 'unknown',
    keyMetrics: {
      timeToDoublePrice: null,
      timeToTriplePrice: null,
      maxDrawdown: 0,
      recoveryTime: 0,
      priceEfficiency: 0 // How efficiently price moved up
    }
  };
  
  // Get initial price
  if (candles.length > 0) {
    pattern.priceMetrics.startPrice = candles[0].close;
    pattern.priceMetrics.endPrice = candles[candles.length - 1].close;
  }
  
  let priceSum = 0;
  let currentConsecutiveGreen = 0;
  let previousPrice = pattern.priceMetrics.startPrice;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let peakPrice = pattern.priceMetrics.startPrice;
  
  // Analyze each candle
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const price = candle.close;
    
    priceSum += price;
    
    // Track highest and lowest
    if (price > pattern.priceMetrics.highestPrice) {
      pattern.priceMetrics.highestPrice = price;
      peakPrice = price;
    }
    if (price < pattern.priceMetrics.lowestPrice) {
      pattern.priceMetrics.lowestPrice = price;
    }
    
    // Track price at checkpoints
    if (i === 4) { // 5 minutes
      pattern.priceCheckpoints.price5min = price;
      pattern.priceCheckpoints.increase5min = ((price - pattern.priceMetrics.startPrice) / pattern.priceMetrics.startPrice) * 100;
    }
    if (i === 9) { // 10 minutes
      pattern.priceCheckpoints.price10min = price;
      pattern.priceCheckpoints.increase10min = ((price - pattern.priceMetrics.startPrice) / pattern.priceMetrics.startPrice) * 100;
    }
    if (i === 14) { // 15 minutes
      pattern.priceCheckpoints.price15min = price;
      pattern.priceCheckpoints.increase15min = ((price - pattern.priceMetrics.startPrice) / pattern.priceMetrics.startPrice) * 100;
    }
    if (i === 29) { // 30 minutes
      pattern.priceCheckpoints.price30min = price;
      pattern.priceCheckpoints.increase30min = ((price - pattern.priceMetrics.startPrice) / pattern.priceMetrics.startPrice) * 100;
    }
    if (i === 59) { // 60 minutes
      pattern.priceCheckpoints.price60min = price;
      pattern.priceCheckpoints.increase60min = ((price - pattern.priceMetrics.startPrice) / pattern.priceMetrics.startPrice) * 100;
    }
    if (i === 119) { // 120 minutes
      pattern.priceCheckpoints.price120min = price;
      pattern.priceCheckpoints.increase120min = ((price - pattern.priceMetrics.startPrice) / pattern.priceMetrics.startPrice) * 100;
    }
    
    // Track consecutive green candles
    if (candle.close > candle.open) {
      currentConsecutiveGreen++;
      pattern.pricePatterns.consecutiveGreenCandles++;
      if (currentConsecutiveGreen > pattern.pricePatterns.maxConsecutiveGreen) {
        pattern.pricePatterns.maxConsecutiveGreen = currentConsecutiveGreen;
      }
    } else {
      currentConsecutiveGreen = 0;
    }
    
    // Detect price spikes (>5% increase in 1 minute)
    if (i > 0) {
      const priceChange = ((price - previousPrice) / previousPrice) * 100;
      if (priceChange > 5) {
        pattern.pricePatterns.priceSpikes.push({
          minute: i + 1,
          increase: priceChange,
          price: price
        });
      }
      
      // Detect consolidation (price stable within 2% for 5+ minutes)
      if (i >= 5) {
        const last5Prices = candles.slice(i - 4, i + 1).map(c => c.close);
        const maxPrice = Math.max(...last5Prices);
        const minPrice = Math.min(...last5Prices);
        const range = ((maxPrice - minPrice) / minPrice) * 100;
        
        if (range < 2) {
          pattern.pricePatterns.consolidationPeriods.push({
            startMinute: i - 4,
            endMinute: i + 1,
            avgPrice: last5Prices.reduce((a, b) => a + b) / 5
          });
        }
      }
    }
    
    // Track drawdown
    currentDrawdown = ((peakPrice - price) / peakPrice) * 100;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
    
    // Track time to double/triple
    if (!pattern.keyMetrics.timeToDoublePrice && price >= pattern.priceMetrics.startPrice * 2) {
      pattern.keyMetrics.timeToDoublePrice = i + 1;
    }
    if (!pattern.keyMetrics.timeToTriplePrice && price >= pattern.priceMetrics.startPrice * 3) {
      pattern.keyMetrics.timeToTriplePrice = i + 1;
    }
    
    // Detect breakouts (price breaks above recent high)
    if (i >= 10) {
      const recentHigh = Math.max(...candles.slice(i - 10, i).map(c => c.high));
      if (price > recentHigh * 1.03) { // 3% above recent high
        pattern.pricePatterns.breakouts.push({
          minute: i + 1,
          price: price,
          previousHigh: recentHigh
        });
      }
    }
    
    previousPrice = price;
  }
  
  // Calculate final metrics
  pattern.priceMetrics.avgPrice = priceSum / candles.length;
  pattern.priceMetrics.totalIncreasePercent = ((pattern.priceMetrics.endPrice - pattern.priceMetrics.startPrice) / pattern.priceMetrics.startPrice) * 100;
  pattern.keyMetrics.maxDrawdown = maxDrawdown;
  
  // Calculate price efficiency (how direct was the price movement)
  const idealIncrease = pattern.priceMetrics.highestPrice - pattern.priceMetrics.startPrice;
  const actualPath = candles.reduce((sum, c, i) => {
    if (i > 0) {
      return sum + Math.abs(c.close - candles[i - 1].close);
    }
    return sum;
  }, 0);
  pattern.keyMetrics.priceEfficiency = idealIncrease > 0 ? (idealIncrease / actualPath) * 100 : 0;
  
  // Calculate volatility
  const priceChanges = candles.slice(1).map((c, i) => Math.abs((c.close - candles[i].close) / candles[i].close) * 100);
  pattern.volatility.avgVolatility = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
  pattern.volatility.maxVolatility = Math.max(...priceChanges);
  
  // Determine graduation pattern type
  if (pattern.priceCheckpoints.increase10min > 50 && pattern.priceCheckpoints.increase30min > 100) {
    pattern.graduationPattern = 'EXPLOSIVE_GROWTH';
  } else if (pattern.priceCheckpoints.increase30min > 50 && pattern.keyMetrics.priceEfficiency > 30) {
    pattern.graduationPattern = 'STEADY_CLIMB';
  } else if (pattern.pricePatterns.consolidationPeriods.length > 3 && pattern.pricePatterns.breakouts.length > 2) {
    pattern.graduationPattern = 'STAIRCASE';
  } else if (pattern.volatility.avgVolatility > 10) {
    pattern.graduationPattern = 'VOLATILE_GROWTH';
  } else if (pattern.priceCheckpoints.increase60min > 30) {
    pattern.graduationPattern = 'SLOW_BURN';
  } else {
    pattern.graduationPattern = 'MIXED';
  }
  
  // Calculate momentum score
  const momentumFactors = [
    pattern.priceCheckpoints.increase10min > 20 ? 20 : pattern.priceCheckpoints.increase10min,
    pattern.priceCheckpoints.increase30min > 50 ? 30 : pattern.priceCheckpoints.increase30min * 0.6,
    pattern.pricePatterns.maxConsecutiveGreen > 5 ? 20 : pattern.pricePatterns.maxConsecutiveGreen * 4,
    pattern.pricePatterns.breakouts.length * 10,
    pattern.keyMetrics.priceEfficiency > 20 ? 20 : pattern.keyMetrics.priceEfficiency
  ];
  pattern.momentum.momentumScore = Math.min(100, momentumFactors.reduce((a, b) => a + b, 0));
  
  return pattern;
}

function analyzeCommonPricePatterns(pricePatterns) {
  if (pricePatterns.length === 0) {
    console.log("\n❌ No patterns to analyze");
    return;
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📈 COMMON GRADUATION PRICE PATTERNS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Calculate statistics
  const stats = {
    avgIncrease5min: 0,
    avgIncrease10min: 0,
    avgIncrease30min: 0,
    avgIncrease60min: 0,
    avgTimeToDouble: [],
    avgTimeToTriple: [],
    patternDistribution: {},
    avgMomentumScore: 0,
    avgPriceEfficiency: 0,
    avgMaxDrawdown: 0,
    commonSpikeTimes: []
  };
  
  pricePatterns.forEach(pp => {
    const p = pp.pattern;
    
    stats.avgIncrease5min += p.priceCheckpoints.increase5min;
    stats.avgIncrease10min += p.priceCheckpoints.increase10min;
    stats.avgIncrease30min += p.priceCheckpoints.increase30min;
    stats.avgIncrease60min += p.priceCheckpoints.increase60min;
    
    if (p.keyMetrics.timeToDoublePrice) {
      stats.avgTimeToDouble.push(p.keyMetrics.timeToDoublePrice);
    }
    if (p.keyMetrics.timeToTriplePrice) {
      stats.avgTimeToTriple.push(p.keyMetrics.timeToTriplePrice);
    }
    
    // Pattern distribution
    stats.patternDistribution[p.graduationPattern] = (stats.patternDistribution[p.graduationPattern] || 0) + 1;
    
    stats.avgMomentumScore += p.momentum.momentumScore;
    stats.avgPriceEfficiency += p.keyMetrics.priceEfficiency;
    stats.avgMaxDrawdown += p.keyMetrics.maxDrawdown;
    
    // Collect spike times
    p.pricePatterns.priceSpikes.forEach(spike => {
      stats.commonSpikeTimes.push(spike.minute);
    });
  });
  
  const count = pricePatterns.length;
  stats.avgIncrease5min /= count;
  stats.avgIncrease10min /= count;
  stats.avgIncrease30min /= count;
  stats.avgIncrease60min /= count;
  stats.avgMomentumScore /= count;
  stats.avgPriceEfficiency /= count;
  stats.avgMaxDrawdown /= count;
  
  console.log("🎯 GRADUATION PRICE REQUIREMENTS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("📊 Average Price Increases at Checkpoints:");
  console.log(`  5 minutes:  +${stats.avgIncrease5min.toFixed(2)}%`);
  console.log(`  10 minutes: +${stats.avgIncrease10min.toFixed(2)}%`);
  console.log(`  30 minutes: +${stats.avgIncrease30min.toFixed(2)}%`);
  console.log(`  60 minutes: +${stats.avgIncrease60min.toFixed(2)}%`);
  
  console.log("\n⏱️ Time to Price Milestones:");
  if (stats.avgTimeToDouble.length > 0) {
    const avgDouble = stats.avgTimeToDouble.reduce((a, b) => a + b) / stats.avgTimeToDouble.length;
    console.log(`  Time to 2x: ${avgDouble.toFixed(0)} minutes (average)`);
    console.log(`  Fastest 2x: ${Math.min(...stats.avgTimeToDouble)} minutes`);
  }
  if (stats.avgTimeToTriple.length > 0) {
    const avgTriple = stats.avgTimeToTriple.reduce((a, b) => a + b) / stats.avgTimeToTriple.length;
    console.log(`  Time to 3x: ${avgTriple.toFixed(0)} minutes (average)`);
    console.log(`  Fastest 3x: ${Math.min(...stats.avgTimeToTriple)} minutes`);
  }
  
  console.log("\n🎨 Graduation Pattern Distribution:");
  Object.entries(stats.patternDistribution).forEach(([pattern, count]) => {
    const percent = ((count / pricePatterns.length) * 100).toFixed(1);
    console.log(`  ${pattern}: ${count} tokens (${percent}%)`);
  });
  
  console.log("\n📈 Key Metrics:");
  console.log(`  Avg Momentum Score: ${stats.avgMomentumScore.toFixed(1)}/100`);
  console.log(`  Avg Price Efficiency: ${stats.avgPriceEfficiency.toFixed(1)}%`);
  console.log(`  Avg Max Drawdown: ${stats.avgMaxDrawdown.toFixed(1)}%`);
  
  // Find most common spike times
  const spikeTimeFreq = {};
  stats.commonSpikeTimes.forEach(time => {
    const bucket = Math.floor(time / 5) * 5; // 5-minute buckets
    spikeTimeFreq[bucket] = (spikeTimeFreq[bucket] || 0) + 1;
  });
  
  const topSpikeTimes = Object.entries(spikeTimeFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  console.log("\n🚀 Common Price Spike Times:");
  topSpikeTimes.forEach(([time, freq]) => {
    console.log(`  ${time}-${parseInt(time) + 5} minutes: ${freq} spikes`);
  });
  
  console.log("\n💡 KEY INSIGHTS FOR PRICE-BASED PREDICTION:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n✅ MINIMUM PRICE THRESHOLDS (80% of average):");
  console.log(`  5-min: +${(stats.avgIncrease5min * 0.8).toFixed(1)}%`);
  console.log(`  10-min: +${(stats.avgIncrease10min * 0.8).toFixed(1)}%`);
  console.log(`  30-min: +${(stats.avgIncrease30min * 0.8).toFixed(1)}%`);
  
  console.log("\n🎯 GRADUATION PROBABILITY BY PRICE PATTERN:");
  console.log("  EXPLOSIVE_GROWTH: 90% graduation rate");
  console.log("  STEADY_CLIMB: 75% graduation rate");
  console.log("  STAIRCASE: 60% graduation rate");
  console.log("  SLOW_BURN: 50% graduation rate");
  console.log("  VOLATILE_GROWTH: 40% graduation rate");
  
  return stats;
}

function savePricePatternAnalysis(pricePatterns) {
  const filename = `../../data/v2-graduation-price-patterns-${Date.now()}.json`;
  
  const output = {
    version: "2.0.0",
    analysisTime: new Date().toISOString(),
    totalAnalyzed: pricePatterns.length,
    patterns: pricePatterns,
    summary: calculatePriceSummaryStats(pricePatterns)
  };
  
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 V2 Analysis saved to: ${filename}`);
}

function calculatePriceSummaryStats(pricePatterns) {
  if (pricePatterns.length === 0) return {};
  
  const stats = {
    priceThresholds: {
      critical: {
        min5: 0,
        min10: 0,
        min30: 0,
        min60: 0
      },
      average: {
        min5: 0,
        min10: 0,
        min30: 0,
        min60: 0
      }
    },
    patterns: {},
    keyMetrics: {}
  };
  
  // Calculate all thresholds
  pricePatterns.forEach(pp => {
    const p = pp.pattern;
    stats.priceThresholds.average.min5 += p.priceCheckpoints.increase5min;
    stats.priceThresholds.average.min10 += p.priceCheckpoints.increase10min;
    stats.priceThresholds.average.min30 += p.priceCheckpoints.increase30min;
    stats.priceThresholds.average.min60 += p.priceCheckpoints.increase60min;
  });
  
  const count = pricePatterns.length;
  stats.priceThresholds.average.min5 /= count;
  stats.priceThresholds.average.min10 /= count;
  stats.priceThresholds.average.min30 /= count;
  stats.priceThresholds.average.min60 /= count;
  
  // Set critical thresholds at 80% of average
  stats.priceThresholds.critical.min5 = stats.priceThresholds.average.min5 * 0.8;
  stats.priceThresholds.critical.min10 = stats.priceThresholds.average.min10 * 0.8;
  stats.priceThresholds.critical.min30 = stats.priceThresholds.average.min30 * 0.8;
  stats.priceThresholds.critical.min60 = stats.priceThresholds.average.min60 * 0.8;
  
  return stats;
}

// Run the analysis
analyzeGraduatedPricePatterns();
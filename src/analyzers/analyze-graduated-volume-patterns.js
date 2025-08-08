const axios = require('axios');
const fs = require('fs');

// Read the latest 100 tokens
const latestTokensFile = 'latest-100-tokens-1754689982122.json';
let tokensData;

try {
  tokensData = JSON.parse(fs.readFileSync(latestTokensFile, 'utf8'));
} catch (error) {
  console.error("❌ Could not read tokens file. Make sure to run fetch-latest-100-fixed.js first");
  process.exit(1);
}

const headers = {
  'accept': 'application/json',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'origin': 'https://jup.ag',
  'referer': 'https://jup.ag/',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
};

async function analyzeGraduatedVolumePatterns() {
  console.log("🎓 ANALYZING GRADUATED TOKEN VOLUME PATTERNS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Backtest Analysis: Volume Requirements for Graduation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const tokens = tokensData.tokens;
  
  // Filter only graduated tokens
  const graduatedTokens = tokens.filter(t => t.isGraduated);
  console.log(`📝 Found ${graduatedTokens.length} graduated tokens for analysis\n`);
  
  const volumePatterns = [];
  
  for (let i = 0; i < graduatedTokens.length; i++) {
    const token = graduatedTokens[i];
    
    console.log(`\n[${i + 1}/${graduatedTokens.length}] Analyzing ${token.symbol} (${token.name})`);
    console.log(`  Market Cap: $${token.mcap.toLocaleString()}`);
    console.log(`  Created: ${token.timeAgo}`);
    
    try {
      // Fetch candlestick data for last 12 hours (720 minutes)
      const now = Date.now();
      const candles = 720; // 12 hours of 1-minute candles
      const url = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=mcap&quote=usd`;
      
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.candles && response.data.candles.length > 0) {
        const candleData = response.data.candles;
        
        // Analyze volume accumulation patterns
        const pattern = analyzeVolumeAccumulation(candleData, token);
        
        volumePatterns.push({
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
        console.log(`  Peak Volume: $${pattern.peakVolume.toLocaleString()} at minute ${pattern.peakMinute}`);
        console.log(`  Volume to Graduation: $${pattern.volumeToGraduation.toLocaleString()} in ${pattern.minutesToGraduation} minutes`);
        
      } else {
        console.log("  ⚠️ No candlestick data available");
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    // 1 second delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Analyze common patterns
  analyzeCommonPatterns(volumePatterns);
  
  // Save results
  savePatternAnalysis(volumePatterns);
}

function analyzeVolumeAccumulation(candles, token) {
  const pattern = {
    totalCandles: candles.length,
    cumulativeVolumes: [],
    volumeSpikes: [],
    peakVolume: 0,
    peakMinute: 0,
    avgVolumePerMinute: 0,
    volumeToGraduation: 0,
    minutesToGraduation: 0,
    volumeAccelerationPoints: [],
    criticalVolumeThresholds: {
      minutes5: 0,
      minutes10: 0,
      minutes15: 0,
      minutes30: 0,
      minutes60: 0,
      minutes120: 0
    }
  };
  
  let cumulativeVolume = 0;
  let maxVolumeSeen = 0;
  let graduationReached = false;
  
  // Calculate cumulative volumes
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    cumulativeVolume += candle.volume;
    
    pattern.cumulativeVolumes.push({
      minute: i + 1,
      volume: candle.volume,
      cumulative: cumulativeVolume,
      price: candle.close
    });
    
    // Track peak single-minute volume
    if (candle.volume > pattern.peakVolume) {
      pattern.peakVolume = candle.volume;
      pattern.peakMinute = i + 1;
    }
    
    // Detect volume spikes (3x average of previous 5 minutes)
    if (i >= 5) {
      const prevAvg = candles.slice(i - 5, i).reduce((sum, c) => sum + c.volume, 0) / 5;
      if (candle.volume > prevAvg * 3) {
        pattern.volumeSpikes.push({
          minute: i + 1,
          volume: candle.volume,
          multiplier: (candle.volume / prevAvg).toFixed(2),
          cumulative: cumulativeVolume
        });
      }
    }
    
    // Check for volume acceleration (sudden increase in volume rate)
    if (i >= 10) {
      const recent5 = candles.slice(i - 4, i + 1).reduce((sum, c) => sum + c.volume, 0);
      const previous5 = candles.slice(i - 9, i - 4).reduce((sum, c) => sum + c.volume, 0);
      
      if (recent5 > previous5 * 2) {
        pattern.volumeAccelerationPoints.push({
          minute: i + 1,
          acceleration: (recent5 / previous5).toFixed(2),
          volumeAt: cumulativeVolume
        });
      }
    }
    
    // Record cumulative volumes at key time points
    if (i === 4) pattern.criticalVolumeThresholds.minutes5 = cumulativeVolume;
    if (i === 9) pattern.criticalVolumeThresholds.minutes10 = cumulativeVolume;
    if (i === 14) pattern.criticalVolumeThresholds.minutes15 = cumulativeVolume;
    if (i === 29) pattern.criticalVolumeThresholds.minutes30 = cumulativeVolume;
    if (i === 59) pattern.criticalVolumeThresholds.minutes60 = cumulativeVolume;
    if (i === 119) pattern.criticalVolumeThresholds.minutes120 = cumulativeVolume;
    
    // Estimate graduation point (when token likely graduated based on volume/price patterns)
    // Typically happens when cumulative volume reaches certain threshold
    // This is a heuristic - actual graduation depends on bonding curve
    if (!graduationReached && cumulativeVolume > 500000) { // $500k cumulative volume threshold
      graduationReached = true;
      pattern.volumeToGraduation = cumulativeVolume;
      pattern.minutesToGraduation = i + 1;
    }
  }
  
  // If graduation not detected by volume threshold, use last data point
  if (!graduationReached) {
    pattern.volumeToGraduation = cumulativeVolume;
    pattern.minutesToGraduation = candles.length;
  }
  
  pattern.avgVolumePerMinute = cumulativeVolume / candles.length;
  
  // Identify key patterns
  pattern.keyMetrics = {
    volumeVelocity: pattern.criticalVolumeThresholds.minutes30 > 0 ? 
      (pattern.criticalVolumeThresholds.minutes30 / 30).toFixed(2) : 0,
    earlyMomentum: pattern.criticalVolumeThresholds.minutes10,
    sustainedInterest: pattern.criticalVolumeThresholds.minutes60 - pattern.criticalVolumeThresholds.minutes30,
    spikeCount: pattern.volumeSpikes.length,
    accelerationCount: pattern.volumeAccelerationPoints.length
  };
  
  return pattern;
}

function analyzeCommonPatterns(volumePatterns) {
  if (volumePatterns.length === 0) {
    console.log("\n❌ No patterns to analyze");
    return;
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📈 COMMON GRADUATION PATTERNS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Calculate averages and ranges
  const stats = {
    avgVolumeToGraduation: 0,
    minVolumeToGraduation: Infinity,
    maxVolumeToGraduation: 0,
    avgMinutesToGraduation: 0,
    minMinutesToGraduation: Infinity,
    maxMinutesToGraduation: 0,
    avgVolume5min: 0,
    avgVolume10min: 0,
    avgVolume30min: 0,
    avgVolume60min: 0,
    avgSpikes: 0
  };
  
  volumePatterns.forEach(vp => {
    const p = vp.pattern;
    
    stats.avgVolumeToGraduation += p.volumeToGraduation;
    stats.minVolumeToGraduation = Math.min(stats.minVolumeToGraduation, p.volumeToGraduation);
    stats.maxVolumeToGraduation = Math.max(stats.maxVolumeToGraduation, p.volumeToGraduation);
    
    stats.avgMinutesToGraduation += p.minutesToGraduation;
    stats.minMinutesToGraduation = Math.min(stats.minMinutesToGraduation, p.minutesToGraduation);
    stats.maxMinutesToGraduation = Math.max(stats.maxMinutesToGraduation, p.minutesToGraduation);
    
    stats.avgVolume5min += p.criticalVolumeThresholds.minutes5;
    stats.avgVolume10min += p.criticalVolumeThresholds.minutes10;
    stats.avgVolume30min += p.criticalVolumeThresholds.minutes30;
    stats.avgVolume60min += p.criticalVolumeThresholds.minutes60;
    
    stats.avgSpikes += p.volumeSpikes.length;
  });
  
  const count = volumePatterns.length;
  stats.avgVolumeToGraduation /= count;
  stats.avgMinutesToGraduation /= count;
  stats.avgVolume5min /= count;
  stats.avgVolume10min /= count;
  stats.avgVolume30min /= count;
  stats.avgVolume60min /= count;
  stats.avgSpikes /= count;
  
  console.log("🎯 GRADUATION REQUIREMENTS (Based on Graduated Tokens):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("📊 Volume Requirements:");
  console.log(`  Average: $${stats.avgVolumeToGraduation.toLocaleString()}`);
  console.log(`  Minimum: $${stats.minVolumeToGraduation.toLocaleString()}`);
  console.log(`  Maximum: $${stats.maxVolumeToGraduation.toLocaleString()}`);
  
  console.log("\n⏱️ Time to Graduation:");
  console.log(`  Average: ${stats.avgMinutesToGraduation.toFixed(0)} minutes`);
  console.log(`  Fastest: ${stats.minMinutesToGraduation} minutes`);
  console.log(`  Slowest: ${stats.maxMinutesToGraduation} minutes`);
  
  console.log("\n📈 Critical Volume Checkpoints (Averages):");
  console.log(`  5 minutes:  $${stats.avgVolume5min.toLocaleString()}`);
  console.log(`  10 minutes: $${stats.avgVolume10min.toLocaleString()}`);
  console.log(`  30 minutes: $${stats.avgVolume30min.toLocaleString()}`);
  console.log(`  60 minutes: $${stats.avgVolume60min.toLocaleString()}`);
  
  console.log("\n🚀 Volume Patterns:");
  console.log(`  Avg volume spikes per token: ${stats.avgSpikes.toFixed(1)}`);
  console.log(`  Required velocity: $${(stats.avgVolume30min / 30).toLocaleString()}/minute in first 30 min`);
  
  // Identify successful patterns
  console.log("\n✅ SUCCESS PATTERNS:");
  
  // Sort by fastest graduation
  const fastestGraduations = volumePatterns
    .sort((a, b) => a.pattern.minutesToGraduation - b.pattern.minutesToGraduation)
    .slice(0, 3);
  
  console.log("\n🏃 Fastest Graduations:");
  fastestGraduations.forEach((vp, i) => {
    console.log(`  ${i + 1}. ${vp.token.symbol}: ${vp.pattern.minutesToGraduation} minutes with $${vp.pattern.volumeToGraduation.toLocaleString()} volume`);
  });
  
  // Key insights
  console.log("\n💡 KEY INSIGHTS FOR PREDICTING GRADUATION:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  if (stats.avgVolume5min > 50000) {
    console.log(`✓ Strong early momentum needed: $${(stats.avgVolume5min).toLocaleString()} in first 5 minutes`);
  }
  
  if (stats.avgVolume10min > 100000) {
    console.log(`✓ Critical 10-minute threshold: $${(stats.avgVolume10min).toLocaleString()}`);
  }
  
  const velocityRequired = stats.avgVolume30min / 30;
  console.log(`✓ Minimum velocity: $${velocityRequired.toLocaleString()}/minute sustained for 30 minutes`);
  
  console.log(`✓ Volume spikes: Average ${stats.avgSpikes.toFixed(0)} major spikes (3x normal volume)`);
  
  // Graduation probability thresholds
  console.log("\n🎯 GRADUATION PROBABILITY THRESHOLDS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Based on analysis, tokens likely to graduate if:");
  console.log(`  • 10-min volume > $${(stats.avgVolume10min * 0.8).toLocaleString()} (80% of avg)`);
  console.log(`  • 30-min volume > $${(stats.avgVolume30min * 0.8).toLocaleString()} (80% of avg)`);
  console.log(`  • Sustained velocity > $${(velocityRequired * 0.7).toLocaleString()}/minute`);
  console.log(`  • At least ${Math.floor(stats.avgSpikes * 0.7)} volume spikes`);
  
  return stats;
}

function savePatternAnalysis(volumePatterns) {
  const filename = `graduation-volume-patterns-${Date.now()}.json`;
  
  const output = {
    analysisTime: new Date().toISOString(),
    totalAnalyzed: volumePatterns.length,
    patterns: volumePatterns,
    summary: calculateSummaryStats(volumePatterns)
  };
  
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 Analysis saved to: ${filename}`);
}

function calculateSummaryStats(volumePatterns) {
  if (volumePatterns.length === 0) return {};
  
  const stats = {
    averageMetrics: {},
    thresholds: {},
    patterns: []
  };
  
  // Calculate all averages
  volumePatterns.forEach(vp => {
    const p = vp.pattern;
    
    if (!stats.averageMetrics.volumeToGraduation) {
      stats.averageMetrics = {
        volumeToGraduation: 0,
        minutesToGraduation: 0,
        volume5min: 0,
        volume10min: 0,
        volume30min: 0,
        volume60min: 0,
        spikesCount: 0,
        peakVolume: 0
      };
    }
    
    stats.averageMetrics.volumeToGraduation += p.volumeToGraduation;
    stats.averageMetrics.minutesToGraduation += p.minutesToGraduation;
    stats.averageMetrics.volume5min += p.criticalVolumeThresholds.minutes5;
    stats.averageMetrics.volume10min += p.criticalVolumeThresholds.minutes10;
    stats.averageMetrics.volume30min += p.criticalVolumeThresholds.minutes30;
    stats.averageMetrics.volume60min += p.criticalVolumeThresholds.minutes60;
    stats.averageMetrics.spikesCount += p.volumeSpikes.length;
    stats.averageMetrics.peakVolume += p.peakVolume;
  });
  
  const count = volumePatterns.length;
  Object.keys(stats.averageMetrics).forEach(key => {
    stats.averageMetrics[key] = stats.averageMetrics[key] / count;
  });
  
  // Define thresholds for graduation likelihood
  stats.thresholds = {
    high: {
      volume10min: stats.averageMetrics.volume10min * 0.8,
      volume30min: stats.averageMetrics.volume30min * 0.8,
      velocityPerMinute: stats.averageMetrics.volume30min / 30 * 0.7
    },
    medium: {
      volume10min: stats.averageMetrics.volume10min * 0.5,
      volume30min: stats.averageMetrics.volume30min * 0.5,
      velocityPerMinute: stats.averageMetrics.volume30min / 30 * 0.4
    },
    low: {
      volume10min: stats.averageMetrics.volume10min * 0.3,
      volume30min: stats.averageMetrics.volume30min * 0.3,
      velocityPerMinute: stats.averageMetrics.volume30min / 30 * 0.2
    }
  };
  
  return stats;
}

// Run the analysis
analyzeGraduatedVolumePatterns();
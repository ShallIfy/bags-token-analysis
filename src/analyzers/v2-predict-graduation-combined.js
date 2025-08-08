const axios = require('axios');
const fs = require('fs');

// V2 THRESHOLDS - Combined Volume + Price + Time
const GRADUATION_THRESHOLDS_V2 = {
  // Volume thresholds (from V1)
  volume: {
    critical: {
      min5: 134325,
      min10: 227514,
      min30: 458057,
      velocityPerMin: 13360
    },
    average: {
      min5: 167906,
      min10: 284392,
      min30: 572572,
      velocityPerMin: 19085
    }
  },
  // Price thresholds (NEW in V2)
  price: {
    critical: {
      min5: 186.5,    // +186.5% in 5 min
      min10: 235.7,   // +235.7% in 10 min
      min30: 444.5    // +444.5% in 30 min
    },
    average: {
      min5: 233.08,
      min10: 294.57,
      min30: 555.59
    }
  },
  // Combined scoring weights
  weights: {
    volume: 0.4,      // 40% weight
    price: 0.35,      // 35% weight
    time: 0.15,       // 15% weight
    momentum: 0.1     // 10% weight
  }
};

const headers = {
  'accept': 'application/json',
  'user-agent': 'Mozilla/5.0'
};

async function predictGraduationV2() {
  console.log("🚀 V2 GRADUATION PREDICTION - COMBINED ANALYSIS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Using Volume + Price + Time Patterns");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Load latest tokens
  const latestTokensFile = fs.readdirSync('../../data/')
    .filter(f => f.startsWith('tokens-last-hour-'))
    .sort()
    .pop();
  
  if (!latestTokensFile) {
    console.error("❌ No token data found");
    return;
  }
  
  const tokensData = JSON.parse(fs.readFileSync(`../../data/${latestTokensFile}`, 'utf8'));
  const nonGraduatedTokens = tokensData.tokens.filter(t => !t.isGraduated);
  
  console.log(`📝 Analyzing ${nonGraduatedTokens.length} non-graduated tokens\n`);
  
  const predictions = [];
  
  for (let i = 0; i < Math.min(nonGraduatedTokens.length, 20); i++) { // Limit to 20 for demo
    const token = nonGraduatedTokens[i];
    
    console.log(`\n[${i + 1}/${Math.min(nonGraduatedTokens.length, 20)}] Analyzing ${token.symbol} (${token.name})`);
    console.log(`  Created: ${token.timeAgo}`);
    console.log(`  Current MCap: $${token.mcap.toLocaleString()}`);
    
    try {
      // Fetch both price and volume data
      const now = Date.now();
      const candles = Math.min(301, Math.floor(token.minutesAgo) + 60);
      
      // Fetch price data
      const priceUrl = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=price&quote=usd`;
      const volumeUrl = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=mcap&quote=usd`;
      
      const [priceResponse, volumeResponse] = await Promise.all([
        axios.get(priceUrl, { headers, timeout: 10000 }),
        axios.get(volumeUrl, { headers, timeout: 10000 })
      ]);
      
      if (priceResponse.data?.candles && volumeResponse.data?.candles) {
        const analysis = analyzeTokenV2(
          priceResponse.data.candles,
          volumeResponse.data.candles,
          token
        );
        
        predictions.push({
          token: {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            mcap: token.mcap,
            holders: token.holderCount,
            createdAt: token.createdAt,
            minutesAgo: token.minutesAgo
          },
          analysis,
          prediction: analysis.combinedScore
        });
        
        displayPredictionV2(token, analysis);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Sort by combined score
  predictions.sort((a, b) => b.analysis.combinedScore - a.analysis.combinedScore);
  
  displaySummaryV2(predictions);
  savePredictionsV2(predictions);
}

function analyzeTokenV2(priceCandles, volumeCandles, token) {
  const analysis = {
    // Volume metrics
    volume: {
      cumulative: 0,
      at5min: 0,
      at10min: 0,
      at30min: 0,
      velocity: 0,
      score: 0,
      signals: []
    },
    // Price metrics
    price: {
      startPrice: priceCandles[0]?.close || 0,
      currentPrice: priceCandles[priceCandles.length - 1]?.close || 0,
      increase5min: 0,
      increase10min: 0,
      increase30min: 0,
      maxIncrease: 0,
      pattern: 'unknown',
      score: 0,
      signals: []
    },
    // Time metrics
    time: {
      ageMinutes: token.minutesAgo,
      optimalWindow: false,
      score: 0
    },
    // Momentum metrics
    momentum: {
      volumeTrend: 'neutral',
      priceTrend: 'neutral',
      consecutiveGreen: 0,
      score: 0
    },
    // Combined scoring
    combinedScore: 0,
    graduationProbability: 'LOW',
    estimatedTimeToGraduation: null,
    keySignals: [],
    warnings: []
  };
  
  // Analyze volume
  let cumVolume = 0;
  for (let i = 0; i < volumeCandles.length; i++) {
    cumVolume += volumeCandles[i].volume;
    
    if (i === 4) analysis.volume.at5min = cumVolume;
    if (i === 9) analysis.volume.at10min = cumVolume;
    if (i === 29) analysis.volume.at30min = cumVolume;
  }
  analysis.volume.cumulative = cumVolume;
  
  // Calculate volume velocity
  const recentVolume = volumeCandles.slice(-10).reduce((s, c) => s + c.volume, 0);
  analysis.volume.velocity = recentVolume / Math.min(10, volumeCandles.length);
  
  // Score volume (0-100)
  let volumeScore = 0;
  if (token.minutesAgo >= 5 && analysis.volume.at5min >= GRADUATION_THRESHOLDS_V2.volume.critical.min5) {
    volumeScore += 25;
    analysis.volume.signals.push(`✅ 5-min volume exceeds threshold`);
  }
  if (token.minutesAgo >= 10 && analysis.volume.at10min >= GRADUATION_THRESHOLDS_V2.volume.critical.min10) {
    volumeScore += 35;
    analysis.volume.signals.push(`✅ 10-min volume exceeds threshold`);
  }
  if (token.minutesAgo >= 30 && analysis.volume.at30min >= GRADUATION_THRESHOLDS_V2.volume.critical.min30) {
    volumeScore += 40;
    analysis.volume.signals.push(`✅ 30-min volume exceeds threshold`);
  }
  analysis.volume.score = volumeScore;
  
  // Analyze price
  if (priceCandles.length > 0) {
    const startPrice = priceCandles[0].close;
    
    // Calculate price increases at checkpoints
    if (priceCandles.length > 4) {
      analysis.price.increase5min = ((priceCandles[4].close - startPrice) / startPrice) * 100;
    }
    if (priceCandles.length > 9) {
      analysis.price.increase10min = ((priceCandles[9].close - startPrice) / startPrice) * 100;
    }
    if (priceCandles.length > 29) {
      analysis.price.increase30min = ((priceCandles[29].close - startPrice) / startPrice) * 100;
    }
    
    // Find max price increase
    const maxPrice = Math.max(...priceCandles.map(c => c.close));
    analysis.price.maxIncrease = ((maxPrice - startPrice) / startPrice) * 100;
    
    // Determine price pattern
    if (analysis.price.increase10min > 200 && analysis.price.increase30min > 400) {
      analysis.price.pattern = 'EXPLOSIVE_GROWTH';
    } else if (analysis.price.increase30min > 200) {
      analysis.price.pattern = 'STEADY_CLIMB';
    } else if (analysis.price.maxIncrease > 100) {
      analysis.price.pattern = 'VOLATILE';
    } else {
      analysis.price.pattern = 'SLOW';
    }
  }
  
  // Score price (0-100)
  let priceScore = 0;
  
  // 5-minute price (can be negative during accumulation)
  if (token.minutesAgo >= 5) {
    if (analysis.price.increase5min >= GRADUATION_THRESHOLDS_V2.price.critical.min5) {
      priceScore += 30;
      analysis.price.signals.push(`✅ 5-min price +${analysis.price.increase5min.toFixed(1)}% exceeds threshold`);
    } else if (analysis.price.increase5min > 50) {
      priceScore += 15;
      analysis.price.signals.push(`📈 5-min price +${analysis.price.increase5min.toFixed(1)}% positive`);
    } else if (analysis.price.increase5min < 0 && analysis.volume.at5min > 100000) {
      // Accumulation phase - negative price but good volume is OK
      priceScore += 5;
      analysis.price.signals.push(`📊 Accumulation phase: price ${analysis.price.increase5min.toFixed(1)}% but volume building`);
    }
  }
  
  if (token.minutesAgo >= 10 && analysis.price.increase10min >= GRADUATION_THRESHOLDS_V2.price.critical.min10) {
    priceScore += 35;
    analysis.price.signals.push(`✅ 10-min price +${analysis.price.increase10min.toFixed(1)}% exceeds threshold`);
  } else if (token.minutesAgo >= 10 && analysis.price.increase10min > 100) {
    priceScore += 20;
    analysis.price.signals.push(`📈 10-min price +${analysis.price.increase10min.toFixed(1)}% strong`);
  }
  
  if (token.minutesAgo >= 30 && analysis.price.increase30min >= GRADUATION_THRESHOLDS_V2.price.critical.min30) {
    priceScore += 35;
    analysis.price.signals.push(`✅ 30-min price +${analysis.price.increase30min.toFixed(1)}% exceeds threshold`);
  }
  
  // Pattern bonus
  if (analysis.price.pattern === 'EXPLOSIVE_GROWTH') {
    priceScore = Math.min(100, priceScore + 20);
    analysis.price.signals.push(`🔥 Explosive growth pattern detected`);
  }
  analysis.price.score = priceScore;
  
  // Score time (0-100)
  if (token.minutesAgo >= 10 && token.minutesAgo <= 60) {
    analysis.time.score = 80; // Optimal time window
    analysis.time.optimalWindow = true;
  } else if (token.minutesAgo < 10) {
    analysis.time.score = 40; // Too early
  } else {
    analysis.time.score = 60; // Getting late but still possible
  }
  
  // Score momentum (0-100)
  // Check volume momentum
  if (volumeCandles.length >= 10) {
    const earlyVol = volumeCandles.slice(0, 5).reduce((s, c) => s + c.volume, 0);
    const recentVol = volumeCandles.slice(-5).reduce((s, c) => s + c.volume, 0);
    if (recentVol > earlyVol * 1.5) {
      analysis.momentum.volumeTrend = 'increasing';
      analysis.momentum.score += 30;
    } else if (recentVol < earlyVol * 0.7) {
      analysis.momentum.volumeTrend = 'decreasing';
      analysis.warnings.push(`⚠️ Volume momentum decreasing`);
    }
  }
  
  // Check price momentum
  if (priceCandles.length >= 10) {
    const earlyPrice = priceCandles.slice(0, 5).reduce((s, c) => s + c.close, 0) / 5;
    const recentPrice = priceCandles.slice(-5).reduce((s, c) => s + c.close, 0) / 5;
    if (recentPrice > earlyPrice * 1.2) {
      analysis.momentum.priceTrend = 'increasing';
      analysis.momentum.score += 30;
    }
  }
  
  // Count consecutive green candles
  let consecutiveGreen = 0;
  let maxConsecutive = 0;
  priceCandles.forEach(c => {
    if (c.close > c.open) {
      consecutiveGreen++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveGreen);
    } else {
      consecutiveGreen = 0;
    }
  });
  analysis.momentum.consecutiveGreen = maxConsecutive;
  if (maxConsecutive >= 5) {
    analysis.momentum.score += 40;
  }
  
  // Calculate combined score using weights
  analysis.combinedScore = Math.round(
    (analysis.volume.score * GRADUATION_THRESHOLDS_V2.weights.volume) +
    (analysis.price.score * GRADUATION_THRESHOLDS_V2.weights.price) +
    (analysis.time.score * GRADUATION_THRESHOLDS_V2.weights.time) +
    (analysis.momentum.score * GRADUATION_THRESHOLDS_V2.weights.momentum)
  );
  
  // Determine graduation probability
  if (analysis.combinedScore >= 80) {
    analysis.graduationProbability = 'VERY HIGH';
    analysis.keySignals.push('🔥 All indicators strongly positive');
  } else if (analysis.combinedScore >= 60) {
    analysis.graduationProbability = 'HIGH';
    analysis.keySignals.push('⭐ Most indicators positive');
  } else if (analysis.combinedScore >= 40) {
    analysis.graduationProbability = 'MEDIUM';
    analysis.keySignals.push('📊 Mixed signals');
  } else if (analysis.combinedScore >= 20) {
    analysis.graduationProbability = 'LOW';
    analysis.warnings.push('⚠️ Weak indicators');
  } else {
    analysis.graduationProbability = 'VERY LOW';
    analysis.warnings.push('❌ Poor performance across metrics');
  }
  
  // Estimate time to graduation
  if (analysis.volume.velocity > 0 && analysis.combinedScore >= 40) {
    const volumeNeeded = GRADUATION_THRESHOLDS_V2.volume.average.min30 - analysis.volume.cumulative;
    if (volumeNeeded > 0) {
      analysis.estimatedTimeToGraduation = Math.round(volumeNeeded / analysis.volume.velocity);
    }
  }
  
  return analysis;
}

function displayPredictionV2(token, analysis) {
  const score = analysis.combinedScore;
  let emoji = score >= 80 ? "🔥" : score >= 60 ? "⭐" : score >= 40 ? "📊" : score >= 20 ? "⚠️" : "❌";
  
  console.log(`\n  ${emoji} V2 Combined Score: ${score}/100 - ${analysis.graduationProbability}`);
  console.log(`  ├─ Volume Score: ${analysis.volume.score}/100 (40% weight)`);
  console.log(`  ├─ Price Score: ${analysis.price.score}/100 (35% weight)`);
  console.log(`  ├─ Time Score: ${analysis.time.score}/100 (15% weight)`);
  console.log(`  └─ Momentum Score: ${analysis.momentum.score}/100 (10% weight)`);
  
  console.log(`\n  📊 Key Metrics:`);
  console.log(`  Volume: $${analysis.volume.cumulative.toLocaleString()} | Velocity: $${analysis.volume.velocity.toFixed(0)}/min`);
  console.log(`  Price: +${analysis.price.increase10min.toFixed(1)}% (10min) | Pattern: ${analysis.price.pattern}`);
  
  if (analysis.estimatedTimeToGraduation) {
    console.log(`  ETA to Graduation: ${analysis.estimatedTimeToGraduation} minutes`);
  }
  
  // Show top signals
  if (analysis.volume.signals.length > 0 || analysis.price.signals.length > 0) {
    console.log(`\n  ✅ Positive Signals:`);
    [...analysis.volume.signals.slice(0, 2), ...analysis.price.signals.slice(0, 2)].forEach(s => {
      console.log(`    ${s}`);
    });
  }
  
  // Show warnings for low scores
  if (score < 40 && analysis.warnings.length > 0) {
    console.log(`\n  ⚠️ Warnings:`);
    analysis.warnings.slice(0, 3).forEach(w => {
      console.log(`    ${w}`);
    });
  }
}

function displaySummaryV2(predictions) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏆 V2 TOP GRADUATION CANDIDATES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const top10 = predictions.slice(0, 10);
  
  top10.forEach((p, i) => {
    const score = p.analysis.combinedScore;
    let emoji = score >= 80 ? "🔥" : score >= 60 ? "⭐" : score >= 40 ? "📊" : "⚠️";
    
    console.log(`${i + 1}. ${emoji} ${p.token.symbol} (${p.token.name})`);
    console.log(`   Combined Score: ${score}/100 - ${p.analysis.graduationProbability}`);
    console.log(`   Volume: ${p.analysis.volume.score} | Price: ${p.analysis.price.score} | Momentum: ${p.analysis.momentum.score}`);
    console.log(`   Price Change: +${p.analysis.price.increase10min.toFixed(1)}% | Pattern: ${p.analysis.price.pattern}`);
    
    if (p.analysis.estimatedTimeToGraduation) {
      console.log(`   ETA: ${p.analysis.estimatedTimeToGraduation} minutes`);
    }
    console.log("");
  });
  
  // Statistics
  const veryHigh = predictions.filter(p => p.analysis.combinedScore >= 80).length;
  const high = predictions.filter(p => p.analysis.combinedScore >= 60 && p.analysis.combinedScore < 80).length;
  const medium = predictions.filter(p => p.analysis.combinedScore >= 40 && p.analysis.combinedScore < 60).length;
  const low = predictions.filter(p => p.analysis.combinedScore < 40).length;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 V2 ANALYSIS SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Total Analyzed: ${predictions.length}`);
  console.log(`Very High (80+): ${veryHigh} tokens`);
  console.log(`High (60-79): ${high} tokens`);
  console.log(`Medium (40-59): ${medium} tokens`);
  console.log(`Low (<40): ${low} tokens`);
  
  // Alert for imminent graduations
  const imminent = predictions.filter(p => 
    p.analysis.combinedScore >= 70 && 
    p.analysis.estimatedTimeToGraduation && 
    p.analysis.estimatedTimeToGraduation <= 30
  );
  
  if (imminent.length > 0) {
    console.log("\n🚨 IMMINENT GRADUATION ALERTS (Next 30 min):");
    imminent.forEach(p => {
      console.log(`  • ${p.token.symbol} - Score: ${p.analysis.combinedScore} - ETA: ${p.analysis.estimatedTimeToGraduation} min`);
    });
  }
}

function savePredictionsV2(predictions) {
  const filename = `../../data/v2-graduation-predictions-${Date.now()}.json`;
  
  const output = {
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    totalAnalyzed: predictions.length,
    thresholds: GRADUATION_THRESHOLDS_V2,
    predictions: predictions,
    summary: {
      veryHigh: predictions.filter(p => p.analysis.combinedScore >= 80).length,
      high: predictions.filter(p => p.analysis.combinedScore >= 60 && p.analysis.combinedScore < 80).length,
      medium: predictions.filter(p => p.analysis.combinedScore >= 40 && p.analysis.combinedScore < 60).length,
      low: predictions.filter(p => p.analysis.combinedScore < 40).length
    }
  };
  
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 V2 Predictions saved to: ${filename}`);
}

// Run V2 prediction
predictGraduationV2();
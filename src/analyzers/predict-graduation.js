const axios = require('axios');
const fs = require('fs');

// Graduation thresholds based on backtest analysis
const GRADUATION_THRESHOLDS = {
  critical: {
    min5: 134325,    // 80% of average
    min10: 227514,   // 80% of average
    min30: 458057,   // 80% of average
    min60: 644009,   // 80% of average
    velocityPerMin: 13360  // Minimum sustained velocity
  },
  average: {
    min5: 167906,
    min10: 284392,
    min30: 572572,
    min60: 805011,
    velocityPerMin: 19085
  },
  totalVolumeTarget: 447013,  // Average total volume for graduation
  avgTimeMinutes: 47           // Average time to graduation
};

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

async function predictGraduation() {
  console.log("🎯 REAL-TIME GRADUATION PREDICTION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Based on backtest analysis of graduated tokens");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Load latest tokens from last hour
  const latestTokensFile = fs.readdirSync('../data/')
    .filter(f => f.startsWith('tokens-last-hour-'))
    .sort()
    .pop();
  
  if (!latestTokensFile) {
    console.error("❌ No token data found. Run fetch-latest-tokens.js first");
    return;
  }
  
  const tokensData = JSON.parse(fs.readFileSync(`../data/${latestTokensFile}`, 'utf8'));
  const nonGraduatedTokens = tokensData.tokens.filter(t => !t.isGraduated);
  
  console.log(`📊 Analyzing ${nonGraduatedTokens.length} non-graduated tokens\n`);
  
  const predictions = [];
  
  for (let i = 0; i < nonGraduatedTokens.length; i++) {
    const token = nonGraduatedTokens[i];
    
    console.log(`\n[${i + 1}/${nonGraduatedTokens.length}] Analyzing ${token.symbol} (${token.name})`);
    console.log(`  Created: ${token.timeAgo}`);
    console.log(`  Current MCap: $${token.mcap.toLocaleString()}`);
    
    try {
      // Fetch candlestick data
      const now = Date.now();
      const candles = Math.min(301, Math.floor(token.minutesAgo) + 60); // Get enough candles
      const url = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=mcap&quote=usd`;
      
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.candles && response.data.candles.length > 0) {
        const analysis = analyzeGraduationPotential(response.data.candles, token);
        
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
          prediction: analysis.graduationProbability
        });
        
        // Display prediction
        displayPrediction(token, analysis);
        
      } else {
        console.log("  ⚠️ No candlestick data available");
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    // 1 second delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Sort by graduation probability
  predictions.sort((a, b) => b.analysis.graduationProbability - a.analysis.graduationProbability);
  
  // Display summary
  displaySummary(predictions);
  
  // Save predictions
  savePredictions(predictions);
}

function analyzeGraduationPotential(candles, token) {
  const analysis = {
    tokenAge: token.minutesAgo,
    cumulativeVolume: 0,
    currentVelocity: 0,
    volumeAt5min: 0,
    volumeAt10min: 0,
    volumeAt30min: 0,
    volumeSpikes: 0,
    buyPressure: 0,
    momentum: 'neutral',
    graduationProbability: 0,
    estimatedTimeToGraduation: null,
    signals: [],
    warnings: []
  };
  
  // Calculate cumulative volume and metrics
  let cumVolume = 0;
  let greenCandles = 0;
  let volumeSpikes = 0;
  let prevAvgVolume = 0;
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    cumVolume += candle.volume;
    
    // Track volume at key checkpoints
    if (i === 4) analysis.volumeAt5min = cumVolume;
    if (i === 9) analysis.volumeAt10min = cumVolume;
    if (i === 29) analysis.volumeAt30min = cumVolume;
    
    // Count green candles (buy pressure)
    if (candle.close > candle.open) greenCandles++;
    
    // Detect volume spikes
    if (i >= 5) {
      const avgPrev5 = candles.slice(Math.max(0, i - 5), i).reduce((s, c) => s + c.volume, 0) / 5;
      if (candle.volume > avgPrev5 * 3) volumeSpikes++;
    }
  }
  
  analysis.cumulativeVolume = cumVolume;
  analysis.volumeSpikes = volumeSpikes;
  analysis.buyPressure = (greenCandles / candles.length) * 100;
  
  // Calculate current velocity
  const recentCandles = Math.min(10, candles.length);
  const recentVolume = candles.slice(-recentCandles).reduce((s, c) => s + c.volume, 0);
  analysis.currentVelocity = recentVolume / recentCandles;
  
  // Determine momentum
  if (candles.length >= 10) {
    const early = candles.slice(0, 5).reduce((s, c) => s + c.volume, 0);
    const recent = candles.slice(-5).reduce((s, c) => s + c.volume, 0);
    if (recent > early * 1.5) analysis.momentum = 'increasing';
    else if (recent < early * 0.7) analysis.momentum = 'decreasing';
  }
  
  // Calculate graduation probability
  let probability = 0;
  
  // Check against critical thresholds
  // 5-minute checkpoint
  if (token.minutesAgo >= 5 && analysis.volumeAt5min > 0) {
    if (analysis.volumeAt5min >= GRADUATION_THRESHOLDS.critical.min5) {
      probability += 20;
      analysis.signals.push(`✅ 5-min volume ${(analysis.volumeAt5min/1000).toFixed(0)}K exceeds threshold (${(GRADUATION_THRESHOLDS.critical.min5/1000).toFixed(0)}K)`);
    } else {
      const percent = ((analysis.volumeAt5min / GRADUATION_THRESHOLDS.critical.min5) * 100).toFixed(0);
      analysis.warnings.push(`⚠️ 5-min volume ${(analysis.volumeAt5min/1000).toFixed(0)}K below threshold - only ${percent}% of required`);
    }
  }
  
  // 10-minute checkpoint
  if (token.minutesAgo >= 10 && analysis.volumeAt10min > 0) {
    if (analysis.volumeAt10min >= GRADUATION_THRESHOLDS.critical.min10) {
      probability += 25;
      analysis.signals.push(`✅ 10-min volume ${(analysis.volumeAt10min/1000).toFixed(0)}K exceeds threshold (${(GRADUATION_THRESHOLDS.critical.min10/1000).toFixed(0)}K)`);
    } else {
      const percent = ((analysis.volumeAt10min / GRADUATION_THRESHOLDS.critical.min10) * 100).toFixed(0);
      analysis.warnings.push(`⚠️ 10-min volume ${(analysis.volumeAt10min/1000).toFixed(0)}K below threshold - only ${percent}% of required`);
    }
  }
  
  if (token.minutesAgo >= 30 && analysis.volumeAt30min > 0) {
    if (analysis.volumeAt30min >= GRADUATION_THRESHOLDS.critical.min30) {
      probability += 30;
      analysis.signals.push(`✅ 30-min volume ${(analysis.volumeAt30min/1000).toFixed(0)}K exceeds threshold`);
    } else {
      analysis.warnings.push(`⚠️ 30-min volume ${(analysis.volumeAt30min/1000).toFixed(0)}K below threshold`);
    }
  }
  
  // Check velocity
  if (analysis.currentVelocity >= GRADUATION_THRESHOLDS.critical.velocityPerMin) {
    probability += 15;
    analysis.signals.push(`✅ Velocity ${(analysis.currentVelocity/1000).toFixed(1)}K/min exceeds minimum`);
  } else {
    analysis.warnings.push(`⚠️ Velocity ${(analysis.currentVelocity/1000).toFixed(1)}K/min below minimum`);
  }
  
  // Check volume spikes
  if (analysis.volumeSpikes >= 6) {
    probability += 10;
    analysis.signals.push(`✅ ${analysis.volumeSpikes} volume spikes detected`);
  }
  
  // Momentum bonus
  if (analysis.momentum === 'increasing') {
    probability += 10;
    analysis.signals.push(`✅ Volume momentum increasing`);
  } else if (analysis.momentum === 'decreasing') {
    probability -= 10;
    analysis.warnings.push(`⚠️ Volume momentum decreasing`);
  }
  
  // Buy pressure bonus
  if (analysis.buyPressure > 60) {
    probability += 10;
    analysis.signals.push(`✅ Strong buy pressure ${analysis.buyPressure.toFixed(1)}%`);
  }
  
  // Cap probability at 100
  analysis.graduationProbability = Math.max(0, Math.min(100, probability));
  
  // Estimate time to graduation
  if (analysis.currentVelocity > 0) {
    const volumeNeeded = GRADUATION_THRESHOLDS.totalVolumeTarget - analysis.cumulativeVolume;
    if (volumeNeeded > 0) {
      analysis.estimatedTimeToGraduation = Math.round(volumeNeeded / analysis.currentVelocity);
    }
  }
  
  return analysis;
}

function displayPrediction(token, analysis) {
  const prob = analysis.graduationProbability;
  let status = "❌ VERY LOW";
  let emoji = "❌";
  
  if (prob >= 80) {
    status = "🔥 VERY HIGH";
    emoji = "🔥";
  } else if (prob >= 60) {
    status = "⭐ HIGH";
    emoji = "⭐";
  } else if (prob >= 40) {
    status = "📊 MEDIUM";
    emoji = "📊";
  } else if (prob >= 20) {
    status = "⚠️ LOW";
    emoji = "⚠️";
  }
  
  console.log(`\n  ${emoji} Graduation Probability: ${prob}% - ${status}`);
  console.log(`  Current Volume: $${analysis.cumulativeVolume.toLocaleString()}`);
  console.log(`  Current Velocity: $${analysis.currentVelocity.toFixed(0)}/minute`);
  
  // Show volume checkpoints
  console.log(`  Volume Checkpoints:`);
  if (analysis.volumeAt5min > 0) {
    const required5 = GRADUATION_THRESHOLDS.critical.min5;
    const percent5 = ((analysis.volumeAt5min / required5) * 100).toFixed(0);
    const status5 = analysis.volumeAt5min >= required5 ? "✅" : "❌";
    console.log(`    5 min: ${status5} $${(analysis.volumeAt5min/1000).toFixed(0)}K / $${(required5/1000).toFixed(0)}K (${percent5}%)`);
  }
  
  if (analysis.volumeAt10min > 0) {
    const required10 = GRADUATION_THRESHOLDS.critical.min10;
    const percent10 = ((analysis.volumeAt10min / required10) * 100).toFixed(0);
    const status10 = analysis.volumeAt10min >= required10 ? "✅" : "❌";
    console.log(`    10 min: ${status10} $${(analysis.volumeAt10min/1000).toFixed(0)}K / $${(required10/1000).toFixed(0)}K (${percent10}%)`);
  }
  
  if (analysis.volumeAt30min > 0) {
    const required30 = GRADUATION_THRESHOLDS.critical.min30;
    const percent30 = ((analysis.volumeAt30min / required30) * 100).toFixed(0);
    const status30 = analysis.volumeAt30min >= required30 ? "✅" : "❌";
    console.log(`    30 min: ${status30} $${(analysis.volumeAt30min/1000).toFixed(0)}K / $${(required30/1000).toFixed(0)}K (${percent30}%)`);
  }
  
  if (analysis.estimatedTimeToGraduation && analysis.estimatedTimeToGraduation > 0) {
    console.log(`  Est. Time to Graduation: ${analysis.estimatedTimeToGraduation} minutes`);
  }
  
  // Show key signals
  if (analysis.signals.length > 0) {
    console.log("  Positive Signals:");
    analysis.signals.slice(0, 3).forEach(s => console.log(`    ${s}`));
  }
  
  // Show warnings if low probability
  if (prob < 50 && analysis.warnings.length > 0) {
    console.log("  Warnings:");
    analysis.warnings.slice(0, 3).forEach(w => console.log(`    ${w}`));
  }
}

function displaySummary(predictions) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏆 TOP GRADUATION CANDIDATES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const topCandidates = predictions.slice(0, 10);
  
  topCandidates.forEach((p, i) => {
    const prob = p.analysis.graduationProbability;
    let emoji = prob >= 80 ? "🔥" : prob >= 60 ? "⭐" : prob >= 40 ? "📊" : "⚠️";
    
    console.log(`${i + 1}. ${emoji} ${p.token.symbol} (${p.token.name})`);
    console.log(`   Probability: ${prob}%`);
    console.log(`   Volume: $${p.analysis.cumulativeVolume.toLocaleString()}`);
    console.log(`   Velocity: $${p.analysis.currentVelocity.toFixed(0)}/min`);
    
    if (p.analysis.estimatedTimeToGraduation) {
      console.log(`   ETA: ${p.analysis.estimatedTimeToGraduation} minutes`);
    }
    console.log("");
  });
  
  // Statistics
  const highProb = predictions.filter(p => p.analysis.graduationProbability >= 60).length;
  const medProb = predictions.filter(p => p.analysis.graduationProbability >= 40 && p.analysis.graduationProbability < 60).length;
  const lowProb = predictions.filter(p => p.analysis.graduationProbability < 40).length;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Total Analyzed: ${predictions.length}`);
  console.log(`High Probability (60%+): ${highProb}`);
  console.log(`Medium Probability (40-59%): ${medProb}`);
  console.log(`Low Probability (<40%): ${lowProb}`);
  
  // Alert for imminent graduations
  const imminent = predictions.filter(p => 
    p.analysis.graduationProbability >= 70 && 
    p.analysis.estimatedTimeToGraduation && 
    p.analysis.estimatedTimeToGraduation <= 30
  );
  
  if (imminent.length > 0) {
    console.log("\n🚨 IMMINENT GRADUATION ALERTS (Next 30 min):");
    imminent.forEach(p => {
      console.log(`  • ${p.token.symbol} - ${p.analysis.graduationProbability}% - ETA: ${p.analysis.estimatedTimeToGraduation} min`);
    });
  }
}

function savePredictions(predictions) {
  const filename = `../data/graduation-predictions-${Date.now()}.json`;
  
  const output = {
    timestamp: new Date().toISOString(),
    totalAnalyzed: predictions.length,
    thresholds: GRADUATION_THRESHOLDS,
    predictions: predictions,
    summary: {
      highProbability: predictions.filter(p => p.analysis.graduationProbability >= 60).length,
      mediumProbability: predictions.filter(p => p.analysis.graduationProbability >= 40 && p.analysis.graduationProbability < 60).length,
      lowProbability: predictions.filter(p => p.analysis.graduationProbability < 40).length
    }
  };
  
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 Predictions saved to: ${filename}`);
}

// Run prediction
predictGraduation();
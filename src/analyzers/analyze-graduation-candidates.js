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

async function analyzeGraduationCandidates() {
  console.log("🎓 ANALYZING GRADUATION CANDIDATES\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Analysis Criteria:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Volume momentum (increasing trend)");
  console.log("2. Price stability (low volatility)");
  console.log("3. Consistent buying pressure");
  console.log("4. Market cap growth rate");
  console.log("5. Time since creation");
  console.log("6. Holder count & growth");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const tokens = tokensData.tokens.slice(0, 100); // Analyze all 100
  const analysisResults = [];
  
  // Filter only non-graduated tokens
  const nonGraduatedTokens = tokens.filter(t => !t.isGraduated);
  console.log(`📝 Analyzing ${nonGraduatedTokens.length} non-graduated tokens out of 100...\n`);
  
  for (let i = 0; i < nonGraduatedTokens.length; i++) {
    const token = nonGraduatedTokens[i];
    
    console.log(`\n[${i + 1}/${nonGraduatedTokens.length}] Analyzing ${token.symbol} (${token.name})...`);
    console.log(`  Created: ${token.timeAgo}`);
    console.log(`  Current MCap: $${token.mcap.toLocaleString()}`);
    console.log(`  Holders: ${token.holderCount}`);
    
    try {
      // Fetch candlestick data
      const now = Date.now();
      const candles = 301; // 5 hours of 1-minute candles
      const url = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=mcap&quote=usd`;
      
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.candles && response.data.candles.length > 0) {
        const candleData = response.data.candles;
        
        // Analyze candlestick patterns
        const analysis = analyzeCandlesticks(candleData, token);
        
        // Calculate graduation score
        const graduationScore = calculateGraduationScore(analysis, token);
        
        analysisResults.push({
          token: {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            mcap: token.mcap,
            liquidity: token.liquidity,
            holders: token.holderCount,
            createdAt: token.createdAt,
            timeAgo: token.timeAgo,
            volume24h: token.volume24h
          },
          analysis,
          graduationScore,
          recommendation: getRecommendation(graduationScore)
        });
        
        console.log(`  ✅ Analysis complete - Score: ${graduationScore.total.toFixed(2)}/100`);
        
      } else {
        console.log("  ⚠️ No candlestick data available");
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    // 1 second delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Sort by graduation score
  analysisResults.sort((a, b) => b.graduationScore.total - a.graduationScore.total);
  
  // Save results
  saveAnalysisResults(analysisResults);
  
  // Display top candidates
  displayTopCandidates(analysisResults);
}

function analyzeCandlesticks(candles, token) {
  const analysis = {
    totalCandles: candles.length,
    timeSpanMinutes: candles.length,
    priceData: {
      firstPrice: candles[0].close,
      lastPrice: candles[candles.length - 1].close,
      highestPrice: Math.max(...candles.map(c => c.high)),
      lowestPrice: Math.min(...candles.map(c => c.low)),
      priceChange: 0,
      priceChangePercent: 0
    },
    volumeData: {
      totalVolume: 0,
      avgVolume: 0,
      maxVolume: 0,
      minVolume: Infinity,
      volumeTrend: 'neutral',
      volumeMomentum: 0
    },
    patterns: {
      greenCandles: 0,
      redCandles: 0,
      buyPressure: 0,
      volatility: 0,
      trend: 'neutral',
      momentum: 0
    },
    timeAnalysis: {
      ageInHours: token.hoursAgo || 0,
      candlesPerHour: 0,
      activeMinutes: 0
    }
  };
  
  // Calculate price metrics
  analysis.priceData.priceChange = analysis.priceData.lastPrice - analysis.priceData.firstPrice;
  analysis.priceData.priceChangePercent = (analysis.priceData.priceChange / analysis.priceData.firstPrice) * 100;
  
  // Analyze each candle
  let volumeSum = 0;
  let volumeChanges = [];
  let priceChanges = [];
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    
    // Volume analysis
    volumeSum += candle.volume;
    if (candle.volume > analysis.volumeData.maxVolume) {
      analysis.volumeData.maxVolume = candle.volume;
    }
    if (candle.volume < analysis.volumeData.minVolume && candle.volume > 0) {
      analysis.volumeData.minVolume = candle.volume;
    }
    
    // Green vs Red candles
    if (candle.close > candle.open) {
      analysis.patterns.greenCandles++;
    } else {
      analysis.patterns.redCandles++;
    }
    
    // Calculate changes for trend analysis
    if (i > 0) {
      volumeChanges.push(candle.volume - candles[i - 1].volume);
      priceChanges.push(candle.close - candles[i - 1].close);
    }
    
    // Count active minutes (with volume)
    if (candle.volume > 0) {
      analysis.timeAnalysis.activeMinutes++;
    }
  }
  
  // Calculate averages and trends
  analysis.volumeData.totalVolume = volumeSum;
  analysis.volumeData.avgVolume = volumeSum / candles.length;
  
  // Volume trend (increasing, decreasing, neutral)
  const recentVolumeAvg = candles.slice(-30).reduce((sum, c) => sum + c.volume, 0) / 30;
  const earlyVolumeAvg = candles.slice(0, 30).reduce((sum, c) => sum + c.volume, 0) / 30;
  
  if (recentVolumeAvg > earlyVolumeAvg * 1.2) {
    analysis.volumeData.volumeTrend = 'increasing';
    analysis.volumeData.volumeMomentum = (recentVolumeAvg / earlyVolumeAvg - 1) * 100;
  } else if (recentVolumeAvg < earlyVolumeAvg * 0.8) {
    analysis.volumeData.volumeTrend = 'decreasing';
    analysis.volumeData.volumeMomentum = (recentVolumeAvg / earlyVolumeAvg - 1) * 100;
  }
  
  // Calculate buy pressure
  analysis.patterns.buyPressure = (analysis.patterns.greenCandles / candles.length) * 100;
  
  // Calculate volatility
  const priceRange = analysis.priceData.highestPrice - analysis.priceData.lowestPrice;
  analysis.patterns.volatility = (priceRange / analysis.priceData.firstPrice) * 100;
  
  // Determine overall trend
  if (analysis.priceData.priceChangePercent > 20) {
    analysis.patterns.trend = 'bullish';
  } else if (analysis.priceData.priceChangePercent < -20) {
    analysis.patterns.trend = 'bearish';
  }
  
  // Calculate momentum (rate of price change)
  const recentPriceChange = candles.slice(-10).reduce((sum, c, i, arr) => {
    if (i === 0) return 0;
    return sum + (c.close - arr[i - 1].close);
  }, 0);
  analysis.patterns.momentum = recentPriceChange;
  
  // Time analysis
  analysis.timeAnalysis.candlesPerHour = 60;
  
  return analysis;
}

function calculateGraduationScore(analysis, token) {
  const score = {
    volumeScore: 0,
    priceScore: 0,
    momentumScore: 0,
    stabilityScore: 0,
    holderScore: 0,
    timeScore: 0,
    total: 0
  };
  
  // Volume Score (0-25 points)
  // High volume and increasing trend is good
  if (analysis.volumeData.totalVolume > 100000) {
    score.volumeScore += 10;
  } else if (analysis.volumeData.totalVolume > 50000) {
    score.volumeScore += 5;
  }
  
  if (analysis.volumeData.volumeTrend === 'increasing') {
    score.volumeScore += 10;
    if (analysis.volumeData.volumeMomentum > 50) {
      score.volumeScore += 5;
    }
  }
  
  // Price Score (0-20 points)
  // Positive price movement is good
  if (analysis.priceData.priceChangePercent > 50) {
    score.priceScore += 15;
  } else if (analysis.priceData.priceChangePercent > 20) {
    score.priceScore += 10;
  } else if (analysis.priceData.priceChangePercent > 0) {
    score.priceScore += 5;
  }
  
  // Add points for high market cap
  if (token.mcap > 100000) {
    score.priceScore += 5;
  }
  
  // Momentum Score (0-20 points)
  // Strong buy pressure and bullish trend
  if (analysis.patterns.buyPressure > 60) {
    score.momentumScore += 10;
  } else if (analysis.patterns.buyPressure > 50) {
    score.momentumScore += 5;
  }
  
  if (analysis.patterns.trend === 'bullish') {
    score.momentumScore += 10;
  }
  
  // Stability Score (0-15 points)
  // Lower volatility is better for graduation
  if (analysis.patterns.volatility < 50) {
    score.stabilityScore += 10;
  } else if (analysis.patterns.volatility < 100) {
    score.stabilityScore += 5;
  }
  
  // Consistent activity
  const activityRate = analysis.timeAnalysis.activeMinutes / analysis.totalCandles;
  if (activityRate > 0.5) {
    score.stabilityScore += 5;
  }
  
  // Holder Score (0-10 points)
  if (token.holderCount > 500) {
    score.holderScore += 10;
  } else if (token.holderCount > 200) {
    score.holderScore += 7;
  } else if (token.holderCount > 100) {
    score.holderScore += 5;
  } else if (token.holderCount > 50) {
    score.holderScore += 3;
  }
  
  // Time Score (0-10 points)
  // Tokens that have been around for a bit are more likely to graduate
  if (token.hoursAgo > 2 && token.hoursAgo < 6) {
    score.timeScore += 10;
  } else if (token.hoursAgo > 1) {
    score.timeScore += 7;
  } else if (token.hoursAgo > 0.5) {
    score.timeScore += 5;
  }
  
  // Calculate total
  score.total = score.volumeScore + score.priceScore + score.momentumScore + 
                score.stabilityScore + score.holderScore + score.timeScore;
  
  return score;
}

function getRecommendation(score) {
  if (score.total >= 70) {
    return "🔥 VERY HIGH - Strong graduation candidate";
  } else if (score.total >= 50) {
    return "⭐ HIGH - Good graduation potential";
  } else if (score.total >= 30) {
    return "📊 MEDIUM - Moderate graduation potential";
  } else if (score.total >= 20) {
    return "⚠️ LOW - Needs more momentum";
  } else {
    return "❌ VERY LOW - Unlikely to graduate soon";
  }
}

function saveAnalysisResults(results) {
  const filename = `graduation-analysis-${Date.now()}.json`;
  
  const output = {
    analysisTime: new Date().toISOString(),
    totalAnalyzed: results.length,
    topCandidates: results.slice(0, 20).map(r => ({
      rank: results.indexOf(r) + 1,
      ...r
    })),
    statistics: {
      avgScore: results.reduce((sum, r) => sum + r.graduationScore.total, 0) / results.length,
      highScoreCount: results.filter(r => r.graduationScore.total >= 50).length,
      mediumScoreCount: results.filter(r => r.graduationScore.total >= 30 && r.graduationScore.total < 50).length,
      lowScoreCount: results.filter(r => r.graduationScore.total < 30).length
    }
  };
  
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 Analysis saved to: ${filename}`);
}

function displayTopCandidates(results) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏆 TOP 10 GRADUATION CANDIDATES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const top10 = results.slice(0, 10);
  
  top10.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.token.symbol} (${result.token.name})`);
    console.log(`   Score: ${result.graduationScore.total.toFixed(2)}/100`);
    console.log(`   ${result.recommendation}`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   MCap: $${result.token.mcap.toLocaleString()}`);
    console.log(`   Holders: ${result.token.holders}`);
    console.log(`   24h Volume: $${result.token.volume24h.toLocaleString()}`);
    console.log(`   Created: ${result.token.timeAgo}`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Price Change: ${result.analysis.priceData.priceChangePercent.toFixed(2)}%`);
    console.log(`   Volume Trend: ${result.analysis.volumeData.volumeTrend}`);
    console.log(`   Buy Pressure: ${result.analysis.patterns.buyPressure.toFixed(1)}%`);
    console.log(`   Volatility: ${result.analysis.patterns.volatility.toFixed(1)}%`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Score Breakdown:`);
    console.log(`   - Volume: ${result.graduationScore.volumeScore}/25`);
    console.log(`   - Price: ${result.graduationScore.priceScore}/20`);
    console.log(`   - Momentum: ${result.graduationScore.momentumScore}/20`);
    console.log(`   - Stability: ${result.graduationScore.stabilityScore}/15`);
    console.log(`   - Holders: ${result.graduationScore.holderScore}/10`);
    console.log(`   - Time: ${result.graduationScore.timeScore}/10`);
  });
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 ANALYSIS SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Total Analyzed: ${results.length} tokens`);
  console.log(`High Potential (50+): ${results.filter(r => r.graduationScore.total >= 50).length} tokens`);
  console.log(`Medium Potential (30-49): ${results.filter(r => r.graduationScore.total >= 30 && r.graduationScore.total < 50).length} tokens`);
  console.log(`Low Potential (<30): ${results.filter(r => r.graduationScore.total < 30).length} tokens`);
  
  // Show tokens most likely to graduate in next hour
  const imminentGraduates = results.filter(r => 
    r.graduationScore.total >= 60 && 
    r.token.mcap > 50000 &&
    r.analysis.volumeData.volumeTrend === 'increasing'
  ).slice(0, 5);
  
  if (imminentGraduates.length > 0) {
    console.log("\n🚨 IMMINENT GRADUATION ALERTS (Next 1 Hour):");
    imminentGraduates.forEach(r => {
      console.log(`  • ${r.token.symbol} - Score: ${r.graduationScore.total.toFixed(1)}, MCap: $${r.token.mcap.toLocaleString()}`);
    });
  }
}

// Run the analysis
analyzeGraduationCandidates();
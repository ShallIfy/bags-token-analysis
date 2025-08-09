const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Headers for API requests
const headers = {
  'accept': 'application/json',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'origin': 'https://jup.ag',
  'referer': 'https://jup.ag/',
  'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
};

// Fetch tokens created in last hour
async function fetchTokensLastHour() {
  console.log("🔄 Fetching tokens created in last 1 hour...\n");
  
  const TOKEN_ADDRESS = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";
  const BASE_URL = "https://datapi.jup.ag/v1/dev/stats";
  
  const now = new Date();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  
  console.log(`⏰ Time Range:`);
  console.log(`  From: ${oneHourAgo.toLocaleString()}`);
  console.log(`  To:   ${now.toLocaleString()}\n`);
  
  let allTokensLastHour = [];
  let page = 0;
  let keepFetching = true;
  const maxPages = 10; // Max 1000 tokens to check
  
  try {
    // Fetch multiple pages until we find tokens older than 1 hour
    while (keepFetching && page < maxPages) {
      const offset = page * 100;
      
      console.log(`📄 Fetching page ${page + 1} (offset=${offset})...`);
      
      const response = await axios.get(
        `${BASE_URL}/${TOKEN_ADDRESS}?limit=100&offset=${offset}`,
        { headers, timeout: 15000 }
      );
      
      if (response.data?.topTokens && response.data.topTokens.length > 0) {
        const tokens = response.data.topTokens;
        console.log(`  ✅ Got ${tokens.length} tokens`);
        
        // Check each token's creation time
        let tokensInTimeRange = 0;
        let oldestTokenFound = false;
        
        for (const token of tokens) {
          const createdAtStr = token.firstPool?.createdAt || 
                              token.createdAt || 
                              token.graduatedAt || 
                              token.updatedAt;
          
          const createdAt = new Date(createdAtStr || '1970-01-01');
          
          // If token is within last hour, add it
          if (createdAt > oneHourAgo) {
            allTokensLastHour.push({
              ...token,
              parsedCreatedAt: createdAt,
              timestampMs: createdAt.getTime()
            });
            tokensInTimeRange++;
          } else {
            oldestTokenFound = true;
          }
        }
        
        console.log(`  📊 ${tokensInTimeRange} tokens within last hour`);
        
        // Stop if we found tokens older than 1 hour and no tokens in range
        if (oldestTokenFound && tokensInTimeRange === 0) {
          console.log("  ⏹️ Reached tokens older than 1 hour, stopping...");
          keepFetching = false;
        } else if (tokensInTimeRange < tokens.length / 2) {
          // If less than half are in range, we're probably at the edge
          console.log("  ⚠️ Found older tokens, one more page check...");
          if (page >= 2) keepFetching = false; // Check at most 3 pages when at edge
        }
        
      } else {
        console.log("  ❌ No more tokens available");
        keepFetching = false;
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 200));
      
    }
    
    console.log(`\n📊 Total tokens found in last hour: ${allTokensLastHour.length}`);
    
    // Sort by creation time (newest first)
    allTokensLastHour.sort((a, b) => b.timestampMs - a.timestampMs);
    
    // Prepare enhanced data
    const enhancedData = allTokensLastHour.map((token, index) => {
      const minutesAgo = (now - token.parsedCreatedAt) / (1000 * 60);
      
      return {
        rank: index + 1,
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        createdAt: token.parsedCreatedAt.toISOString(),
        minutesAgo: parseFloat(minutesAgo.toFixed(2)),
        timeAgo: formatTimeAgo(minutesAgo),
        mcap: token.mcap || 0,
        liquidity: token.liquidity || 0,
        holderCount: token.holderCount || 0,
        price: token.usdPrice || 0,
        volume24h: (token.stats24h?.buyVolume || 0) + (token.stats24h?.sellVolume || 0),
        priceChange24h: token.stats24h?.priceChange || 0,
        isGraduated: !!token.graduatedPool,
        isVerified: token.isVerified || false
      };
    });
    
    // Show statistics
    const graduated = enhancedData.filter(t => t.isGraduated).length;
    const nonGraduated = enhancedData.filter(t => !t.isGraduated).length;
    
    console.log(`\n📈 Token Statistics (Last Hour):`);
    console.log(`  Total: ${enhancedData.length}`);
    console.log(`  Graduated: ${graduated} (${((graduated/enhancedData.length)*100).toFixed(1)}%)`);
    console.log(`  Non-graduated: ${nonGraduated} (${((nonGraduated/enhancedData.length)*100).toFixed(1)}%)`);
    
    // Time distribution
    const timeGroups = {
      '0-10 min': enhancedData.filter(t => t.minutesAgo <= 10).length,
      '10-20 min': enhancedData.filter(t => t.minutesAgo > 10 && t.minutesAgo <= 20).length,
      '20-30 min': enhancedData.filter(t => t.minutesAgo > 20 && t.minutesAgo <= 30).length,
      '30-45 min': enhancedData.filter(t => t.minutesAgo > 30 && t.minutesAgo <= 45).length,
      '45-60 min': enhancedData.filter(t => t.minutesAgo > 45 && t.minutesAgo <= 60).length
    };
    
    console.log(`\n⏱️ Time Distribution:`);
    Object.entries(timeGroups).forEach(([range, count]) => {
      if (count > 0) {
        console.log(`  ${range}: ${count} tokens`);
      }
    });
    
    return {
      dev: TOKEN_ADDRESS,
      totalTokens: enhancedData.length,
      fetchedAt: now.toISOString(),
      timeRange: {
        from: oneHourAgo.toISOString(),
        to: now.toISOString()
      },
      tokens: enhancedData
    };
    
  } catch (error) {
    console.error("❌ Error fetching tokens:", error.message);
    return null;
  }
}

// Analyze graduation candidates with V1 logic
async function analyzeGraduationCandidates(tokensData) {
  console.log("\n🎓 V1 GRADUATION ANALYSIS (Volume-Based)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Analysis Criteria:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Volume momentum (increasing trend)");
  console.log("2. Price stability (low volatility)");
  console.log("3. Consistent buying pressure");
  console.log("4. Market cap growth rate");
  console.log("5. Time since creation (optimal: 10-60 min)");
  console.log("6. Holder count & growth");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const tokens = tokensData.tokens;
  const nonGraduatedTokens = tokens.filter(token => !token.isGraduated);
  
  console.log(`📝 Analyzing ${nonGraduatedTokens.length} non-graduated tokens from last hour...\n`);
  
  if (nonGraduatedTokens.length === 0) {
    console.log("⚠️ No non-graduated tokens found in the last hour!");
    return [];
  }
  
  const graduationScores = [];
  let errorCount = 0;
  
  // Analyze all non-graduated tokens from last hour
  for (let i = 0; i < nonGraduatedTokens.length; i++) {
    const token = nonGraduatedTokens[i];
    
    console.log(`\n[${i + 1}/${nonGraduatedTokens.length}] Analyzing ${token.symbol} (${token.name})...`);
    console.log(`  Created: ${token.timeAgo} (${token.minutesAgo.toFixed(1)} min ago)`);
    console.log(`  Current MCap: $${token.mcap.toLocaleString()}`);
    console.log(`  Holders: ${token.holderCount}`);
    console.log(`  24h Volume: $${token.volume24h.toLocaleString()}`);
    
    try {
      // Fetch candlestick data
      const now = Date.now();
      const candles = Math.min(301, Math.floor(token.minutesAgo) + 60);
      const url = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=mcap&quote=usd`;
      
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.candles && response.data.candles.length > 0) {
        const score = calculateV1GraduationScore(response.data.candles, token);
        
        graduationScores.push({
          token: {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            mcap: token.mcap,
            holders: token.holderCount,
            createdAt: token.createdAt,
            minutesAgo: token.minutesAgo,
            timeAgo: token.timeAgo
          },
          score: score.total,
          details: score
        });
        
        console.log(`  ✅ Analysis complete - Score: ${score.total.toFixed(2)}/100`);
        
        // Show key metrics
        if (score.total >= 50) {
          console.log(`  ⭐ HIGH probability - Volume: ${score.volume}/25, Time: ${score.time}/10`);
        }
        
      } else {
        console.log("  ⚠️ No candlestick data available");
        errorCount++;
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errorCount++;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Sort by score
  graduationScores.sort((a, b) => b.score - a.score);
  
  // Display top candidates
  displayTopCandidates(graduationScores);
  
  // Save results
  saveAnalysisResults(graduationScores, tokensData.timeRange);
  
  return graduationScores;
}

function calculateV1GraduationScore(candles, token) {
  const score = {
    volume: 0,
    price: 0,
    momentum: 0,
    stability: 0,
    holders: 0,
    time: 0,
    total: 0
  };
  
  // Calculate cumulative volume
  const cumulativeVolume = candles.reduce((sum, c) => sum + c.volume, 0);
  
  // Volume analysis with thresholds (0-25 points)
  // Based on our findings: need ~$450K total for graduation
  if (cumulativeVolume > 400000) score.volume = 25;
  else if (cumulativeVolume > 300000) score.volume = 20;
  else if (cumulativeVolume > 200000) score.volume = 15;
  else if (cumulativeVolume > 100000) score.volume = 10;
  else if (cumulativeVolume > 50000) score.volume = 5;
  
  // Check volume at key checkpoints
  let volume10min = 0;
  let volume30min = 0;
  if (candles.length > 9) {
    volume10min = candles.slice(0, 10).reduce((sum, c) => sum + c.volume, 0);
  }
  if (candles.length > 29) {
    volume30min = candles.slice(0, 30).reduce((sum, c) => sum + c.volume, 0);
  }
  
  // Bonus for meeting checkpoint thresholds
  if (volume10min > 227514) score.volume = Math.min(25, score.volume + 5);
  if (volume30min > 458057) score.volume = 25; // Max score if 30-min threshold met
  
  // Price trend (0-20 points)
  if (candles.length > 10) {
    const firstPrice = candles[0].close;
    const lastPrice = candles[candles.length - 1].close;
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    if (priceChange > 100) score.price = 20;
    else if (priceChange > 50) score.price = 15;
    else if (priceChange > 20) score.price = 10;
    else if (priceChange > 0) score.price = 5;
  }
  
  // Momentum (0-20 points)
  if (candles.length >= 10) {
    const recentVolume = candles.slice(-5).reduce((sum, c) => sum + c.volume, 0);
    const earlierVolume = candles.slice(0, 5).reduce((sum, c) => sum + c.volume, 0);
    
    if (recentVolume > earlierVolume * 2) score.momentum = 20;
    else if (recentVolume > earlierVolume * 1.5) score.momentum = 15;
    else if (recentVolume > earlierVolume) score.momentum = 10;
    else if (recentVolume > earlierVolume * 0.7) score.momentum = 5;
  }
  
  // Stability (0-15 points)
  const priceVolatility = calculateVolatility(candles);
  if (priceVolatility < 10) score.stability = 15;
  else if (priceVolatility < 25) score.stability = 10;
  else if (priceVolatility < 50) score.stability = 5;
  
  // Holder score (0-10 points)
  if (token.holderCount > 100) score.holders = 10;
  else if (token.holderCount > 50) score.holders = 7;
  else if (token.holderCount > 25) score.holders = 5;
  else if (token.holderCount > 10) score.holders = 3;
  
  // Time score - OPTIMAL WINDOW (0-10 points)
  const minutesOld = token.minutesAgo;
  if (minutesOld >= 10 && minutesOld <= 60) {
    score.time = 10; // Optimal window for graduation
  } else if (minutesOld < 10) {
    score.time = 5; // Too early but possible
  } else {
    score.time = 3; // Getting late
  }
  
  score.total = score.volume + score.price + score.momentum + 
                score.stability + score.holders + score.time;
  
  // Add detailed metrics for display
  score.cumulativeVolume = cumulativeVolume;
  score.volume10min = volume10min;
  score.volume30min = volume30min;
  
  return score;
}

function calculateVolatility(candles) {
  if (candles.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < candles.length; i++) {
    const change = ((candles[i].close - candles[i-1].close) / candles[i-1].close) * 100;
    returns.push(change);
  }
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

function displayTopCandidates(graduationScores) {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🏆 TOP GRADUATION CANDIDATES (Last Hour)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  if (graduationScores.length === 0) {
    console.log("No candidates to display.\n");
    return;
  }
  
  const topCandidates = graduationScores.slice(0, Math.min(10, graduationScores.length));
  
  topCandidates.forEach((item, index) => {
    const prob = item.score >= 50 ? "HIGH" : item.score >= 30 ? "MEDIUM" : "LOW";
    const emoji = item.score >= 50 ? "⭐" : item.score >= 30 ? "📊" : "⚠️";
    
    console.log(`${index + 1}. ${item.token.symbol} (${item.token.name})`);
    console.log(`   Score: ${item.score.toFixed(2)}/100`);
    console.log(`   ${emoji} ${prob} - ${getRecommendation(item.score)}`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   MCap: $${item.token.mcap.toLocaleString()}`);
    console.log(`   Holders: ${item.token.holders}`);
    console.log(`   Age: ${item.token.timeAgo}`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Volume Metrics:`);
    console.log(`   - Total: $${item.details.cumulativeVolume.toLocaleString()}`);
    console.log(`   - 10-min: $${item.details.volume10min.toLocaleString()} (need $227K)`);
    console.log(`   - 30-min: $${item.details.volume30min.toLocaleString()} (need $458K)`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Score Breakdown:`);
    console.log(`   - Volume: ${item.details.volume}/25`);
    console.log(`   - Price: ${item.details.price}/20`);
    console.log(`   - Momentum: ${item.details.momentum}/20`);
    console.log(`   - Stability: ${item.details.stability}/15`);
    console.log(`   - Holders: ${item.details.holders}/10`);
    console.log(`   - Time: ${item.details.time}/10\n`);
  });
  
  // Show summary
  const high = graduationScores.filter(s => s.score >= 50).length;
  const medium = graduationScores.filter(s => s.score >= 30 && s.score < 50).length;
  const low = graduationScores.filter(s => s.score < 30).length;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Total Analyzed: ${graduationScores.length}`);
  console.log(`High Probability (50+): ${high}`);
  console.log(`Medium Probability (30-49): ${medium}`);
  console.log(`Low Probability (<30): ${low}`);
}

function getRecommendation(score) {
  if (score >= 50) return "Good graduation potential";
  if (score >= 30) return "Moderate graduation potential";
  return "Low graduation potential";
}

function saveAnalysisResults(graduationScores, timeRange) {
  const filename = `v1-graduation-analysis-${Date.now()}.json`;
  const dataDir = path.join(__dirname, '../../data');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const filepath = path.join(dataDir, filename);
  
  const output = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    timeRange: timeRange,
    totalAnalyzed: graduationScores.length,
    results: graduationScores,
    summary: {
      high: graduationScores.filter(s => s.score >= 50).length,
      medium: graduationScores.filter(s => s.score >= 30 && s.score < 50).length,
      low: graduationScores.filter(s => s.score < 30).length
    }
  };
  
  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Analysis saved to: data/${filename}`);
}

function formatTimeAgo(minutes) {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)} minutes ago`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hours ago`;
  return `${(minutes / 1440).toFixed(1)} days ago`;
}

// Main function
async function main() {
  console.log("🚀 V1 GRADUATION ANALYSIS - LAST HOUR TOKENS\n");
  console.log("═══════════════════════════════════════════════\n");
  
  // Step 1: Fetch tokens from last hour
  const tokensData = await fetchTokensLastHour();
  
  if (!tokensData || tokensData.tokens.length === 0) {
    console.error("❌ No tokens found in the last hour. Try again later.");
    process.exit(1);
  }
  
  // Step 2: Analyze graduation candidates
  await analyzeGraduationCandidates(tokensData);
  
  console.log("\n✅ V1 Analysis complete!");
}

// Run the analysis
main().catch(error => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});
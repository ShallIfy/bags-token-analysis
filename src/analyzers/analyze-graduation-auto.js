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

// First, fetch latest tokens
async function fetchLatestTokens() {
  console.log("🔄 Fetching latest 100 tokens from BAGS...\n");
  
  const TOKEN_ADDRESS = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";
  const BASE_URL = "https://datapi.jup.ag/v1/dev/stats";
  
  try {
    const response = await axios.get(
      `${BASE_URL}/${TOKEN_ADDRESS}?limit=100`,
      { headers, timeout: 15000 }
    );
    
    if (response.data?.topTokens && response.data.topTokens.length > 0) {
      const tokens = response.data.topTokens;
      
      // Sort by creation time (newest first)
      const tokensWithParsedTime = tokens.map(token => {
        const createdAtStr = token.firstPool?.createdAt || 
                            token.createdAt || 
                            token.graduatedAt || 
                            token.updatedAt;
        
        let createdDate = new Date(createdAtStr || '1970-01-01');
        
        return {
          ...token,
          parsedCreatedAt: createdDate,
          timestampMs: createdDate.getTime()
        };
      });
      
      tokensWithParsedTime.sort((a, b) => b.timestampMs - a.timestampMs);
      
      // Prepare enhanced data
      const now = new Date();
      const enhancedData = tokensWithParsedTime.map((token, index) => {
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
          isVerified: token.isVerified || false,
          website: token.website,
          twitter: token.twitter,
          icon: token.icon
        };
      });
      
      const dataToSave = {
        dev: TOKEN_ADDRESS,
        totalTokens: enhancedData.length,
        fetchedAt: now.toISOString(),
        tokens: enhancedData
      };
      
      console.log(`✅ Fetched ${enhancedData.length} tokens`);
      console.log(`  Graduated: ${enhancedData.filter(t => t.isGraduated).length}`);
      console.log(`  Non-graduated: ${enhancedData.filter(t => !t.isGraduated).length}\n`);
      
      return dataToSave;
    }
    
  } catch (error) {
    console.error("❌ Error fetching tokens:", error.message);
    return null;
  }
}

// Analyze graduation candidates
async function analyzeGraduationCandidates(tokensData) {
  console.log("🎓 ANALYZING GRADUATION CANDIDATES");
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
  
  const tokens = tokensData.tokens;
  const nonGraduatedTokens = tokens.filter(token => !token.isGraduated);
  
  console.log(`📝 Analyzing ${nonGraduatedTokens.length} non-graduated tokens out of ${tokens.length}...\n`);
  
  const graduationScores = [];
  let errorCount = 0;
  
  // Limit to first 20 for demo (remove limit for full analysis)
  const tokensToAnalyze = nonGraduatedTokens.slice(0, 20);
  
  for (let i = 0; i < tokensToAnalyze.length; i++) {
    const token = tokensToAnalyze[i];
    
    console.log(`\n[${i + 1}/${tokensToAnalyze.length}] Analyzing ${token.symbol} (${token.name})...`);
    console.log(`  Created: ${token.timeAgo}`);
    console.log(`  Current MCap: $${token.mcap.toLocaleString()}`);
    console.log(`  Holders: ${token.holderCount}`);
    
    try {
      // Fetch candlestick data
      const now = Date.now();
      const candles = 301;
      const url = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=${candles}&type=mcap&quote=usd`;
      
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.candles && response.data.candles.length > 0) {
        const score = calculateGraduationScore(response.data.candles, token);
        
        graduationScores.push({
          token: {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            mcap: token.mcap,
            holders: token.holderCount,
            createdAt: token.createdAt,
            timeAgo: token.timeAgo
          },
          score: score.total,
          details: score
        });
        
        console.log(`  ✅ Analysis complete - Score: ${score.total.toFixed(2)}/100`);
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
  saveAnalysisResults(graduationScores);
  
  return graduationScores;
}

function calculateGraduationScore(candles, token) {
  const score = {
    volume: 0,
    price: 0,
    momentum: 0,
    stability: 0,
    holders: 0,
    time: 0,
    total: 0
  };
  
  // Volume analysis (0-25 points)
  const totalVolume = candles.reduce((sum, c) => sum + c.volume, 0);
  if (totalVolume > 1000000) score.volume = 25;
  else if (totalVolume > 500000) score.volume = 20;
  else if (totalVolume > 250000) score.volume = 15;
  else if (totalVolume > 100000) score.volume = 10;
  else if (totalVolume > 50000) score.volume = 5;
  
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
  
  // Time score (0-10 points)
  const minutesOld = token.minutesAgo;
  if (minutesOld >= 30 && minutesOld <= 120) score.time = 10;
  else if (minutesOld >= 15 && minutesOld <= 240) score.time = 7;
  else if (minutesOld >= 10) score.time = 5;
  
  score.total = score.volume + score.price + score.momentum + 
                score.stability + score.holders + score.time;
  
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
  console.log("🏆 TOP 10 GRADUATION CANDIDATES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const top10 = graduationScores.slice(0, 10);
  
  top10.forEach((item, index) => {
    const prob = item.score >= 50 ? "HIGH" : item.score >= 30 ? "MEDIUM" : "LOW";
    const emoji = item.score >= 50 ? "⭐" : item.score >= 30 ? "📊" : "⚠️";
    
    console.log(`${index + 1}. ${item.token.symbol} (${item.token.name})`);
    console.log(`   Score: ${item.score.toFixed(2)}/100`);
    console.log(`   ${emoji} ${prob} - ${getRecommendation(item.score)}`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   MCap: $${item.token.mcap.toLocaleString()}`);
    console.log(`   Holders: ${item.token.holders}`);
    console.log(`   Created: ${item.token.timeAgo}`);
    console.log(`   ━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Score Breakdown:`);
    console.log(`   - Volume: ${item.details.volume}/25`);
    console.log(`   - Price: ${item.details.price}/20`);
    console.log(`   - Momentum: ${item.details.momentum}/20`);
    console.log(`   - Stability: ${item.details.stability}/15`);
    console.log(`   - Holders: ${item.details.holders}/10`);
    console.log(`   - Time: ${item.details.time}/10\n`);
  });
}

function getRecommendation(score) {
  if (score >= 50) return "Good graduation potential";
  if (score >= 30) return "Moderate graduation potential";
  return "Low graduation potential";
}

function saveAnalysisResults(graduationScores) {
  const filename = `graduation-analysis-${Date.now()}.json`;
  const dataDir = path.join(__dirname, '../../data');
  
  // Create data directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const filepath = path.join(dataDir, filename);
  
  const output = {
    timestamp: new Date().toISOString(),
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
  console.log("🚀 V1 GRADUATION ANALYSIS - AUTO FETCH\n");
  console.log("═══════════════════════════════════════\n");
  
  // Step 1: Fetch latest tokens
  const tokensData = await fetchLatestTokens();
  
  if (!tokensData) {
    console.error("❌ Failed to fetch tokens. Exiting...");
    process.exit(1);
  }
  
  // Step 2: Analyze graduation candidates
  await analyzeGraduationCandidates(tokensData);
  
  console.log("\n✅ Analysis complete!");
}

// Run the analysis
main().catch(error => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});
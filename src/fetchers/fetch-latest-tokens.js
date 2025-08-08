const axios = require('axios');
const fs = require('fs');

async function fetchAllTokensLastHour() {
  console.log("🚀 Fetching All BAGS Tokens Created in Last 1 Hour\n");
  
  const TOKEN_ADDRESS = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";
  const BASE_URL = "https://datapi.jup.ag/v1/dev/stats";
  
  // Headers from curl
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
  
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Step 1: Fetching Large Batch of Tokens");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000); // 1 hour ago
    
    console.log(`Current UTC time: ${now.toISOString()}`);
    console.log(`Looking for tokens created after: ${oneHourAgo.toISOString()}\n`);
    
    let allTokens = [];
    const pagesToFetch = 10; // Fetch 1000 tokens first
    
    // Fetch multiple pages
    for (let page = 0; page < pagesToFetch; page++) {
      const offset = page * 100;
      
      console.log(`📄 Fetching page ${page + 1} (offset=${offset})...`);
      
      try {
        const response = await axios.get(
          `${BASE_URL}/${TOKEN_ADDRESS}?limit=100&offset=${offset}`,
          { 
            headers,
            timeout: 15000
          }
        );
        
        if (response.data?.topTokens && response.data.topTokens.length > 0) {
          const tokens = response.data.topTokens;
          console.log(`  ✅ Got ${tokens.length} tokens`);
          allTokens = allTokens.concat(tokens);
        } else {
          console.log("  ❌ No more tokens available");
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.response?.status || error.message}`);
        break;
      }
    }
    
    console.log(`\n📊 Total tokens fetched: ${allTokens.length}`);
    
    // Step 2: Sort ALL tokens by creation time
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⏰ Step 2: Sorting by Creation Time");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    // Add timestamp parsing for each token
    const tokensWithParsedTime = allTokens.map(token => {
      const createdAtStr = token.firstPool?.createdAt || 
                          token.createdAt || 
                          token.graduatedAt || 
                          token.updatedAt;
      
      let createdDate;
      if (!createdAtStr) {
        createdDate = new Date('1970-01-01');
      } else if (typeof createdAtStr === 'number') {
        createdDate = new Date(createdAtStr);
      } else {
        createdDate = new Date(createdAtStr);
      }
      
      return {
        ...token,
        parsedCreatedAt: createdDate,
        timestampMs: createdDate.getTime()
      };
    });
    
    // Sort by creation time (newest first)
    tokensWithParsedTime.sort((a, b) => b.timestampMs - a.timestampMs);
    
    console.log(`Newest token created: ${tokensWithParsedTime[0]?.parsedCreatedAt?.toISOString() || 'N/A'}`);
    console.log(`Oldest token in batch: ${tokensWithParsedTime[tokensWithParsedTime.length - 1]?.parsedCreatedAt?.toISOString() || 'N/A'}`);
    
    // Step 3: Filter tokens from last hour
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 Step 3: Filtering Last Hour Tokens");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    const oneHourAgoMs = oneHourAgo.getTime();
    const tokensLastHour = tokensWithParsedTime.filter(token => token.timestampMs > oneHourAgoMs);
    
    console.log(`✅ Found ${tokensLastHour.length} tokens created in last hour\n`);
    
    // Time distribution analysis
    const timeGroups = {
      '0-5 minutes': 0,
      '5-10 minutes': 0,
      '10-15 minutes': 0,
      '15-30 minutes': 0,
      '30-45 minutes': 0,
      '45-60 minutes': 0
    };
    
    tokensLastHour.forEach(token => {
      const minutesAgo = (now - token.parsedCreatedAt) / (1000 * 60);
      
      if (minutesAgo <= 5) timeGroups['0-5 minutes']++;
      else if (minutesAgo <= 10) timeGroups['5-10 minutes']++;
      else if (minutesAgo <= 15) timeGroups['10-15 minutes']++;
      else if (minutesAgo <= 30) timeGroups['15-30 minutes']++;
      else if (minutesAgo <= 45) timeGroups['30-45 minutes']++;
      else if (minutesAgo <= 60) timeGroups['45-60 minutes']++;
    });
    
    console.log("📅 Time Distribution:");
    for (const [period, count] of Object.entries(timeGroups)) {
      if (count > 0) {
        const percentage = ((count / tokensLastHour.length) * 100).toFixed(1);
        console.log(`  ${period}: ${count} tokens (${percentage}%)`);
      }
    }
    
    // Prepare enhanced data
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💾 Step 4: Saving Enhanced Data");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    const enhancedData = tokensLastHour.map((token, index) => {
      const minutesAgo = (now - token.parsedCreatedAt) / (1000 * 60);
      
      return {
        rank: index + 1,
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        createdAt: token.parsedCreatedAt.toISOString(),
        createdAtLocal: token.parsedCreatedAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
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
    
    const filename = `tokens-last-hour-${Date.now()}.json`;
    
    const outputData = {
      dev: TOKEN_ADDRESS,
      totalTokens: tokensLastHour.length,
      fetchedAt: now.toISOString(),
      fetchedAtLocal: now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      timeRange: {
        from: oneHourAgo.toISOString(),
        to: now.toISOString()
      },
      oldestToken: enhancedData.length > 0 ? {
        symbol: enhancedData[enhancedData.length - 1].symbol,
        createdAt: enhancedData[enhancedData.length - 1].createdAt,
        timeAgo: enhancedData[enhancedData.length - 1].timeAgo,
        minutesAgo: enhancedData[enhancedData.length - 1].minutesAgo
      } : null,
      newestToken: enhancedData.length > 0 ? {
        symbol: enhancedData[0].symbol,
        createdAt: enhancedData[0].createdAt,
        timeAgo: enhancedData[0].timeAgo,
        minutesAgo: enhancedData[0].minutesAgo
      } : null,
      timeDistribution: timeGroups,
      statistics: {
        avgMarketCap: enhancedData.length > 0 ? 
          enhancedData.reduce((sum, t) => sum + t.mcap, 0) / enhancedData.length : 0,
        avgLiquidity: enhancedData.length > 0 ?
          enhancedData.reduce((sum, t) => sum + t.liquidity, 0) / enhancedData.length : 0,
        avgHolders: enhancedData.length > 0 ?
          Math.round(enhancedData.reduce((sum, t) => sum + t.holderCount, 0) / enhancedData.length) : 0,
        graduated: enhancedData.filter(t => t.isGraduated).length,
        nonGraduated: enhancedData.filter(t => !t.isGraduated).length,
        verified: enhancedData.filter(t => t.isVerified).length,
        totalVolume24h: enhancedData.reduce((sum, t) => sum + t.volume24h, 0)
      },
      tokens: enhancedData
    };
    
    fs.writeFileSync(filename, JSON.stringify(outputData, null, 2));
    console.log(`✅ Data saved to: ${filename}`);
    
    // Show summary
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 SUMMARY - Tokens from Last Hour");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    console.log(`📈 Token Statistics:`);
    console.log(`  Total tokens in last hour: ${tokensLastHour.length}`);
    
    if (tokensLastHour.length > 0) {
      console.log(`  Graduated: ${outputData.statistics.graduated} (${((outputData.statistics.graduated/tokensLastHour.length)*100).toFixed(1)}%)`);
      console.log(`  Non-graduated: ${outputData.statistics.nonGraduated}`);
      console.log(`  Verified: ${outputData.statistics.verified}`);
      console.log(`  Avg Market Cap: $${outputData.statistics.avgMarketCap.toLocaleString()}`);
      console.log(`  Avg Holders: ${outputData.statistics.avgHolders}`);
      console.log(`  Total 24h Volume: $${outputData.statistics.totalVolume24h.toLocaleString()}`);
      
      console.log("\n🆕 All Tokens from Last Hour (Newest First):");
      enhancedData.slice(0, Math.min(20, enhancedData.length)).forEach(token => {
        console.log(`\n${token.rank}. ${token.symbol} (${token.name})`);
        console.log(`   Created: ${token.timeAgo} (${token.minutesAgo.toFixed(1)} min ago)`);
        console.log(`   MCap: $${token.mcap.toLocaleString()}`);
        console.log(`   Holders: ${token.holderCount}`);
        console.log(`   24h Volume: $${token.volume24h.toLocaleString()}`);
        console.log(`   Status: ${token.isGraduated ? '🎓 Graduated' : '📈 Active'}`);
      });
      
      if (enhancedData.length > 20) {
        console.log(`\n... and ${enhancedData.length - 20} more tokens`);
      }
      
      // Show graduated tokens separately
      const graduatedTokens = enhancedData.filter(t => t.isGraduated);
      if (graduatedTokens.length > 0) {
        console.log("\n🎓 Graduated Tokens from Last Hour:");
        graduatedTokens.forEach((token, i) => {
          console.log(`${i + 1}. ${token.symbol} - Created ${token.timeAgo}, MCap: $${token.mcap.toLocaleString()}`);
        });
      }
    }
    
    console.log("\n✅ Analysis complete!");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.log("Response status:", error.response.status);
    }
  }
}

// Helper function to format time ago
function formatTimeAgo(minutes) {
  if (minutes < 1) {
    return "just now";
  } else if (minutes < 60) {
    return `${Math.round(minutes)} minutes ago`;
  } else {
    return `${(minutes / 60).toFixed(1)} hours ago`;
  }
}

// Run
fetchAllTokensLastHour();
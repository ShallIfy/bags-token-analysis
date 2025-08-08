const axios = require('axios');
const fs = require('fs');

async function fetchBags1000Records() {
  console.log("🚀 Fetching 1000 BAGS Token Records from Jupiter\n");
  
  const TOKEN_ADDRESS = "BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv";
  const BASE_URL = "https://datapi.jup.ag/v1/dev/stats";
  
  // Correct headers from curl
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
    let allTokens = [];
    
    // ================================================
    // Method 1: Fetch with different limits
    // ================================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Fetching Token Data");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Test different limits to find maximum
    const limits = [50, 100, 200, 500, 1000, 2000];
    let maxWorkingLimit = 50;
    
    for (const limit of limits) {
      try {
        console.log(`\n🔸 Testing limit=${limit}...`);
        
        const response = await axios.get(
          `${BASE_URL}/${TOKEN_ADDRESS}?limit=${limit}`,
          { 
            headers,
            timeout: 30000
          }
        );
        
        if (response.data) {
          // Check if we got topTokens array
          if (response.data.topTokens && Array.isArray(response.data.topTokens)) {
            const tokens = response.data.topTokens;
            console.log(`  ✅ Got ${tokens.length} tokens`);
            maxWorkingLimit = limit;
            allTokens = tokens;
            
            if (tokens.length >= 1000) {
              console.log(`  🎯 Got 1000+ tokens directly!`);
              break;
            }
          } else {
            console.log(`  ⚠️ No topTokens array found`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Limit ${limit} failed: ${error.response?.status || error.message}`);
        break; // Stop if we hit an error
      }
    }
    
    // ================================================
    // Method 2: Multiple requests with offset/pagination
    // ================================================
    if (allTokens.length < 1000) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📄 Trying Pagination");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      const pageSize = maxWorkingLimit;
      const totalNeeded = 1000;
      const pagesNeeded = Math.ceil(totalNeeded / pageSize);
      
      // Reset tokens array
      allTokens = [];
      const uniqueTokenIds = new Set();
      
      for (let page = 0; page < pagesNeeded; page++) {
        const offset = page * pageSize;
        
        console.log(`\n📄 Page ${page + 1}/${pagesNeeded} (offset=${offset})...`);
        
        // Try different pagination params
        const urls = [
          `${BASE_URL}/${TOKEN_ADDRESS}?limit=${pageSize}&offset=${offset}`,
          `${BASE_URL}/${TOKEN_ADDRESS}?limit=${pageSize}&skip=${offset}`,
          `${BASE_URL}/${TOKEN_ADDRESS}?limit=${pageSize}&page=${page}`,
          `${BASE_URL}/${TOKEN_ADDRESS}?limit=${pageSize}&from=${offset}`
        ];
        
        let pageTokens = null;
        
        for (const url of urls) {
          try {
            const response = await axios.get(url, { headers, timeout: 15000 });
            
            if (response.data?.topTokens) {
              pageTokens = response.data.topTokens;
              console.log(`  ✅ Got ${pageTokens.length} tokens`);
              break;
            }
          } catch (e) {
            // Try next URL format
          }
        }
        
        if (pageTokens && pageTokens.length > 0) {
          // Add unique tokens only
          let newTokens = 0;
          for (const token of pageTokens) {
            if (!uniqueTokenIds.has(token.id)) {
              uniqueTokenIds.add(token.id);
              allTokens.push(token);
              newTokens++;
            }
          }
          
          console.log(`  📊 Added ${newTokens} new unique tokens`);
          console.log(`  📊 Total unique: ${allTokens.length}`);
          
          if (allTokens.length >= 1000) {
            console.log(`  🎯 Reached 1000+ tokens!`);
            break;
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          console.log(`  ⚠️ No more data available`);
          break;
        }
      }
    }
    
    // ================================================
    // Method 3: Fetch by time periods
    // ================================================
    if (allTokens.length < 1000) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📅 Fetching by Time Periods");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      
      // Try different time ranges
      for (let days = 1; days <= 30; days += 7) {
        const from = now - (days * dayMs);
        
        try {
          console.log(`\n📅 Fetching last ${days} days...`);
          
          const response = await axios.get(
            `${BASE_URL}/${TOKEN_ADDRESS}?limit=${maxWorkingLimit}&from=${from}&to=${now}`,
            { headers, timeout: 15000 }
          );
          
          if (response.data?.topTokens) {
            const tokens = response.data.topTokens;
            console.log(`  ✅ Got ${tokens.length} tokens`);
            
            // Merge unique tokens
            const uniqueIds = new Set(allTokens.map(t => t.id));
            let added = 0;
            
            for (const token of tokens) {
              if (!uniqueIds.has(token.id)) {
                allTokens.push(token);
                uniqueIds.add(token.id);
                added++;
              }
            }
            
            console.log(`  📊 Added ${added} new tokens`);
            console.log(`  📊 Total: ${allTokens.length}`);
            
            if (allTokens.length >= 1000) break;
          }
        } catch (error) {
          console.log(`  ❌ Error: ${error.response?.status || error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // ================================================
    // SAVE RESULTS
    // ================================================
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💾 SAVING RESULTS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Limit to 1000 if we got more
    const finalTokens = allTokens.slice(0, 1000);
    
    console.log(`✅ Total unique tokens: ${finalTokens.length}`);
    
    if (finalTokens.length > 0) {
      const filename = `bags-tokens-${Date.now()}.json`;
      
      // Prepare data with statistics
      const data = {
        dev: TOKEN_ADDRESS,
        totalTokens: finalTokens.length,
        fetchedAt: new Date().toISOString(),
        statistics: {
          totalCreated: finalTokens.length,
          graduated: finalTokens.filter(t => t.graduatedPool).length,
          verified: finalTokens.filter(t => t.isVerified).length,
          totalLiquidity: finalTokens.reduce((sum, t) => sum + (t.liquidity || 0), 0),
          totalMarketCap: finalTokens.reduce((sum, t) => sum + (t.mcap || 0), 0),
          avgHolders: Math.round(finalTokens.reduce((sum, t) => sum + (t.holderCount || 0), 0) / finalTokens.length)
        },
        tokens: finalTokens
      };
      
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`\n💾 Data saved to: ${filename}`);
      
      // Show summary
      console.log("\n📊 Summary Statistics:");
      console.log(`  Total Tokens: ${data.statistics.totalCreated}`);
      console.log(`  Graduated: ${data.statistics.graduated}`);
      console.log(`  Verified: ${data.statistics.verified}`);
      console.log(`  Total Liquidity: $${data.statistics.totalLiquidity.toLocaleString()}`);
      console.log(`  Total Market Cap: $${data.statistics.totalMarketCap.toLocaleString()}`);
      console.log(`  Avg Holders: ${data.statistics.avgHolders}`);
      
      // Show top 5 tokens by market cap
      console.log("\n🏆 Top 5 Tokens by Market Cap:");
      const top5 = finalTokens
        .sort((a, b) => (b.mcap || 0) - (a.mcap || 0))
        .slice(0, 5);
      
      top5.forEach((token, i) => {
        console.log(`  ${i + 1}. ${token.symbol} (${token.name})`);
        console.log(`     MCap: $${(token.mcap || 0).toLocaleString()}`);
        console.log(`     Holders: ${token.holderCount}`);
        console.log(`     Liquidity: $${(token.liquidity || 0).toLocaleString()}`);
      });
      
    } else {
      console.log("❌ No tokens fetched");
    }
    
    // ================================================
    // RECOMMENDATIONS
    // ================================================
    if (finalTokens.length < 1000) {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("💡 HOW TO GET MORE DATA:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1. The API returned only", finalTokens.length, "tokens");
      console.log("2. This might be all available tokens for this dev");
      console.log("3. To get more data, you could:");
      console.log("   - Use WebSocket for real-time updates");
      console.log("   - Combine data from multiple time periods");
      console.log("   - Use Jupiter's GraphQL API if available");
      console.log("   - Fetch data for multiple dev wallets");
    }
    
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    if (error.response) {
      console.log("Response status:", error.response.status);
    }
  }
}

// Run
fetchBags1000Records();
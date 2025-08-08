const axios = require('axios');
const fs = require('fs');

const headers = {
  'accept': 'application/json',
  'user-agent': 'Mozilla/5.0'
};

async function checkCandlePrices() {
  console.log("🔍 CHECKING ACTUAL CANDLE PRICES FOR GRADUATED TOKENS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Load token data
  const tokensData = JSON.parse(fs.readFileSync('data/latest-100-tokens-1754689982122.json', 'utf8'));
  const graduatedTokens = tokensData.tokens.filter(t => t.isGraduated).slice(0, 5); // Check first 5
  
  for (const token of graduatedTokens) {
    console.log(`\n📊 ${token.symbol} (${token.name})`);
    console.log(`Current MCap: $${token.mcap.toLocaleString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
      // Fetch price candlestick data
      const now = Date.now();
      const url = `https://datapi.jup.ag/v2/charts/${token.id}?interval=1_MINUTE&to=${now}&candles=60&type=price&quote=usd`;
      
      const response = await axios.get(url, { headers, timeout: 10000 });
      
      if (response.data?.candles && response.data.candles.length > 0) {
        const candles = response.data.candles;
        
        // Show first 10 candles
        console.log("First 10 Candles (1-minute each):");
        console.log("Minute | Open Price | Close Price | High | Low | Volume");
        console.log("-------|------------|-------------|------|-----|--------");
        
        for (let i = 0; i < Math.min(10, candles.length); i++) {
          const c = candles[i];
          console.log(
            `${(i + 1).toString().padStart(6)} | ` +
            `$${c.open.toExponential(2).padEnd(10)} | ` +
            `$${c.close.toExponential(2).padEnd(11)} | ` +
            `$${c.high.toExponential(2).padEnd(4)} | ` +
            `$${c.low.toExponential(2).padEnd(3)} | ` +
            `$${c.volume.toFixed(0)}`
          );
        }
        
        // Calculate price changes
        const startPrice = candles[0].close;
        console.log(`\n📈 Price Progression:`);
        console.log(`Starting Price: $${startPrice.toExponential(4)} (${startPrice.toFixed(10)})`);
        
        if (candles.length > 4) {
          const price5min = candles[4].close;
          const change5min = ((price5min - startPrice) / startPrice) * 100;
          console.log(`5-min:  $${price5min.toExponential(4)} (${change5min > 0 ? '+' : ''}${change5min.toFixed(2)}%)`);
        }
        
        if (candles.length > 9) {
          const price10min = candles[9].close;
          const change10min = ((price10min - startPrice) / startPrice) * 100;
          console.log(`10-min: $${price10min.toExponential(4)} (${change10min > 0 ? '+' : ''}${change10min.toFixed(2)}%)`);
        }
        
        if (candles.length > 29) {
          const price30min = candles[29].close;
          const change30min = ((price30min - startPrice) / startPrice) * 100;
          console.log(`30-min: $${price30min.toExponential(4)} (${change30min > 0 ? '+' : ''}${change30min.toFixed(2)}%)`);
        }
        
        // Find highest price
        const maxPrice = Math.max(...candles.map(c => c.high));
        const maxIncrease = ((maxPrice - startPrice) / startPrice) * 100;
        console.log(`\nHighest Price: $${maxPrice.toExponential(4)} (+${maxIncrease.toFixed(2)}%)`);
        
        // Current price
        const currentPrice = candles[candles.length - 1].close;
        const totalChange = ((currentPrice - startPrice) / startPrice) * 100;
        console.log(`Current Price: $${currentPrice.toExponential(4)} (${totalChange > 0 ? '+' : ''}${totalChange.toFixed(2)}%)`);
        
      } else {
        console.log("No candlestick data available");
      }
      
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

checkCandlePrices();
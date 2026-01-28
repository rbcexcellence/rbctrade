// Live Data API Integration for RBC Excellence
// Verwendet kostenlose APIs ohne API-Keys

// CORS Proxy Options - Fallbacks wenn einer nicht funktioniert
const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://cors-anywhere.herokuapp.com/'
];

let currentProxyIndex = 0;

// Cache für letzte gültige Preise
const lastValidPrices = new Map();

// Absolute Mindest-/Höchstwerte für verschiedene Asset-Klassen
const PRICE_RANGES = {
    // Indices (sollten im Tausender-Bereich sein)
    '^GSPC': { min: 3000, max: 10000 },  // S&P 500
    '^IXIC': { min: 10000, max: 30000 }, // Nasdaq
    '^DJI': { min: 25000, max: 60000 },  // Dow Jones
    
    // Aktien (typische Ranges)
    'AAPL': { min: 50, max: 300 },
    'MSFT': { min: 100, max: 500 },
    'GOOGL': { min: 50, max: 200 },
    'AMZN': { min: 50, max: 250 },
    'NVDA': { min: 50, max: 200 },
    'TSLA': { min: 50, max: 500 },
    'META': { min: 100, max: 700 },
    
    // Rohstoffe
    'GC=F': { min: 1000, max: 3000 },    // Gold
    'SI=F': { min: 15, max: 50 },        // Silber
    'CL=F': { min: 30, max: 150 },       // Oil
    'BZ=F': { min: 30, max: 150 }        // Brent
};

function getCorsProxy() {
    return CORS_PROXIES[currentProxyIndex];
}

// Validiere ob Preisänderung realistisch ist
function isValidPriceChange(symbol, newPrice, maxChangePercent = 10) {
    if (!newPrice || isNaN(newPrice) || newPrice <= 0) {
        return false;
    }
    
    // Prüfe absolute Ranges falls definiert
    const range = PRICE_RANGES[symbol];
    if (range) {
        if (newPrice < range.min || newPrice > range.max) {
            console.warn(`⚠️ Preis außerhalb realistischer Range für ${symbol}: ${newPrice.toFixed(2)} (erlaubt: ${range.min}-${range.max})`);
            return false;
        }
    }
    
    const lastPrice = lastValidPrices.get(symbol);
    if (!lastPrice) {
        // Erster Preis - speichere ihn nur wenn er realistisch ist
        lastValidPrices.set(symbol, newPrice);
        return true;
    }
    
    // Berechne prozentuale Änderung
    const changePercent = Math.abs((newPrice - lastPrice) / lastPrice * 100);
    
    if (changePercent > maxChangePercent) {
        console.warn(`⚠️ Unrealistische Preisänderung für ${symbol}: ${lastPrice.toFixed(2)} → ${newPrice.toFixed(2)} (${changePercent.toFixed(1)}%)`);
        return false;
    }
    
    // Preis ist gültig - speichere ihn
    lastValidPrices.set(symbol, newPrice);
    return true;
}

// Utility Funktionen
function formatPrice(price, decimals = 2) {
    if (!price || isNaN(price)) return '0.00';
    const fixed = price.toFixed(decimals);
    const parts = fixed.split('.');
    // Schweizer Format: 1'000 statt 1,000
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return parts.join('.');
}

function formatMarketCap(marketCap) {
    if (!marketCap || isNaN(marketCap)) return '$0';
    if (marketCap >= 1e12) {
        return `$${(marketCap / 1e12).toFixed(2)}T`;
    } else if (marketCap >= 1e9) {
        return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
        return `$${(marketCap / 1e6).toFixed(2)}M`;
    }
    return `$${marketCap.toFixed(0)}`;
}

function formatVolume(volume) {
    if (!volume || isNaN(volume)) return '$0';
    if (volume >= 1e9) {
        return `$${(volume / 1e9).toFixed(1)}B`;
    } else if (volume >= 1e6) {
        return `$${(volume / 1e6).toFixed(1)}M`;
    }
    return `$${volume.toFixed(0)}`;
}

function updateBadge(element, change) {
    if (!element || isNaN(change)) return;
    
    const isPositive = change >= 0;
    element.className = `badge ${isPositive ? 'positive' : 'negative'}`;
    element.textContent = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
}

// ==================== KRYPTO DATEN (CoinGecko API) ====================
async function updateCryptoData() {
    const cryptoIds = {
        'bitcoin': 'BTC',
        'ethereum': 'ETH',
        'solana': 'SOL',
        'ripple': 'XRP',
        'cardano': 'ADA',
        'polkadot': 'DOT',
        'chainlink': 'LINK',
        'matic-network': 'MATIC',
        'uniswap': 'UNI'
    };

    try {
        const ids = Object.keys(cryptoIds).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;
        
        console.log('Lade Krypto-Daten von CoinGecko...');
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('CoinGecko API Error:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        console.log('✅ CoinGecko Daten empfangen:', data);
        
        // Update jede Krypto-Card
        document.querySelectorAll('.crypto-card').forEach(card => {
            const tickerElement = card.querySelector('.crypto-ticker');
            if (!tickerElement) return;
            
            const ticker = tickerElement.textContent.trim();
            
            // Finde die entsprechende Crypto ID
            const cryptoId = Object.keys(cryptoIds).find(id => cryptoIds[id] === ticker);
            
            if (cryptoId && data[cryptoId]) {
                const crypto = data[cryptoId];
                
                // Validierung mit realistischer Preisänderung (max 20% für volatile Kryptos)
                if (!isValidPriceChange(cryptoId, crypto.usd, 20)) {
                    console.warn(`⚠️ Unrealistischer Preis für ${ticker}, überspringe Update`);
                    return;
                }
                
                console.log(`Aktualisiere ${ticker}:`, crypto);
                
                // Update Preis
                const priceElement = card.querySelector('.crypto-price');
                if (priceElement && crypto.usd) {
                    const newPrice = `$${formatPrice(crypto.usd)}`;
                    priceElement.textContent = newPrice;
                    console.log(`${ticker} Preis aktualisiert: ${newPrice}`);
                }
                
                // Update Prozent-Badge
                const badge = card.querySelector('.badge');
                if (badge && crypto.usd_24h_change !== undefined) {
                    updateBadge(badge, crypto.usd_24h_change);
                }
                
                // Update Marktkappe
                const statValues = card.querySelectorAll('.stat-value');
                if (statValues.length > 0 && crypto.usd_market_cap) {
                    statValues[0].textContent = formatMarketCap(crypto.usd_market_cap);
                }
                
                // Update 24h Volumen
                if (statValues.length > 1 && crypto.usd_24h_vol) {
                    statValues[1].textContent = formatVolume(crypto.usd_24h_vol);
                }
            }
        });
        
        console.log('✅ Krypto-Daten erfolgreich aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Krypto-Daten:', error);
    }
}

// ==================== AKTIEN DATEN (Yahoo Finance mit CORS Proxy) ====================
async function updateStockData() {
    const stocks = [
        'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL',
        'NFLX', 'AMZN', 'NKE', 'KO', 'MCD', 'DIS',
        'JPM', 'JNJ', 'V', 'UNH', 'BRK-B', 'PFE'
    ];

    console.log('Lade Aktien-Daten...');
    
    try {
        const corsProxy = getCorsProxy();
        
        for (const ticker of stocks) {
            try {
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
                const proxyUrl = corsProxy + encodeURIComponent(yahooUrl);
                
                const response = await fetch(proxyUrl);
                
                if (response.ok) {
                    const data = await response.json();
                    const result = data?.chart?.result?.[0];
                    
                    if (result && result.meta) {
                        const currentPrice = result.meta.regularMarketPrice;
                        const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
                        
                        // Validierung mit realistischer Preisänderung (max 15% für Aktien)
                        if (!isValidPriceChange(ticker, currentPrice, 15)) {
                            console.warn(`⚠️ Unrealistischer Preis für ${ticker}, überspringe Update`);
                            continue;
                        }
                        
                        const change = ((currentPrice - previousClose) / previousClose) * 100;
                        
                        console.log(`${ticker}: $${currentPrice.toFixed(2)} (${change.toFixed(2)}%)`);
                        
                        // Finde die entsprechende Card
                        document.querySelectorAll('.futures-card').forEach(card => {
                            const tickerElement = card.querySelector('.futures-unit');
                            if (tickerElement && tickerElement.textContent === ticker) {
                                // Update Preis
                                const priceElement = card.querySelector('.futures-price');
                                if (priceElement && currentPrice) {
                                    priceElement.textContent = `$${formatPrice(currentPrice)}`;
                                }
                                
                                // Update Badge
                                const badge = card.querySelector('.badge');
                                if (badge) {
                                    updateBadge(badge, change);
                                }
                                
                                // Update Market Cap wenn vorhanden
                                const statValues = card.querySelectorAll('.stat-value');
                                if (result.meta.marketCap && statValues.length > 0) {
                                    statValues[0].textContent = formatMarketCap(result.meta.marketCap);
                                }
                            }
                        });
                    }
                }
                
                // Pause zwischen Requests
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.warn(`Fehler bei ${ticker}:`, error.message);
            }
        }
        
        console.log('✅ Aktien-Daten aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Aktien-Daten:', error);
    }
}

// ==================== INDICES DATEN ====================
async function updateIndicesData() {
    const indices = {
        '^GSPC': 'S&P 500',
        '^IXIC': 'US 100',
        '^DJI': 'Dow Jones',
        '^GDAXI': 'DAX',
        '^FTSE': 'FTSE 100',
        '^N225': 'Nikkei 225',
        '^STOXX50E': 'Euro Stoxx 50',
        '^SSMI': 'SMI',
        '^HSI': 'Hang Seng'
    };
    
    console.log('Lade Indices-Daten...');
    
    try {
        const corsProxy = getCorsProxy();
        
        for (const [symbol, name] of Object.entries(indices)) {
            try {
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const proxyUrl = corsProxy + encodeURIComponent(yahooUrl);
                
                const response = await fetch(proxyUrl);
                
                if (response.ok) {
                    const data = await response.json();
                    const result = data?.chart?.result?.[0];
                    
                    if (result && result.meta) {
                        const currentPrice = result.meta.regularMarketPrice;
                        const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
                        
                        // Validierung mit realistischer Preisänderung (max 10% pro Update)
                        if (!isValidPriceChange(symbol, currentPrice, 10)) {
                            console.warn(`⚠️ Ungültiger oder unrealistischer Preis für ${name}, überspringe Update`);
                            continue;
                        }
                        
                        const change = ((currentPrice - previousClose) / previousClose) * 100;
                        const high = result.meta.regularMarketDayHigh;
                        const low = result.meta.regularMarketDayLow;
                        
                        console.log(`${name}: ${currentPrice.toFixed(2)} (${change.toFixed(2)}%)`);
                        
                        // Finde die entsprechende Index-Card
                        document.querySelectorAll('.index-card').forEach(card => {
                            const titleElement = card.querySelector('h3');
                            if (titleElement) {
                                const cardTitle = titleElement.textContent;
                                // Prüfe ob der Index-Name im Titel vorkommt
                                if (cardTitle.includes(name)) {
                                    // Update Wert
                                    const valueElement = card.querySelector('.index-value');
                                    if (valueElement && currentPrice) {
                                        valueElement.textContent = formatPrice(currentPrice, 2);
                                    }
                                    
                                    // Update Badge
                                    const badge = card.querySelector('.badge');
                                    if (badge) {
                                        updateBadge(badge, change);
                                    }
                                    
                                    // Update High/Low
                                    const detailValues = card.querySelectorAll('.detail-value');
                                    if (detailValues.length >= 2) {
                                        if (high && high > 0) detailValues[0].textContent = formatPrice(high, 2);
                                        if (low && low > 0) detailValues[1].textContent = formatPrice(low, 2);
                                    }
                                }
                            }
                        });
                    } else {
                        console.warn(`⚠️ Keine Daten für ${name}`);
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.warn(`Fehler bei ${name}:`, error.message);
            }
        }
        
        console.log('✅ Indices-Daten aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Indices-Daten:', error);
    }
}

// ==================== ROHSTOFFE/FUTURES DATEN ====================
async function updateCommoditiesData() {
    const commodities = {
        'GC=F': 'Gold',
        'SI=F': 'Silber',
        'PL=F': 'Platin',
        'PA=F': 'Palladium',
        'CL=F': 'WTI Crude Oil',
        'BZ=F': 'Brent Crude Oil',
        'NG=F': 'Natural Gas',
        'RB=F': 'Gasoline',
        'ZW=F': 'Weizen',
        'ZS=F': 'Sojabohnen',
        'KC=F': 'Kaffee',
        'SB=F': 'Zucker',
        'LE=F': 'Lebendvieh',
        'HG=F': 'Kupfer'
    };

    console.log('Lade Rohstoff-Daten...');

    try {
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        
        for (const [symbol, name] of Object.entries(commodities)) {
            try {
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const response = await fetch(corsProxy + encodeURIComponent(yahooUrl));
                
                if (response.ok) {
                    const data = await response.json();
                    const result = data?.chart?.result?.[0];
                    
                    if (result && result.meta) {
                        const currentPrice = result.meta.regularMarketPrice;
                        const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
                        const change = ((currentPrice - previousClose) / previousClose) * 100;
                        const high = result.meta.regularMarketDayHigh;
                        const low = result.meta.regularMarketDayLow;
                        
                        // Validiere Preis (Rohstoffe: max 15% Änderung)
                        if (!isValidPriceChange(symbol, currentPrice, 15)) {
                            console.warn(`⚠️ Unrealistische Preisänderung für ${name} ignoriert`);
                            continue;
                        }
                        
                        console.log(`${name}: $${currentPrice.toFixed(2)} (${change.toFixed(2)}%)`);
                        
                        // Finde die entsprechende Futures-Card
                        document.querySelectorAll('.futures-card').forEach(card => {
                            const titleElement = card.querySelector('h3');
                            if (titleElement) {
                                const cardTitle = titleElement.textContent;
                                // Prüfe ob der Name im Titel vorkommt (z.B. "Gold" in "Gold (XAU/USD)")
                                if (cardTitle.includes(name)) {
                                    // Update Preis
                                    const priceElement = card.querySelector('.futures-price');
                                    if (priceElement) {
                                        priceElement.textContent = `$${formatPrice(currentPrice)}`;
                                    }
                                    
                                    // Update Badge
                                    const badge = card.querySelector('.badge');
                                    if (badge) {
                                        updateBadge(badge, change);
                                    }
                                    
                                    // Update High/Low in stats
                                    const statValues = card.querySelectorAll('.stat-value');
                                    if (statValues.length >= 2 && high && low) {
                                        statValues[0].textContent = `$${formatPrice(high)}`;
                                        statValues[1].textContent = `$${formatPrice(low)}`;
                                    }
                                }
                            }
                        });
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.warn(`Fehler bei ${name}:`, error.message);
            }
        }
        
        console.log('✅ Rohstoff-Daten aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Rohstoff-Daten:', error);
    }
}

// ==================== INITIALISIERUNG ====================
function initLiveData() {
    const pathname = window.location.pathname;
    const currentPage = pathname.split('/').filter(p => p).pop() || 'index';
    
    console.log('🚀 Live-Daten werden geladen...');
    console.log('📍 Seite:', currentPage);
    console.log('🌐 Protocol:', window.location.protocol);
    
    // Lade Daten basierend auf der aktuellen Seite
    if (currentPage.includes('krypto')) {
        updateCryptoData();
        // Aktualisiere alle 15 Sekunden
        setInterval(updateCryptoData, 15000);
    } 
    else if (currentPage.includes('assets')) {
        updateStockData();
        // Aktualisiere alle 15 Sekunden
        setInterval(updateStockData, 15000);
    } 
    else if (currentPage.includes('indices')) {
        updateIndicesData();
        // Aktualisiere alle 15 Sekunden
        setInterval(updateIndicesData, 15000);
    } 
    else if (currentPage.includes('futures')) {
        updateCommoditiesData();
        // Aktualisiere alle 15 Sekunden
        setInterval(updateCommoditiesData, 15000);
    }
    else if (currentPage === 'index' || currentPage === '') {
        // Auf der Startseite alle Daten laden (wenn dort Previews sind)
        updateCryptoData();
        updateIndicesData();
    }
    
    // Zeige Hinweis wenn nicht über Server geladen
    if (window.location.protocol === 'file:') {
        console.warn('⚠️ Seite wird von Datei geladen. Für beste Ergebnisse, starte den Server mit START_SERVER.bat');
    }
}

// Starte wenn Seite geladen ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiveData);
} else {
    initLiveData();
}

// Loading Indicator hinzufügen
const style = document.createElement('style');
style.textContent = `
    .loading-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 10px 20px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 9999;
        display: none;
    }
    .loading-indicator.active {
        display: block;
    }
`;
document.head.appendChild(style);

// Live Data API Integration for RBC Excellence
// Verwendet kostenlose APIs ohne API-Keys

// Yahoo Finance blockt Browser-CORS. Daher brauchen wir Proxy-Fallbacks.
// Wichtig: Öffentliche Proxies sind oft rate-limited/instabil -> wir:
// - setzen Timeouts
// - parsen auch text/plain Antworten robust
// - parallelisieren Requests mit Concurrency-Limit
const CORS_PROXIES = [
    { name: 'allorigins-raw', type: 'raw', base: 'https://api.allorigins.win/raw?url=' },
    // r.jina.ai ist kein klassischer CORS-Proxy, liefert aber Inhalte serverseitig (text/plain)
    // und ist für JSON-Endpoints wie Yahoo meist zuverlässig.
    { name: 'jina', type: 'jina', base: 'https://r.jina.ai/' },
    { name: 'allorigins-get', type: 'allorigins-get', base: 'https://api.allorigins.win/get?url=' },
    // Fallbacks (häufig 403/limitiert, daher weiter hinten)
    { name: 'corsproxy', type: 'raw', base: 'https://corsproxy.io/?' },
    { name: 'cors-anywhere', type: 'path', base: 'https://cors-anywhere.herokuapp.com/' }
];

let currentProxyIndex = 0;

const PROXY_FETCH_TIMEOUT_MS = 4500;
const SYMBOL_FETCH_CONCURRENCY = 4;

function buildProxyUrl(proxy, targetUrl) {
    if (proxy.type === 'jina') {
        // r.jina.ai erwartet die Ziel-URL als Path-Suffix (inkl. Protocol)
        // Beispiel: https://r.jina.ai/https://query1.finance.yahoo.com/...
        return proxy.base + targetUrl;
    }

    // Proxies mit Query-Parameter erwarten die Ziel-URL URL-encoded
    if (proxy.type === 'raw' || proxy.type === 'allorigins-get' || proxy.base.includes('?') || proxy.base.includes('url=')) {
        return proxy.base + encodeURIComponent(targetUrl);
    }

    // Proxies als Path-Prefix erwarten die rohe URL
    return proxy.base + targetUrl;
}

function extractJsonFromText(text) {
    if (!text) throw new Error('Empty response body');
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('No JSON object found in response');
    }
    const jsonText = text.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonText);
}

async function readJsonResponse(proxy, response) {
    if (proxy.type === 'allorigins-get') {
        const wrapper = await response.json();
        if (!wrapper || typeof wrapper.contents !== 'string') {
            throw new Error('Unexpected allorigins response');
        }
        return extractJsonFromText(wrapper.contents);
    }

    // Best effort: try response.json(); fall back to text parsing.
    try {
        return await response.json();
    } catch {
        const text = await response.text();
        return extractJsonFromText(text);
    }
}

async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchJsonWithCorsFallback(targetUrl) {
    const startIndex = currentProxyIndex;
    const proxiesInOrder = [];
    for (let offset = 0; offset < CORS_PROXIES.length; offset++) {
        proxiesInOrder.push({ proxy: CORS_PROXIES[(startIndex + offset) % CORS_PROXIES.length], index: (startIndex + offset) % CORS_PROXIES.length });
    }

    const attempts = proxiesInOrder.map(({ proxy, index }) => (async () => {
        const proxyUrl = buildProxyUrl(proxy, targetUrl);
        const response = await fetchWithTimeout(proxyUrl, PROXY_FETCH_TIMEOUT_MS);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await readJsonResponse(proxy, response);
        currentProxyIndex = index;
        return data;
    })().catch((error) => {
        console.warn(`⚠️ Proxy fehlgeschlagen (${proxy.name}):`, error?.message || error);
        throw error;
    }));

    if (typeof Promise.any === 'function') {
        return Promise.any(attempts);
    }

    // Fallback für ältere Browser: sequential
    let lastError;
    for (const attempt of attempts) {
        try {
            return await attempt;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('Alle CORS-Proxies sind fehlgeschlagen');
}

async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
        while (nextIndex < items.length) {
            const current = nextIndex++;
            try {
                results[current] = await mapper(items[current], current);
            } catch {
                results[current] = 0;
            }
        }
    });

    await Promise.all(workers);
    return results;
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

function lastFinite(values) {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    for (let i = values.length - 1; i >= 0; i--) {
        const v = values[i];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return undefined;
}

function updateBadge(element, change) {
    if (!element || isNaN(change)) return;
    
    const isPositive = change >= 0;
    element.className = `badge ${isPositive ? 'positive' : 'negative'}`;
    element.textContent = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
}

// ==================== PLACEHOLDER / FALLBACK ====================
const FALLBACK_RESTORE_AFTER_MS = 8000;

function preparePricePlaceholders(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
        if (!el.dataset.fallbackText) {
            el.dataset.fallbackText = el.textContent;
        }

        el.textContent = '—';
        el.classList.add('live-placeholder');
        el.dataset.liveUpdated = '0';
    });
}

function markLiveUpdated(el) {
    if (!el) return;
    el.dataset.liveUpdated = '1';
    el.classList.remove('live-placeholder');
}

function restoreFallbacksIfStillMissing(selector) {
    document.querySelectorAll(selector).forEach(el => {
        if (el.dataset.liveUpdated === '1') return;
        if (!el.dataset.fallbackText) return;
        el.textContent = el.dataset.fallbackText;
        if (el.dataset.fallbackClassName) {
            el.className = el.dataset.fallbackClassName;
        }
        el.classList.remove('live-placeholder');
    });
}

function prepareTextPlaceholders(selector, placeholderText = '—') {
    document.querySelectorAll(selector).forEach(el => {
        if (!el.dataset.fallbackText) {
            el.dataset.fallbackText = el.textContent;
        }
        el.textContent = placeholderText;
        el.classList.add('live-placeholder');
        el.dataset.liveUpdated = '0';
    });
}

function prepareBadgePlaceholders(selector) {
    document.querySelectorAll(selector).forEach(el => {
        if (!el.dataset.fallbackText) {
            el.dataset.fallbackText = el.textContent;
        }
        if (!el.dataset.fallbackClassName) {
            el.dataset.fallbackClassName = el.className;
        }

        el.textContent = '—';
        el.className = 'badge live-placeholder';
        el.dataset.liveUpdated = '0';
    });
}

// ==================== KRYPTO DATEN (CoinGecko API) ====================
async function updateCryptoData() {
    // Mix aus "Blue Chips" + sehr populären/trendenden Coins.
    // Wichtig: CoinGecko-IDs müssen exakt stimmen.
    const cryptoIds = {
        'bitcoin': 'BTC',
        'ethereum': 'ETH',
        'solana': 'SOL',
        'ripple': 'XRP',
        'binancecoin': 'BNB',
        'dogecoin': 'DOGE',
        'toncoin': 'TON',
        'tron': 'TRX',
        'avalanche-2': 'AVAX',
        'chainlink': 'LINK'
    };

    let updatedCount = 0;

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
                
                console.log(`Aktualisiere ${ticker}:`, crypto);
                
                // Update Preis
                const priceElement = card.querySelector('.crypto-price');
                if (priceElement && crypto.usd) {
                    const newPrice = `$${formatPrice(crypto.usd)}`;
                    priceElement.textContent = newPrice;
                    markLiveUpdated(priceElement);
                    console.log(`${ticker} Preis aktualisiert: ${newPrice}`);
                    updatedCount++;
                }
                
                // Update Prozent-Badge
                const badge = card.querySelector('.badge');
                if (badge && crypto.usd_24h_change !== undefined) {
                    updateBadge(badge, crypto.usd_24h_change);
                    markLiveUpdated(badge);
                }
                
                // Update Marktkappe
                const statValues = card.querySelectorAll('.stat-value');
                if (statValues.length > 0 && crypto.usd_market_cap) {
                    statValues[0].textContent = formatMarketCap(crypto.usd_market_cap);
                    markLiveUpdated(statValues[0]);
                }
                
                // Update 24h Volumen
                if (statValues.length > 1 && crypto.usd_24h_vol) {
                    statValues[1].textContent = formatVolume(crypto.usd_24h_vol);
                    markLiveUpdated(statValues[1]);
                }
            }
        });
        
        console.log('✅ Krypto-Daten erfolgreich aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Krypto-Daten:', error);
    }

    return updatedCount;
}

// ==================== AKTIEN DATEN (Yahoo Finance mit CORS Proxy) ====================
async function updateStockData() {
    const stocks = [
        'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL',
        'NFLX', 'AMZN', 'NKE', 'KO', 'MCD', 'DIS',
        'JPM', 'JNJ', 'V', 'UNH', 'BRK-B', 'PFE'
    ];

    console.log('Lade Aktien-Daten...');
    
    let updatedCount = 0;

    try {
        const results = await mapWithConcurrency(stocks, SYMBOL_FETCH_CONCURRENCY, async (ticker) => {
            try {
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
                const data = await fetchJsonWithCorsFallback(yahooUrl);
                const result = data?.chart?.result?.[0];

                if (!result?.meta) return 0;

                const currentPrice = result.meta.regularMarketPrice;
                const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
                const change = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

                // Finde die entsprechende Card via data-symbol
                const card = document.querySelector(`.futures-card[data-symbol="${ticker}"]`);
                if (!card) return 0;

                const priceElement = card.querySelector('.futures-price');
                if (priceElement && currentPrice) {
                    priceElement.textContent = `$${formatPrice(currentPrice)}`;
                    markLiveUpdated(priceElement);
                }

                const badge = card.querySelector('.badge');
                if (badge && previousClose) {
                    updateBadge(badge, change);
                    markLiveUpdated(badge);
                }

                const statValues = card.querySelectorAll('.stat-value');
                if (result.meta.marketCap && statValues.length > 0) {
                    statValues[0].textContent = formatMarketCap(result.meta.marketCap);
                    markLiveUpdated(statValues[0]);
                }

                return 1;
            } catch (error) {
                console.warn(`Fehler bei ${ticker}:`, error?.message || error);
                return 0;
            }
        });

        updatedCount = results.reduce((sum, v) => sum + (v || 0), 0);
        console.log('✅ Aktien-Daten aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Aktien-Daten:', error);
    }

    return updatedCount;
}

// ==================== INDICES DATEN ====================
async function updateIndicesData() {
    const indices = {
        '^GSPC': 'S&P 500',
        '^IXIC': 'US 100 (Nasdaq)',
        '^DJI': 'Dow Jones',
        '^GDAXI': 'DAX',
        '^FTSE': 'FTSE 100',
        '^N225': 'Nikkei 225',
        '^STOXX50E': 'Euro Stoxx 50',
        '^SSMI': 'SMI',
        '^HSI': 'Hang Seng'
    };
    
    console.log('Lade Indices-Daten...');
    
    let updatedCount = 0;

    try {
        const entries = Object.entries(indices);
        const results = await mapWithConcurrency(entries, SYMBOL_FETCH_CONCURRENCY, async ([symbol, name]) => {
            try {
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const data = await fetchJsonWithCorsFallback(yahooUrl);
                const result = data?.chart?.result?.[0];
                if (!result?.meta) return 0;

                const quote = result.indicators?.quote?.[0];
                const seriesClose = lastFinite(quote?.close);
                const seriesHigh = lastFinite(quote?.high);
                const seriesLow = lastFinite(quote?.low);

                const currentPrice = result.meta.regularMarketPrice ?? seriesClose;
                const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
                const change = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
                const high = result.meta.regularMarketDayHigh ?? seriesHigh;
                const low = result.meta.regularMarketDayLow ?? seriesLow;

                const card = document.querySelector(`.index-card[data-symbol="${symbol}"]`);
                if (!card) return 0;

                const valueElement = card.querySelector('.index-value');
                if (valueElement && typeof currentPrice === 'number' && Number.isFinite(currentPrice)) {
                    valueElement.textContent = formatPrice(currentPrice, 2);
                    markLiveUpdated(valueElement);
                }

                const badge = card.querySelector('.badge');
                if (badge && previousClose) {
                    updateBadge(badge, change);
                    markLiveUpdated(badge);
                }

                const detailValues = card.querySelectorAll('.detail-value');
                if (detailValues.length >= 2) {
                    if (typeof high === 'number' && Number.isFinite(high) && high > 0) {
                        detailValues[0].textContent = formatPrice(high, 2);
                        markLiveUpdated(detailValues[0]);
                    }
                    if (typeof low === 'number' && Number.isFinite(low) && low > 0) {
                        detailValues[1].textContent = formatPrice(low, 2);
                        markLiveUpdated(detailValues[1]);
                    }
                }

                return 1;
            } catch (error) {
                console.warn(`Fehler bei ${name}:`, error?.message || error);
                return 0;
            }
        });

        updatedCount = results.reduce((sum, v) => sum + (v || 0), 0);
        console.log('✅ Indices-Daten aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Indices-Daten:', error);
    }

    return updatedCount;
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

    let updatedCount = 0;

    try {
        const entries = Object.entries(commodities);
        const results = await mapWithConcurrency(entries, SYMBOL_FETCH_CONCURRENCY, async ([symbol, name]) => {
            try {
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
                const data = await fetchJsonWithCorsFallback(yahooUrl);
                const result = data?.chart?.result?.[0];
                if (!result?.meta) return 0;

                const quote = result.indicators?.quote?.[0];
                const seriesClose = lastFinite(quote?.close);
                const seriesHigh = lastFinite(quote?.high);
                const seriesLow = lastFinite(quote?.low);

                const currentPrice = result.meta.regularMarketPrice ?? seriesClose;
                const previousClose = result.meta.chartPreviousClose || result.meta.previousClose;
                const change = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
                const high = result.meta.regularMarketDayHigh ?? seriesHigh;
                const low = result.meta.regularMarketDayLow ?? seriesLow;

                const card = document.querySelector(`.futures-card[data-symbol="${symbol}"]`);
                if (!card) return 0;

                const priceElement = card.querySelector('.futures-price');
                if (priceElement && typeof currentPrice === 'number' && Number.isFinite(currentPrice)) {
                    priceElement.textContent = `$${formatPrice(currentPrice)}`;
                    markLiveUpdated(priceElement);
                }

                const badge = card.querySelector('.badge');
                if (badge && previousClose) {
                    updateBadge(badge, change);
                    markLiveUpdated(badge);
                }

                const statValues = card.querySelectorAll('.stat-value');
                if (statValues.length >= 2) {
                    if (typeof high === 'number' && Number.isFinite(high)) {
                        statValues[0].textContent = `$${formatPrice(high)}`;
                        markLiveUpdated(statValues[0]);
                    }
                    if (typeof low === 'number' && Number.isFinite(low)) {
                        statValues[1].textContent = `$${formatPrice(low)}`;
                        markLiveUpdated(statValues[1]);
                    }
                }

                return 1;
            } catch (error) {
                console.warn(`Fehler bei ${name}:`, error?.message || error);
                return 0;
            }
        });

        updatedCount = results.reduce((sum, v) => sum + (v || 0), 0);
        console.log('✅ Rohstoff-Daten aktualisiert');
    } catch (error) {
        console.error('❌ Fehler beim Laden der Rohstoff-Daten:', error);
    }

    return updatedCount;
}

// ==================== INITIALISIERUNG ====================
async function initLiveData() {
    const pathname = window.location.pathname;
    const currentPage = pathname.split('/').pop(); // Einfacher und robuster

    console.log('🚀 Live-Daten werden geladen...');
    console.log('📍 Seite:', currentPage);
    console.log('🌐 Protocol:', window.location.protocol);

    // Während des initialen Loads: Hardcode ausblenden (wenn Seite die Klasse gesetzt hat)
    const hasLoadingClass = document.body?.classList?.contains('live-loading');
    if (hasLoadingClass) {
        document.body.classList.remove('live-ready');
        document.body.classList.remove('live-failed');
    }

    // Pro-Element Platzhalter setzen (damit NICHTS Hardcoded sichtbar ist, selbst wenn nur
    // ein Teil der Requests erfolgreich ist).
    if (currentPage.startsWith('krypto')) {
        preparePricePlaceholders('.crypto-card .crypto-price');
        prepareBadgePlaceholders('.crypto-card .badge');
        prepareTextPlaceholders('.crypto-card .stat-value');
    } else if (currentPage.startsWith('indices')) {
        preparePricePlaceholders('.index-card[data-symbol] .index-value');
        prepareBadgePlaceholders('.index-card[data-symbol] .badge');
        prepareTextPlaceholders('.index-card[data-symbol] .detail-value');
    } else if (currentPage.startsWith('assets') || currentPage.startsWith('futures')) {
        preparePricePlaceholders('.futures-card[data-symbol] .futures-price');
        prepareBadgePlaceholders('.futures-card[data-symbol] .badge');
        prepareTextPlaceholders('.futures-card[data-symbol] .stat-value');
    }

    // Jetzt kann die Seiten-Loading-Klasse weg – die Preise sind bereits neutralisiert.
    if (hasLoadingClass) {
        document.body.classList.remove('live-loading');
    }

    // Lade Daten basierend auf der aktuellen Seite
    if (currentPage.startsWith('krypto')) {
        const updated = await updateCryptoData();
        setInterval(updateCryptoData, 60000);
        document.body.classList.toggle('live-ready', updated > 0);
        document.body.classList.toggle('live-failed', updated === 0);
    } 
    else if (currentPage.startsWith('assets')) {
        const updated = await updateStockData();
        setInterval(updateStockData, 60000);
        document.body.classList.toggle('live-ready', updated > 0);
        document.body.classList.toggle('live-failed', updated === 0);
    } 
    else if (currentPage.startsWith('indices')) {
        const updated = await updateIndicesData();
        setInterval(updateIndicesData, 60000);
        document.body.classList.toggle('live-ready', updated > 0);
        document.body.classList.toggle('live-failed', updated === 0);
    } 
    else if (currentPage.startsWith('futures')) {
        const updated = await updateCommoditiesData();
        setInterval(updateCommoditiesData, 60000);
        document.body.classList.toggle('live-ready', updated > 0);
        document.body.classList.toggle('live-failed', updated === 0);
    }
    else if (currentPage === 'index.html' || currentPage === '') {
        // Auf der Startseite alle Daten laden (wenn dort Previews sind)
        updateCryptoData();
        updateIndicesData();
    }
    else {
        // Seiten ohne Live-Daten: nichts zu tun.
    }

    // Hinweis: Wir stellen keine Hardcode-Fallbacks wieder her.
    // Wenn Live-Daten nicht verfügbar sind, bleiben Werte neutral als "—".

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

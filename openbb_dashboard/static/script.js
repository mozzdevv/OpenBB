// OpenBB Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
    // State management
    const state = {
        currentSymbol: 'SPY',
        currentRange: '6m',
        view: 'dashboard',
        isLoaded: false
    };

    // UI Elements
    const searchInput = document.getElementById('symbol-search');
    const marketGrid = document.getElementById('market-overview-grid');
    const mainChart = document.getElementById('main-chart');
    const chartTitle = document.getElementById('chart-title');
    const newsFeed = document.getElementById('news-feed');
    const assetDetails = document.getElementById('asset-details');

    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            switchView(view);
        });
    });

    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.remove('hidden');
        } else {
            console.warn(`View ${viewName} not implemented yet`);
        }

        navItems.forEach(i => i.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (activeNav) activeNav.classList.add('active');

        state.view = viewName;

        // Perform view-specific actions
        if (viewName === 'news') {
            fetchNews();
        } else if (viewName === 'explorer') {
            renderExplorer();
        }
    }

    function renderExplorer() {
        const explorerView = document.getElementById('explorer-view');
        explorerView.innerHTML = `
            <div class="view-header">
                <h1>Data Explorer</h1>
                <p class="subtitle">Quick access to popular tickers</p>
            </div>
            <div class="explorer-grid">
                <div class="explorer-category card">
                    <h3>Tech Giants</h3>
                    <div class="tag-list">
                        <span class="tag" onclick="quickSearch('AAPL')">AAPL</span>
                        <span class="tag" onclick="quickSearch('MSFT')">MSFT</span>
                        <span class="tag" onclick="quickSearch('GOOGL')">GOOGL</span>
                        <span class="tag" onclick="quickSearch('AMZN')">AMZN</span>
                        <span class="tag" onclick="quickSearch('META')">META</span>
                        <span class="tag" onclick="quickSearch('TSLA')">TSLA</span>
                        <span class="tag" onclick="quickSearch('NVDA')">NVDA</span>
                    </div>
                </div>
                <div class="explorer-category card">
                    <h3>Crypto</h3>
                    <div class="tag-list">
                        <span class="tag" onclick="quickSearch('BTC-USD')">BTC</span>
                        <span class="tag" onclick="quickSearch('ETH-USD')">ETH</span>
                        <span class="tag" onclick="quickSearch('SOL-USD')">SOL</span>
                        <span class="tag" onclick="quickSearch('DOGE-USD')">DOGE</span>
                    </div>
                </div>
                <div class="explorer-category card">
                    <h3>ETFs</h3>
                    <div class="tag-list">
                        <span class="tag" onclick="quickSearch('SPY')">SPY</span>
                        <span class="tag" onclick="quickSearch('QQQ')">QQQ</span>
                        <span class="tag" onclick="quickSearch('VTI')">VTI</span>
                        <span class="tag" onclick="quickSearch('VOO')">VOO</span>
                    </div>
                </div>
            </div>
        `;
    }

    window.quickSearch = (symbol) => {
        state.currentSymbol = symbol;
        switchView('dashboard');
        fetchSymbolData(symbol);
    };

    // API Calls
    async function fetchMarketOverview() {
        try {
            const response = await fetch('/api/market/overview');
            if (!response.ok) throw new Error('Market data unavailable');
            const data = await response.json();
            renderMarketOverview(data);
        } catch (err) {
            console.error('Failed to fetch market overview:', err);
            marketGrid.innerHTML = `<div class="error-msg">Failed to load market overview. Check server connection.</div>`;
        }
    }

    async function fetchSymbolData(symbol) {
        try {
            // Show loading state
            chartTitle.textContent = `Loading ${symbol}...`;
            assetDetails.innerHTML = `<div class="loading-shimmer" style="height: 200px"></div>`;
            newsFeed.innerHTML = `<div class="loading-shimmer" style="height: 100px"></div>`;

            // Fetch price data
            const priceResponse = await fetch(`/api/equity/price/${symbol}`);
            const priceData = await priceResponse.json();

            if (!priceResponse.ok || priceData.detail) {
                throw new Error(priceData.detail || 'Symbol data not found');
            }

            renderChart(symbol, priceData);
            chartTitle.textContent = `${symbol} Performance`;

            // Fetch profile and news in parallel
            fetchProfile(symbol);
            fetchNews(symbol);

        } catch (err) {
            console.error('Error fetching symbol data:', err);
            chartTitle.textContent = `Error loading ${symbol}`;
            assetDetails.innerHTML = `<p class="error-text">Failed to load ${symbol}. Please check the ticker symbol and try again.</p>`;
            newsFeed.innerHTML = '';
        }
    }

    async function fetchProfile(symbol) {
        try {
            const response = await fetch(`/api/equity/profile/${symbol}`);
            const data = await response.json();
            renderProfile(data);
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    }

    async function fetchNews(symbol) {
        try {
            const url = symbol ? `/api/news?symbol=${symbol}` : '/api/news';
            const response = await fetch(url);
            const data = await response.json();
            renderNews(data);
        } catch (err) {
            console.error('Error fetching news:', err);
        }
    }

    // Rendering Helpers
    function renderMarketOverview(data) {
        marketGrid.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card market-card';
            const isPositive = item.change >= 0;
            const sign = isPositive ? '+' : '';

            card.innerHTML = `
                <div class="symbol">${item.symbol}</div>
                <div class="price">$${item.price}</div>
                <div class="change ${isPositive ? 'positive' : 'negative'}">
                    <i data-lucide="${isPositive ? 'trending-up' : 'trending-down'}"></i>
                    ${sign}${item.change} (${sign}${item.change_pct}%)
                </div>
            `;
            card.onclick = () => {
                state.currentSymbol = item.symbol;
                fetchSymbolData(item.symbol);
            };
            marketGrid.appendChild(card);
        });
        lucide.createIcons();
    }

    function renderChart(symbol, data) {
        const dates = data.map(d => d.date);
        const closes = data.map(d => d.close);
        const opens = data.map(d => d.open);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);

        const trace = {
            x: dates,
            y: closes,
            type: 'scatter',
            mode: 'lines',
            name: symbol,
            line: {
                color: '#38bdf8',
                width: 2
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(56, 189, 248, 0.05)'
        };

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 10, r: 10, b: 40, l: 40 },
            showlegend: false,
            xaxis: {
                gridcolor: '#334155',
                tickfont: { color: '#94a3b8' }
            },
            yaxis: {
                gridcolor: '#334155',
                tickfont: { color: '#94a3b8' },
                side: 'right'
            }
        };

        const config = { responsive: true, displayModeBar: false };
        Plotly.newPlot('main-chart', [trace], layout, config);
    }

    function renderProfile(data) {
        // Flatten OpenBB data structure if needed
        const profile = Array.isArray(data) ? data[0] : data;

        if (!profile || profile.error) {
            assetDetails.innerHTML = `<p class="placeholder-text">Details unavailable for this symbol</p>`;
            return;
        }

        assetDetails.innerHTML = `
            <div class="profile-header">
                <h3>${profile.name || state.currentSymbol}</h3>
                <span class="badge">${profile.sector || 'N/A'}</span>
            </div>
            <div class="stats-grid">
                <div class="stat-item">
                    <label>Industry</label>
                    <p>${profile.industry || 'N/A'}</p>
                </div>
                <div class="stat-item">
                    <label>Market Cap</label>
                    <p>${formatCurrency(profile.market_cap)}</p>
                </div>
                <div class="stat-item">
                    <label>Exchange</label>
                    <p>${profile.exchange || 'N/A'}</p>
                </div>
            </div>
            <div class="description-box">
                <p>${profile.description ? profile.description.substring(0, 150) + '...' : 'No description available.'}</p>
            </div>
        `;
    }

    function renderNews(data) {
        const news = Array.isArray(data) ? data : (data.results || []);

        // Render for sidebar (Dashboard)
        newsFeed.innerHTML = '';
        if (news.length === 0) {
            newsFeed.innerHTML = '<p class="placeholder-text">No recent news found.</p>';
        } else {
            news.slice(0, 5).forEach(item => {
                const article = createNewsItem(item);
                newsFeed.appendChild(article);
            });
        }

        // Render for Full News View
        const fullNewsFeed = document.getElementById('full-news-feed');
        if (fullNewsFeed) {
            fullNewsFeed.innerHTML = '';
            if (news.length === 0) {
                fullNewsFeed.innerHTML = '<p class="placeholder-text">No news available.</p>';
            } else {
                news.forEach(item => {
                    const article = createNewsItem(item, true);
                    fullNewsFeed.appendChild(article);
                });
            }
        }
    }

    function createNewsItem(item, isGrid = false) {
        const article = document.createElement('a');
        article.className = isGrid ? 'news-item card' : 'news-item';
        article.href = item.url || '#';
        article.target = '_blank';

        article.innerHTML = `
            <h3>${item.title}</h3>
            <div class="meta">${item.publisher || item.source || 'News'} • ${formatDate(item.date)}</div>
        `;
        return article;
    }

    // Event Handlers
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const symbol = searchInput.value.toUpperCase().trim();
            if (symbol) {
                state.currentSymbol = symbol;
                fetchSymbolData(symbol);
                searchInput.value = '';
            }
        }
    });

    // Formatting
    function formatCurrency(val) {
        if (!val) return 'N/A';
        if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
        if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
        if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
        return val.toLocaleString();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString();
    }

    // Initial load
    fetchMarketOverview();
    fetchSymbolData(state.currentSymbol);

    // Auto-refresh market overview every 60s
    setInterval(fetchMarketOverview, 60000);
});

import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from openbb import obb
import pandas as pd
from typing import Optional, List
import json
import feedparser
from datetime import datetime

app = FastAPI(title="OpenBB Local Dashboard")

# Serve static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

@app.get("/")
async def read_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/api/market/overview")
async def get_market_overview():
    try:
        # Get S&P 500, Nasdaq, Dow Jones (simplified for now)
        # In a real app, we'd fetch this from yfinance or similar via OpenBB
        # For the demo, let's just get some major tickers
        indices = ["SPY", "QQQ", "DIA", "IWM"]
        data = []
        for ticker in indices:
            res = obb.equity.price.historical(ticker, provider="yfinance", limit=2)
            df = res.to_dataframe()
            if not df.empty and len(df) >= 2:
                last_close = df['close'].iloc[-1]
                prev_close = df['close'].iloc[-2]
                change = last_close - prev_close
                change_pct = (change / prev_close) * 100
                data.append({
                    "symbol": ticker,
                    "price": round(float(last_close), 2),
                    "change": round(float(change), 2),
                    "change_pct": round(float(change_pct), 2)
                })
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/equity/price/{symbol}")
async def get_equity_price(symbol: str, timeframe: str = "1y"):
    try:
        from datetime import datetime, timedelta
        end_date = datetime.now()
        
        if timeframe == "1m":
            start_date = end_date - timedelta(days=32)
        elif timeframe == "6m":
            start_date = end_date - timedelta(days=183)
        else: # 1y
            start_date = end_date - timedelta(days=366)
            
        start_date_str = start_date.strftime("%Y-%m-%d")
        
        # Use OpenBB with explicit dates
        res = obb.equity.price.historical(
            symbol, 
            provider="yfinance", 
            start_date=start_date_str,
            interval="1d"
        )
        
        df = res.to_dataframe()
        if df.empty:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        df = df.reset_index()
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"Error fetching price for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/equity/profile/{symbol}")
async def get_equity_profile(symbol: str):
    try:
        res = obb.equity.profile(symbol, provider="yfinance")
        # OpenBB results are usually wrapped in a 'results' list or similar
        data = res.to_dict()
        if isinstance(data, dict) and 'results' in data:
            return data['results'][0] if data['results'] else {}
        return data[0] if isinstance(data, list) and data else data
    except Exception as e:
        print(f"Error fetching profile for {symbol}: {e}")
        return {"symbol": symbol, "error": str(e)}

@app.get("/api/news")
async def get_market_news(symbol: Optional[str] = None):
    try:
        formatted_news = []
        
        # 1. Try OpenBB (yfinance)
        try:
            if symbol:
                res = obb.news.company(symbol=symbol, provider="yfinance")
            else:
                res = obb.news.world(provider="yfinance")
            
            data = res.to_dict()
            results = data.get('results', []) if isinstance(data, dict) else data
            
            for item in (results or []):
                if isinstance(item, dict):
                    formatted_news.append({
                        "title": item.get("title", "No Title"),
                        "url": item.get("url", "#"),
                        "publisher": item.get("publisher") or item.get("source") or "OpenBB News",
                        "date": str(item.get("date", ""))
                    })
        except Exception as e:
            print(f"OpenBB news fetch failed: {e}")

        # 2. Add RSS News as additional source (Free & Reliable)
        try:
            rss_url = "https://finance.yahoo.com/news/rssindex"
            if symbol:
                rss_url = f"https://finance.yahoo.com/rss/headline?s={symbol}"
            
            feed = feedparser.parse(rss_url)
            for entry in feed.entries[:10]:
                formatted_news.append({
                    "title": entry.title,
                    "url": entry.link,
                    "publisher": "Yahoo Finance (RSS)",
                    "date": entry.get("published", "")
                })
        except Exception as e:
            print(f"RSS news fetch failed: {e}")

        # Remove duplicates based on title and sort by date if possible
        seen_titles = set()
        unique_news = []
        for n in formatted_news:
            if n['title'].lower() not in seen_titles:
                unique_news.append(n)
                seen_titles.add(n['title'].lower())
        
        return unique_news[:15] # Top 15 results
    except Exception as e:
        print(f"Global news error: {e}")
        return []

app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

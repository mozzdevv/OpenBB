import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from openbb import obb
import pandas as pd
from typing import Optional, List
import json

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
        # Map timeframe to OpenBB params if needed
        res = obb.equity.price.historical(symbol, provider="yfinance")
        df = res.to_dataframe()
        if df.empty:
            raise HTTPException(status_code=404, detail="Symbol not found")
        
        # Convert index (date) to string for JSON serialization
        df = df.reset_index()
        df['date'] = df['date'].dt.strftime('%Y-%m-%d')
        
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/equity/profile/{symbol}")
async def get_equity_profile(symbol: str):
    try:
        res = obb.equity.profile(symbol, provider="yfinance")
        # Handle the structure of OpenBB output
        data = res.to_dict()
        return data
    except Exception as e:
        # Fallback if profile fails (some providers don't have it)
        return {"symbol": symbol, "error": str(e)}

@app.get("/api/news")
async def get_market_news(symbol: Optional[str] = None):
    try:
        if symbol:
            res = obb.news.company(symbol=symbol, provider="yfinance")
        else:
            res = obb.news.world(provider="yfinance")
        return res.to_dict()
    except Exception as e:
        return []

app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

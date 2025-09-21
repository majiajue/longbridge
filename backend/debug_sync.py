#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.repositories import load_credentials, load_symbols
from longport.openapi import Config, QuoteContext, Period, AdjustType, TradeSessions

def debug_sync():
    # Load credentials
    creds = load_credentials()
    print(f"Credentials loaded: {list(creds.keys())}")

    # Load symbols
    symbols = load_symbols()
    print(f"Symbols to sync: {symbols}")

    if not symbols:
        print("No symbols configured!")
        return

    # Create config
    config = Config(
        app_key=creds["LONGPORT_APP_KEY"],
        app_secret=creds["LONGPORT_APP_SECRET"],
        access_token=creds["LONGPORT_ACCESS_TOKEN"]
    )

    # Test with HK stock
    symbol = "700.HK"
    print(f"\nTesting with symbol: {symbol}")

    try:
        # Create quote context
        ctx = QuoteContext(config)
        print("Quote context created successfully")

        # Fetch history - try different approaches
        print(f"Fetching history for {symbol}...")

        # First try with history_candlesticks_by_offset
        print("Method 1: history_candlesticks_by_offset")
        candles = ctx.history_candlesticks_by_offset(
            symbol,
            Period.Day,
            AdjustType.NoAdjust,
            True,  # forward
            10,    # count
            trade_sessions=TradeSessions.Intraday
        )
        print(f"  Result: {len(candles)} candles")

        # Also try without trade_sessions
        print("\nMethod 2: without trade_sessions")
        candles2 = ctx.history_candlesticks_by_offset(
            symbol,
            Period.Day,
            AdjustType.NoAdjust,
            True,  # forward
            10,    # count
        )
        print(f"  Result: {len(candles2)} candles")

        # Use the result with data
        if len(candles2) > len(candles):
            candles = candles2

        print(f"Fetched {len(candles)} candles")

        # Display first few candles
        for i, candle in enumerate(candles[:3]):
            print(f"  Candle {i}: timestamp={candle.timestamp}, open={candle.open}, close={candle.close}, volume={candle.volume}")

        # Now try to store them
        from app.repositories import store_candlesticks
        inserted = store_candlesticks(symbol, candles)
        print(f"\nStored {inserted} records in database")

        # Verify storage
        from app.repositories import fetch_candlesticks
        stored = fetch_candlesticks(symbol, 5)
        print(f"Retrieved {len(stored)} records from database")
        for record in stored[:2]:
            print(f"  {record}")

    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_sync()
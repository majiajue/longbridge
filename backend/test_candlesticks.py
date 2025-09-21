#!/usr/bin/env python3
import os
import sys
from datetime import datetime, timedelta
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.repositories import load_credentials, load_symbols
from longport.openapi import Config, QuoteContext, Period, AdjustType

def test_candlesticks_api():
    """Test different candlestick API methods"""

    # Load credentials
    creds = load_credentials()
    print(f"Credentials loaded: {list(creds.keys())}")

    # Create config
    config = Config(
        app_key=creds["LONGPORT_APP_KEY"],
        app_secret=creds["LONGPORT_APP_SECRET"],
        access_token=creds["LONGPORT_ACCESS_TOKEN"]
    )

    # Test symbol
    symbol = "700.HK"
    print(f"\nTesting with symbol: {symbol}")

    try:
        # Create quote context
        ctx = QuoteContext(config)
        print("Quote context created successfully")

        # List all available methods
        print("\nAvailable methods in QuoteContext:")
        methods = [m for m in dir(ctx) if not m.startswith('_') and 'candlestick' in m.lower()]
        for method in methods:
            print(f"  - {method}")

        # Try method 1: candlesticks (if exists)
        if hasattr(ctx, 'candlesticks'):
            print("\nTrying ctx.candlesticks()...")
            try:
                # Calculate date range (last 30 days)
                end_date = datetime.now()
                start_date = end_date - timedelta(days=30)

                candles = ctx.candlesticks(
                    symbol,
                    Period.Day,
                    count=20,
                    adjust_type=AdjustType.NoAdjust
                )
                print(f"  Success! Got {len(candles)} candles")
                if candles:
                    print(f"  First candle: timestamp={candles[0].timestamp}, close={candles[0].close}")
            except Exception as e:
                print(f"  Error: {e}")

        # Try method 2: history_candlesticks_by_date (if exists)
        if hasattr(ctx, 'history_candlesticks_by_date'):
            print("\nTrying ctx.history_candlesticks_by_date()...")
            try:
                from datetime import date
                # Use specific date range
                start = date(2024, 1, 1)
                end = date(2024, 1, 31)

                candles = ctx.history_candlesticks_by_date(
                    symbol,
                    Period.Day,
                    start,
                    end,
                    AdjustType.NoAdjust
                )
                print(f"  Success! Got {len(candles)} candles")
                if candles:
                    print(f"  First candle: timestamp={candles[0].timestamp}, close={candles[0].close}")
            except Exception as e:
                print(f"  Error: {e}")

        # Try method 3: history_candlesticks (if exists)
        if hasattr(ctx, 'history_candlesticks'):
            print("\nTrying ctx.history_candlesticks()...")
            try:
                candles = ctx.history_candlesticks(
                    symbol,
                    Period.Day,
                    None,  # from timestamp
                    None,  # to timestamp
                    20,    # count
                    AdjustType.NoAdjust
                )
                print(f"  Success! Got {len(candles)} candles")
                if candles:
                    print(f"  First candle: timestamp={candles[0].timestamp}, close={candles[0].close}")
            except Exception as e:
                print(f"  Error: {e}")

        # Method 4: Try the offset method with different parameters
        print("\nTrying ctx.history_candlesticks_by_offset() with count=-20 (backward)...")
        try:
            candles = ctx.history_candlesticks_by_offset(
                symbol,
                Period.Day,
                AdjustType.NoAdjust,
                False,  # backward
                20,     # count
            )
            print(f"  Success! Got {len(candles)} candles")
            if candles:
                print(f"  First candle: timestamp={candles[0].timestamp}, close={candles[0].close}")
        except Exception as e:
            print(f"  Error: {e}")

    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_candlesticks_api()
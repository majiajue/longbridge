#!/usr/bin/env python
"""
Sync historical candlestick data from Longbridge API
"""
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.repositories import load_credentials, load_symbols
from app.services import sync_history_candlesticks

def main():
    print("Starting candlestick sync...")

    # Check credentials
    creds = load_credentials()
    if not creds or any(not creds.get(key) for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")):
        print("❌ Error: Please configure Longbridge credentials first")
        return 1

    # Get symbols to sync
    symbols = load_symbols()
    if not symbols:
        # Use default symbols if none configured
        symbols = ["700.HK", "AAPL.US", "TSLA.US"]
        print(f"ℹ️  No symbols configured, using defaults: {symbols}")
    else:
        print(f"📊 Syncing symbols: {symbols}")

    # Sync parameters
    period = "day"  # Daily candlesticks
    adjust_type = "forward_adjust"  # Forward adjusted for splits/dividends
    count = 365  # Get 1 year of data

    print(f"📈 Fetching {count} {period} candlesticks with {adjust_type}...")

    try:
        results = sync_history_candlesticks(
            symbols=symbols,
            period=period,
            adjust_type=adjust_type,
            count=count
        )

        print("\n✅ Sync complete!")
        for symbol, inserted_count in results.items():
            print(f"   {symbol}: {inserted_count} records inserted")

        print(f"\n📊 Total: {sum(results.values())} candlestick records synced")
        return 0

    except Exception as e:
        print(f"\n❌ Error syncing candlesticks: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
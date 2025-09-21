#!/usr/bin/env python
"""
Start real-time quote streaming for configured symbols
"""
import sys
import json
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.repositories import load_credentials, load_symbols, save_symbols
from app.streaming import quote_stream_manager

def main():
    print("🚀 Starting real-time quote streaming...")

    # Check credentials
    creds = load_credentials()
    if not creds or any(not creds.get(key) for key in ("LONGPORT_APP_KEY", "LONGPORT_APP_SECRET", "LONGPORT_ACCESS_TOKEN")):
        print("❌ Error: Please configure Longbridge credentials first")
        return 1

    # Get symbols to stream
    symbols = load_symbols()
    if not symbols:
        # Use default symbols if none configured
        symbols = ["700.HK", "0005.HK", "AAPL.US", "TSLA.US", "NVDA.US"]
        print(f"ℹ️  No symbols configured, using defaults: {symbols}")
        save_symbols(symbols)
    else:
        print(f"📊 Streaming symbols: {symbols}")

    # Request streaming restart
    print("🔄 Restarting quote stream manager...")
    quote_stream_manager.request_restart()

    print("✅ Real-time streaming activated!")
    print("📡 WebSocket endpoint: ws://localhost:8000/ws/quotes")
    print("\nYou can now connect to the WebSocket to receive real-time quotes.")
    print("Open the frontend at http://localhost:5173/ and navigate to '实时K线' tab.")

    return 0

if __name__ == "__main__":
    sys.exit(main())
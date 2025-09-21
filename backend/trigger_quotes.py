#!/usr/bin/env python3
"""Trigger static quotes for testing when market is closed."""

import requests
from longport.openapi import Config, QuoteContext


def get_static_quotes():
    """Get static quotes for configured symbols."""
    # Get credentials
    response = requests.get("http://localhost:8000/settings/credentials")
    creds = response.json()

    # Get symbols
    response = requests.get("http://localhost:8000/settings/symbols")
    symbols = response.json()["symbols"]

    # Create config
    config = Config(
        app_key=creds["LONGPORT_APP_KEY"],
        app_secret=creds["LONGPORT_APP_SECRET"],
        access_token=creds["LONGPORT_ACCESS_TOKEN"]
    )

    # Get quote context
    ctx = QuoteContext(config)

    # Get static quotes
    quotes = ctx.quote(symbols)

    print(f"Fetched {len(quotes)} quotes:")
    for quote in quotes:
        change_value = quote.last_done - quote.prev_close if quote.prev_close else 0
        change_rate = (change_value / quote.prev_close * 100) if quote.prev_close else 0
        print(f"  {quote.symbol}: ${quote.last_done} (prev: ${quote.prev_close}, change: {change_rate:+.2f}%)")

    return quotes


if __name__ == "__main__":
    try:
        quotes = get_static_quotes()
        print("\nQuotes fetched successfully!")
    except Exception as e:
        print(f"Error: {e}")
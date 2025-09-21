#!/usr/bin/env python3
"""Test WebSocket connection to verify quotes are being received."""

import asyncio
import json
import websockets


async def test_websocket():
    uri = "ws://localhost:8000/ws/quotes"
    print(f"Connecting to {uri}...")

    async with websockets.connect(uri) as websocket:
        print("Connected! Listening for messages...")

        # Listen for first 10 messages
        for i in range(10):
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                print(f"\nMessage {i+1}:")
                print(json.dumps(data, indent=2))

                if data.get("type") == "quote":
                    print(f"  -> Quote for {data.get('symbol')}: ${data.get('last_done')}")

            except asyncio.TimeoutError:
                print(f"No message received in 5 seconds (message {i+1})")
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON: {e}")
                print(f"Raw message: {message}")
            except Exception as e:
                print(f"Error: {e}")
                break

        print("\nTest complete!")


if __name__ == "__main__":
    asyncio.run(test_websocket())
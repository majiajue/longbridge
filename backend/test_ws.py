#!/usr/bin/env python
"""
Test WebSocket connection to real-time quotes
"""
import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:8000/ws/quotes"
    print(f"Connecting to {uri}")

    async with websockets.connect(uri) as websocket:
        print("Connected! Waiting for messages...")

        # Listen for 10 messages
        for i in range(10):
            message = await websocket.recv()
            data = json.loads(message)

            if data.get('type') == 'quote':
                print(f"Quote: {data.get('symbol')} @ {data.get('last_done', 0):.2f} "
                      f"({data.get('change_rate', 0):+.2f}%)")
            elif data.get('type') == 'status':
                print(f"Status: {data.get('status')} - {data.get('detail')}")
            elif data.get('type') == 'portfolio':
                positions = data.get('positions', [])
                total_pnl = data.get('totals', {}).get('pnl', 0)
                print(f"Portfolio Update: {len(positions)} positions, Total P&L: ${total_pnl:.2f}")
            else:
                print(f"Message: {data.get('type')} - {json.dumps(data, indent=2)}")

        print("Test complete!")

if __name__ == "__main__":
    asyncio.run(test_websocket())
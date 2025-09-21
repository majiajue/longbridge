#!/usr/bin/env python
"""
Update watched symbols list
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.repositories import save_symbols

# Popular symbols for real-time monitoring
symbols = [
    "700.HK",   # 腾讯
    "0005.HK",  # 汇丰
    "9988.HK",  # 阿里巴巴-SW
    "3690.HK",  # 美团-W
    "AAPL.US",  # 苹果
    "TSLA.US",  # 特斯拉
    "NVDA.US",  # 英伟达
    "MSFT.US",  # 微软
    "GOOGL.US", # 谷歌
]

save_symbols(symbols)
print(f"✅ Updated symbols list: {symbols}")
print("🔄 Restart the backend server to apply changes")
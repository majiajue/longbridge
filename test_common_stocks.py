#!/usr/bin/env python3
"""
测试常见美股 - 确保能获取到K线数据
"""
import requests

API_BASE = "http://localhost:8000"

# 清空现有股票池
def clear_pools():
    print("🧹 清空现有股票池...")
    # 这里需要手动实现，或者直接在界面上删除

# 常见美股（确定有数据的大盘股）
LONG_STOCKS = [
    # 科技龙头（FAANG+）
    "AAPL.US",   # 苹果
    "MSFT.US",   # 微软
    "GOOGL.US",  # 谷歌
    "AMZN.US",   # 亚马逊
    "META.US",   # Meta
    "NVDA.US",   # 英伟达
    "TSLA.US",   # 特斯拉
    "NFLX.US",   # 奈飞
    
    # 其他知名股
    "AMD.US",    # AMD
    "INTC.US",   # 英特尔
]

SHORT_STOCKS = [
    # 一些近期表现较弱的股票（仅作示例）
    "COIN.US",   # Coinbase
    "SNAP.US",   # Snapchat
    "UBER.US",   # Uber
    "LYFT.US",   # Lyft
    "ZM.US",     # Zoom
]

def add_stocks(pool_type, symbols):
    """批量添加股票"""
    print(f"\n📊 添加{len(symbols)}只股票到{pool_type}池...")
    
    response = requests.post(
        f"{API_BASE}/api/stock-picker/pools/batch",
        json={
            "pool_type": pool_type,
            "symbols": symbols
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ 成功: {result['success_count']}只")
        if result['failed']:
            print(f"❌ 失败: {len(result['failed'])}只")
            for fail in result['failed']:
                print(f"   - {fail['symbol']}: {fail['error']}")
    else:
        print(f"❌ 请求失败: {response.status_code}")
        print(f"   {response.text}")

if __name__ == "__main__":
    print("🚀 开始添加常见美股...")
    print("=" * 50)
    
    # 添加做多池
    add_stocks("LONG", LONG_STOCKS)
    
    # 添加做空池
    add_stocks("SHORT", SHORT_STOCKS)
    
    print("\n" + "=" * 50)
    print("✅ 完成！现在可以在前端触发分析了")
    print("\n💡 提示：")
    print("   1. 刷新浏览器")
    print("   2. 点击「🔄 分析全部」")
    print("   3. 观察实时日志")












#!/usr/bin/env python3
"""
修复股票代码 - 清空无效股票，添加常见美股
"""
import requests
import sys

API_BASE = "http://localhost:8000"

def get_all_pools():
    """获取所有股票池"""
    response = requests.get(f"{API_BASE}/api/stock-picker/pools")
    if response.status_code == 200:
        return response.json()
    return {"long_pool": [], "short_pool": []}

def delete_stock(pool_id):
    """删除单只股票"""
    response = requests.delete(f"{API_BASE}/api/stock-picker/pools/{pool_id}")
    return response.status_code == 200

def clear_all_pools():
    """清空所有股票池"""
    print("🧹 清空现有股票池...")
    pools = get_all_pools()
    
    total = 0
    for stock in pools['long_pool']:
        if delete_stock(stock['id']):
            total += 1
            print(f"   删除: {stock['symbol']} (做多池)")
    
    for stock in pools['short_pool']:
        if delete_stock(stock['id']):
            total += 1
            print(f"   删除: {stock['symbol']} (做空池)")
    
    print(f"✅ 已删除 {total} 只股票\n")

def add_stocks(pool_type, symbols):
    """批量添加股票"""
    print(f"📊 添加 {len(symbols)} 只股票到 {pool_type} 池...")
    
    response = requests.post(
        f"{API_BASE}/api/stock-picker/pools/batch",
        json={
            "pool_type": pool_type,
            "symbols": symbols
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ 成功: {result['success_count']} 只")
        if result['failed']:
            print(f"❌ 失败: {len(result['failed'])} 只")
            for fail in result['failed']:
                print(f"   - {fail['symbol']}: {fail['error']}")
        return result['success_count']
    else:
        print(f"❌ 请求失败: {response.status_code}")
        return 0

# 常见美股（确保有数据）
LONG_STOCKS = [
    # 科技龙头
    "AAPL.US",   # 苹果
    "MSFT.US",   # 微软  
    "GOOGL.US",  # 谷歌
    "AMZN.US",   # 亚马逊
    "META.US",   # Meta/Facebook
    "NVDA.US",   # 英伟达
    "TSLA.US",   # 特斯拉
    "NFLX.US",   # 奈飞
    "AMD.US",    # AMD
    "INTC.US",   # 英特尔
    
    # 金融/消费
    "JPM.US",    # 摩根大通
    "V.US",      # Visa
    "WMT.US",    # 沃尔玛
    "DIS.US",    # 迪士尼
    "PG.US",     # 宝洁
]

SHORT_STOCKS = [
    # 近期较弱/波动大的股票（仅作示例）
    "COIN.US",   # Coinbase
    "SNAP.US",   # Snapchat
    "UBER.US",   # Uber
    "LYFT.US",   # Lyft
    "ZM.US",     # Zoom
    "ROKU.US",   # Roku
    "PINS.US",   # Pinterest
    "SHOP.US",   # Shopify
]

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 修复股票代码 - 使用常见美股")
    print("=" * 60)
    print()
    
    # 询问用户
    confirm = input("⚠️  这将删除所有现有股票，是否继续？(y/N): ")
    if confirm.lower() != 'y':
        print("❌ 取消操作")
        sys.exit(0)
    
    print()
    
    # 1. 清空现有股票
    clear_all_pools()
    
    # 2. 添加新股票
    long_count = add_stocks("LONG", LONG_STOCKS)
    print()
    short_count = add_stocks("SHORT", SHORT_STOCKS)
    
    print()
    print("=" * 60)
    print(f"✅ 完成！共添加 {long_count + short_count} 只股票")
    print("=" * 60)
    print()
    print("📝 下一步操作：")
    print("   1. 刷新浏览器（Cmd + Shift + R）")
    print("   2. 点击「🔄 分析全部」")
    print("   3. 观察实时日志 - 这次应该能成功了！")
    print()












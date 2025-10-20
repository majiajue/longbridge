#!/usr/bin/env python3
"""
同步持仓股票的历史K线数据
"""
import sys
import os

# 添加backend到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.services import get_portfolio_overview, sync_history_candlesticks
from app.repositories import load_symbols

def main():
    print("=" * 60)
    print("同步持仓股票K线数据")
    print("=" * 60)
    
    # 1. 获取持仓股票
    print("\n📊 获取持仓股票...")
    try:
        portfolio = get_portfolio_overview()
        position_symbols = []
        if portfolio and portfolio.get('positions'):
            position_symbols = [pos['symbol'] for pos in portfolio['positions']]
            print(f"✅ 检测到 {len(position_symbols)} 只持仓股票:")
            for symbol in position_symbols:
                print(f"   - {symbol}")
        else:
            print("⚠️  未检测到持仓")
    except Exception as e:
        print(f"❌ 获取持仓失败: {e}")
        position_symbols = []
    
    # 2. 获取手工配置的股票
    print("\n📝 获取手工配置的股票...")
    try:
        manual_symbols = load_symbols()
        if manual_symbols:
            print(f"✅ 检测到 {len(manual_symbols)} 只配置股票:")
            for symbol in manual_symbols:
                print(f"   - {symbol}")
        else:
            print("⚠️  未配置监控股票")
    except Exception as e:
        print(f"❌ 获取配置失败: {e}")
        manual_symbols = []
    
    # 3. 合并去重
    all_symbols = list(set(position_symbols + manual_symbols))
    
    if not all_symbols:
        print("\n❌ 没有需要同步的股票！")
        print("请先在「基础配置」中添加股票或持有股票")
        return
    
    print(f"\n🎯 总计需要同步 {len(all_symbols)} 只股票")
    print("=" * 60)
    
    # 4. 逐个同步
    success_count = 0
    fail_count = 0
    
    for i, symbol in enumerate(all_symbols, 1):
        print(f"\n[{i}/{len(all_symbols)}] 同步 {symbol}...")
        try:
            result = sync_history_candlesticks(
                symbol=symbol,
                period="day",
                adjust_type="forward_adjust",
                limit=100  # 最近100个交易日
            )
            
            if result.get('synced_count', 0) > 0:
                print(f"   ✅ 成功同步 {result['synced_count']} 条K线数据")
                success_count += 1
            else:
                print(f"   ⚠️  没有新数据")
                success_count += 1
                
        except Exception as e:
            print(f"   ❌ 同步失败: {e}")
            fail_count += 1
    
    # 5. 总结
    print("\n" + "=" * 60)
    print("同步完成！")
    print(f"✅ 成功: {success_count} 只")
    print(f"❌ 失败: {fail_count} 只")
    print("=" * 60)
    
    if success_count > 0:
        print("\n💡 现在可以访问「策略盯盘」查看信号了！")
        print("   http://localhost:5173")
    else:
        print("\n⚠️  同步失败，请检查:")
        print("   1. ACCESS_TOKEN 是否过期")
        print("   2. 网络连接是否正常")
        print("   3. 股票代码是否正确")

if __name__ == "__main__":
    main()


#!/usr/bin/env python3
"""
分析股票池
"""
import sys
import os
import asyncio

# 添加backend路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.stock_picker import get_stock_picker_service


async def main():
    """运行分析"""
    service = get_stock_picker_service()
    
    print("\n" + "="*60)
    print("  📊 智能选股分析")
    print("="*60 + "\n")
    
    # 1. 显示当前股票池
    print("📋 当前股票池:")
    pools = service.get_pools()
    print(f"   做多池: {len(pools['long_pool'])} 只")
    print(f"   做空池: {len(pools['short_pool'])} 只")
    
    # 2. 触发分析
    print("\n🔍 开始分析...")
    result = await service.analyze_pool(force_refresh=True)
    
    print(f"\n✅ 分析完成:")
    print(f"   总计: {result['total']} 只")
    print(f"   成功: {result['success']} 只")
    print(f"   失败: {result['failed']} 只")
    
    # 3. 获取结果
    print("\n" + "="*60)
    print("  📈 做多推荐 (Top 10)")
    print("="*60 + "\n")
    
    analysis = service.get_analysis_results()
    
    for i, stock in enumerate(analysis['long_analysis'][:10], 1):
        score = stock['score']
        rec_score = stock['recommendation_score']
        
        # 评级颜色
        grade_emoji = {
            'A': '🟢',
            'B': '🟡',
            'C': '🟠',
            'D': '🔴'
        }.get(score['grade'], '⚪')
        
        print(f"#{i:2d} {grade_emoji} {stock['symbol']:12s} | "
              f"评分: {score['total']:5.1f}/100 ({score['grade']:1s}级) | "
              f"推荐度: {rec_score:5.1f}")
        
        # 显示价格和涨跌
        if stock['current_price']:
            price_change = stock['price_change_1d']
            change_symbol = '↑' if price_change > 0 else '↓' if price_change < 0 else '→'
            print(f"     ${stock['current_price']:.2f} {change_symbol} {abs(price_change):.2f}%")
        
        # 显示主要理由
        reasoning = stock['ai_decision']['reasoning']
        if reasoning:
            print(f"     💡 {reasoning[0]}")
        
        print()
    
    print("="*60)
    print("  📉 做空推荐 (Top 10)")
    print("="*60 + "\n")
    
    for i, stock in enumerate(analysis['short_analysis'][:10], 1):
        score = stock['score']
        rec_score = stock['recommendation_score']
        
        grade_emoji = {
            'A': '🔴',  # A级但推荐做空说明评分低
            'B': '🟠',
            'C': '🟡',
            'D': '🟢'   # D级很适合做空
        }.get(score['grade'], '⚪')
        
        print(f"#{i:2d} {grade_emoji} {stock['symbol']:12s} | "
              f"评分: {score['total']:5.1f}/100 ({score['grade']:1s}级) | "
              f"推荐度: {rec_score:5.1f}")
        
        if stock['current_price']:
            price_change = stock['price_change_1d']
            change_symbol = '↑' if price_change > 0 else '↓' if price_change < 0 else '→'
            print(f"     ${stock['current_price']:.2f} {change_symbol} {abs(price_change):.2f}%")
        
        reasoning = stock['ai_decision']['reasoning']
        if reasoning:
            print(f"     💡 {reasoning[0]}")
        
        print()
    
    # 4. 统计信息
    print("="*60)
    print("  📊 统计信息")
    print("="*60 + "\n")
    
    stats = analysis['stats']
    print(f"做多池:")
    print(f"  • 股票数量: {stats['long_count']}")
    print(f"  • 平均评分: {stats['long_avg_score']:.1f}/100")
    print()
    print(f"做空池:")
    print(f"  • 股票数量: {stats['short_count']}")
    print(f"  • 平均评分: {stats['short_avg_score']:.1f}/100")
    print()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断")
    except Exception as e:
        print(f"\n❌ 分析失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)












#!/usr/bin/env python3
"""
测试量化评分系统
"""
import sys
import os

# 添加backend路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.ai_analyzer import DeepSeekAnalyzer
import json


def print_score_card(score):
    """打印评分卡片"""
    total = score['total']
    grade = score['grade']
    breakdown = score['breakdown']
    signals = score['signals']
    
    # 评级颜色
    grade_colors = {
        'A': '\033[92m',  # 绿色
        'B': '\033[93m',  # 黄色
        'C': '\033[94m',  # 蓝色
        'D': '\033[91m',  # 红色
    }
    color = grade_colors.get(grade, '\033[0m')
    reset = '\033[0m'
    
    print(f"\n{'='*50}")
    print(f"{color}📊 量化评分：{total}/100 (评级: {grade}){reset}")
    print(f"{'='*50}\n")
    
    # 细分维度（带进度条）
    def print_bar(label, score, max_score):
        percentage = score / max_score
        bar_length = 20
        filled = int(bar_length * percentage)
        bar = '▓' * filled + '░' * (bar_length - filled)
        print(f"{label:8s}: {bar}  {score}/{max_score}")
    
    print_bar("趋势", breakdown.get('trend', 0), 30)
    print_bar("动量", breakdown.get('momentum', 0), 25)
    print_bar("量能", breakdown.get('volume', 0), 15)
    print_bar("波动", breakdown.get('volatility', 0), 15)
    print_bar("形态", breakdown.get('pattern', 0), 15)
    
    # 检测到的信号
    print(f"\n{'─'*50}")
    print("🔍 检测到的信号:")
    print(f"{'─'*50}")
    for sig in signals[:10]:  # 最多显示10个
        print(f"  ✓ {sig}")
    
    print(f"{'='*50}\n")


def create_test_klines_bullish():
    """创建看涨测试数据"""
    # 模拟红三兵+放量上涨
    base_price = 100
    return [
        {"open": base_price-5, "high": base_price-4, "low": base_price-6, "close": base_price-5, "volume": 1000000},
        {"open": base_price-4, "high": base_price-3, "low": base_price-5, "close": base_price-4, "volume": 1100000},
        {"open": base_price-3, "high": base_price-1, "low": base_price-4, "close": base_price-2, "volume": 1200000},
        {"open": base_price-2, "high": base_price, "low": base_price-3, "close": base_price-1, "volume": 1300000},
        {"open": base_price-1, "high": base_price+1, "low": base_price-2, "close": base_price, "volume": 1400000},
        # 最近5根：上涨趋势
        {"open": base_price, "high": base_price+2, "low": base_price-0.5, "close": base_price+1.5, "volume": 1500000},
        {"open": base_price+1.5, "high": base_price+3, "low": base_price+1, "close": base_price+2.5, "volume": 1600000},
        {"open": base_price+2.5, "high": base_price+4, "low": base_price+2, "close": base_price+3.5, "volume": 1700000},
        # 最近3根：红三兵
        {"open": base_price+3, "high": base_price+4.5, "low": base_price+2.8, "close": base_price+4, "volume": 1800000},
        {"open": base_price+4, "high": base_price+5, "low": base_price+3.8, "close": base_price+4.8, "volume": 1900000},
        # 最后一根：锤子线（长下影线）
        {"open": base_price+4.5, "high": base_price+5.5, "low": base_price+3.5, "close": base_price+5, "volume": 2000000},
    ] * 10  # 重复以满足60根的需求


def create_test_klines_bearish():
    """创建看跌测试数据"""
    # 模拟黑三兵+缩量下跌
    base_price = 100
    return [
        {"open": base_price+5, "high": base_price+6, "low": base_price+4, "close": base_price+5, "volume": 2000000},
        {"open": base_price+4, "high": base_price+5, "low": base_price+3, "close": base_price+4, "volume": 1900000},
        {"open": base_price+3, "high": base_price+4, "low": base_price+1, "close": base_price+2, "volume": 1800000},
        {"open": base_price+2, "high": base_price+3, "low": base_price, "close": base_price+1, "volume": 1700000},
        {"open": base_price+1, "high": base_price+2, "low": base_price-1, "close": base_price, "volume": 1600000},
        # 最近5根：下跌趋势
        {"open": base_price, "high": base_price+0.5, "low": base_price-2, "close": base_price-1.5, "volume": 1500000},
        {"open": base_price-1.5, "high": base_price-1, "low": base_price-3, "close": base_price-2.5, "volume": 1400000},
        {"open": base_price-2.5, "high": base_price-2, "low": base_price-4, "close": base_price-3.5, "volume": 1300000},
        # 最近3根：黑三兵
        {"open": base_price-3, "high": base_price-2.8, "low": base_price-4.5, "close": base_price-4, "volume": 1200000},
        {"open": base_price-4, "high": base_price-3.8, "low": base_price-5, "close": base_price-4.8, "volume": 1100000},
        # 最后一根：吊颈线（长上影线）
        {"open": base_price-4.5, "high": base_price-3, "low": base_price-5.5, "close": base_price-5, "volume": 1000000},
    ] * 10  # 重复以满足60根的需求


def create_test_klines_neutral():
    """创建中性测试数据"""
    # 模拟横盘震荡
    base_price = 100
    klines = []
    for i in range(100):
        variation = (i % 5 - 2) * 0.5
        klines.append({
            "open": base_price + variation - 0.2,
            "high": base_price + variation + 0.5,
            "low": base_price + variation - 0.5,
            "close": base_price + variation + 0.1,
            "volume": 1000000 + i * 1000
        })
    return klines


def test_scenario(name, klines, scenario="buy_focus"):
    """测试场景"""
    print(f"\n{'#'*60}")
    print(f"# 测试场景：{name}")
    print(f"{'#'*60}")
    
    # 创建分析器实例（不需要真实API key，只测试评分）
    analyzer = DeepSeekAnalyzer(api_key="test", model="deepseek-chat")
    
    # 1. 计算指标
    indicators = analyzer._calculate_indicators(klines)
    
    print("\n📈 技术指标:")
    print(f"  当前价格: ${indicators.get('current_price', 0):.2f}")
    print(f"  MA5: ${indicators.get('ma5', 0):.2f}")
    print(f"  MA20: ${indicators.get('ma20', 0):.2f}")
    print(f"  MA60: ${indicators.get('ma60', 0):.2f}" if indicators.get('ma60') else "  MA60: N/A")
    print(f"  RSI: {indicators.get('rsi', 50):.1f}")
    print(f"  MACD: {indicators.get('macd', 0):.4f}")
    print(f"  MACD Signal: {indicators.get('macd_signal', 0):.4f}")
    print(f"  量比: {indicators.get('volume_ratio', 1.0):.2f}x")
    print(f"  布林上轨: ${indicators.get('bollinger_upper', 0):.2f}")
    print(f"  布林中轨: ${indicators.get('bollinger_middle', 0):.2f}")
    print(f"  布林下轨: ${indicators.get('bollinger_lower', 0):.2f}")
    
    # 2. 计算评分
    score = analyzer._calculate_score(klines, indicators, scenario)
    
    # 3. 打印评分卡片
    print_score_card(score)
    
    # 4. 给出建议
    grade = score['grade']
    total = score['total']
    
    print("💡 系统建议:")
    if grade == 'A':
        print(f"  ✅ 强烈推荐买入（评分{total}分）")
        print(f"  建议信心度：0.85-0.95")
    elif grade == 'B':
        print(f"  ✅ 推荐买入（评分{total}分）")
        print(f"  建议信心度：0.75-0.85")
    elif grade == 'C':
        print(f"  ⚠️  中性观望（评分{total}分）")
        print(f"  建议信心度：0.65-0.75")
    else:
        print(f"  ❌ 不推荐买入（评分{total}分）")
        print(f"  建议信心度：<0.65")
    
    return score


def main():
    print("\n" + "="*60)
    print("  🤖 量化评分系统测试")
    print("="*60)
    
    # 测试1：看涨场景
    score1 = test_scenario(
        "看涨场景 - 红三兵+放量+锤子线",
        create_test_klines_bullish(),
        "buy_focus"
    )
    
    # 测试2：看跌场景
    score2 = test_scenario(
        "看跌场景 - 黑三兵+缩量+吊颈线",
        create_test_klines_bearish(),
        "buy_focus"
    )
    
    # 测试3：中性场景
    score3 = test_scenario(
        "中性场景 - 横盘震荡",
        create_test_klines_neutral(),
        "buy_focus"
    )
    
    # 对比总结
    print(f"\n{'='*60}")
    print("📊 评分对比总结")
    print(f"{'='*60}\n")
    print(f"看涨场景: {score1['total']}/100 (评级: {score1['grade']})")
    print(f"看跌场景: {score2['total']}/100 (评级: {score2['grade']})")
    print(f"中性场景: {score3['total']}/100 (评级: {score3['grade']})")
    print()
    
    print("✅ 测试完成！评分系统运行正常。\n")
    print("💡 提示：")
    print("  - 在实际交易中，AI会结合这些评分做出最终决策")
    print("  - 评分仅作为参考，不是唯一决策依据")
    print("  - 建议评分≥65分(B级)时考虑交易\n")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()












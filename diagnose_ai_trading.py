#!/usr/bin/env python3
"""
AI 交易诊断工具
用于分析AI决策历史、信心度分布、成交情况等
"""
import sys
import os

# 添加backend路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.db import get_connection
from datetime import datetime, timedelta
from collections import defaultdict
import json


def print_header(text):
    """打印标题"""
    print(f"\n{'='*80}")
    print(f"  {text}")
    print(f"{'='*80}\n")


def get_ai_config():
    """获取AI交易配置"""
    with get_connection() as conn:
        result = conn.execute("""
            SELECT * FROM ai_trading_config ORDER BY id DESC LIMIT 1
        """).fetchone()
        
        if result:
            return dict(result)
        return None


def get_analysis_stats(days=7):
    """获取AI分析统计"""
    since = datetime.now() - timedelta(days=days)
    
    with get_connection() as conn:
        # 总分析次数
        total = conn.execute("""
            SELECT COUNT(*) as cnt FROM ai_analysis
            WHERE analysis_time >= ?
        """, (since,)).fetchone()['cnt']
        
        # 按决策类型统计
        by_action = conn.execute("""
            SELECT 
                json_extract(ai_response, '$.action') as action,
                COUNT(*) as cnt,
                AVG(json_extract(ai_response, '$.confidence')) as avg_confidence
            FROM ai_analysis
            WHERE analysis_time >= ?
            GROUP BY action
        """, (since,)).fetchall()
        
        # 触发交易的分析
        triggered = conn.execute("""
            SELECT COUNT(*) as cnt FROM ai_analysis
            WHERE analysis_time >= ? AND triggered_trade = 1
        """, (since,)).fetchone()['cnt']
        
        # 信心度分布
        confidence_dist = conn.execute("""
            SELECT 
                CASE 
                    WHEN json_extract(ai_response, '$.confidence') >= 0.85 THEN '0.85-1.0 (强烈)'
                    WHEN json_extract(ai_response, '$.confidence') >= 0.70 THEN '0.70-0.85 (推荐)'
                    WHEN json_extract(ai_response, '$.confidence') >= 0.60 THEN '0.60-0.70 (可尝试)'
                    ELSE '<0.60 (观望)'
                END as range,
                COUNT(*) as cnt
            FROM ai_analysis
            WHERE analysis_time >= ?
            GROUP BY range
            ORDER BY range DESC
        """, (since,)).fetchall()
        
        return {
            'total': total,
            'by_action': [dict(row) for row in by_action],
            'triggered': triggered,
            'confidence_dist': [dict(row) for row in confidence_dist]
        }


def get_trade_stats(days=7):
    """获取交易统计"""
    since = datetime.now() - timedelta(days=days)
    
    with get_connection() as conn:
        # 总交易次数
        total = conn.execute("""
            SELECT COUNT(*) as cnt FROM ai_trades
            WHERE trade_time >= ?
        """, (since,)).fetchone()['cnt']
        
        # 按行动类型统计
        by_action = conn.execute("""
            SELECT 
                action,
                COUNT(*) as cnt,
                AVG(ai_confidence) as avg_confidence,
                SUM(CASE WHEN status = 'FILLED' OR status = 'SIMULATED' THEN 1 ELSE 0 END) as success_cnt
            FROM ai_trades
            WHERE trade_time >= ?
            GROUP BY action
        """, (since,)).fetchall()
        
        # 盈亏统计（仅SELL）
        pnl_stats = conn.execute("""
            SELECT 
                COUNT(*) as trades,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
                AVG(pnl) as avg_pnl,
                SUM(pnl) as total_pnl,
                AVG(pnl_percent) as avg_pnl_percent
            FROM ai_trades
            WHERE trade_time >= ? AND action = 'SELL'
        """, (since,)).fetchone()
        
        return {
            'total': total,
            'by_action': [dict(row) for row in by_action],
            'pnl_stats': dict(pnl_stats) if pnl_stats else None
        }


def get_missed_opportunities(days=1, min_confidence=0.65):
    """获取错过的机会（高信心度但未交易）"""
    since = datetime.now() - timedelta(days=days)
    
    with get_connection() as conn:
        missed = conn.execute("""
            SELECT 
                symbol,
                analysis_time,
                json_extract(ai_response, '$.action') as action,
                json_extract(ai_response, '$.confidence') as confidence,
                json_extract(ai_response, '$.reasoning') as reasoning,
                skip_reason
            FROM ai_analysis
            WHERE analysis_time >= ?
                AND triggered_trade = 0
                AND json_extract(ai_response, '$.action') IN ('BUY', 'SELL')
                AND json_extract(ai_response, '$.confidence') >= ?
            ORDER BY confidence DESC
            LIMIT 20
        """, (since, min_confidence)).fetchall()
        
        return [dict(row) for row in missed]


def get_recent_positions():
    """获取当前持仓"""
    with get_connection() as conn:
        positions = conn.execute("""
            SELECT 
                symbol,
                quantity,
                avg_cost,
                current_price,
                unrealized_pnl,
                unrealized_pnl_percent,
                stop_loss_price,
                take_profit_price,
                created_at
            FROM ai_positions
            ORDER BY created_at DESC
        """).fetchall()
        
        return [dict(row) for row in positions]


def main():
    print_header("🤖 AI 交易诊断工具")
    
    # 1. 配置信息
    print_header("📋 当前配置")
    config = get_ai_config()
    if config:
        print(f"启用状态: {'✅ 已启用' if config.get('enabled') else '❌ 已禁用'}")
        print(f"监控股票: {config.get('symbols', '[]')}")
        print(f"检查间隔: {config.get('check_interval_minutes', 5)} 分钟")
        print(f"AI模型: {config.get('ai_model', 'deepseek-chat')}")
        print(f"Temperature: {config.get('ai_temperature', 0.3)}")
        print(f"最小信心度阈值: {config.get('min_confidence', 0.75):.2f}")
        print(f"每日最大交易次数: {config.get('max_daily_trades', 20)}")
        print(f"每日最大亏损: ${config.get('max_loss_per_day', 5000):.2f}")
        print(f"单次交易金额: ${config.get('fixed_amount_per_trade', 10000):.2f}")
        print(f"真实交易模式: {'✅ 已启用' if config.get('enable_real_trading') else '❌ 模拟模式'}")
    else:
        print("⚠️  未找到配置信息")
    
    # 2. 近7天分析统计
    print_header("📊 近7天AI分析统计")
    stats = get_analysis_stats(days=7)
    print(f"总分析次数: {stats['total']}")
    print(f"触发交易次数: {stats['triggered']} ({stats['triggered']/max(stats['total'],1)*100:.1f}%)")
    print()
    
    print("按决策类型分布:")
    for row in stats['by_action']:
        action = row['action']
        cnt = row['cnt']
        avg_conf = row.get('avg_confidence', 0) or 0
        pct = cnt / max(stats['total'], 1) * 100
        print(f"  {action:6s}: {cnt:3d} 次 ({pct:5.1f}%) | 平均信心度: {avg_conf:.2f}")
    print()
    
    print("信心度分布:")
    for row in stats['confidence_dist']:
        range_str = row['range']
        cnt = row['cnt']
        pct = cnt / max(stats['total'], 1) * 100
        bar = '█' * int(pct / 2)
        print(f"  {range_str:20s}: {cnt:3d} 次 ({pct:5.1f}%) {bar}")
    
    # 3. 近7天交易统计
    print_header("💰 近7天交易统计")
    trade_stats = get_trade_stats(days=7)
    print(f"总交易次数: {trade_stats['total']}")
    print()
    
    if trade_stats['total'] > 0:
        print("按操作类型:")
        for row in trade_stats['by_action']:
            action = row['action']
            cnt = row['cnt']
            success = row['success_cnt']
            avg_conf = row.get('avg_confidence', 0) or 0
            print(f"  {action:6s}: {cnt:3d} 次 | 成功: {success} | 平均信心度: {avg_conf:.2f}")
        print()
        
        # 盈亏统计
        if trade_stats['pnl_stats'] and trade_stats['pnl_stats']['trades'] > 0:
            pnl = trade_stats['pnl_stats']
            print("盈亏统计 (SELL交易):")
            print(f"  总交易: {pnl['trades']} 笔")
            print(f"  盈利: {pnl['wins']} 笔 | 亏损: {pnl['losses']} 笔")
            win_rate = pnl['wins'] / max(pnl['trades'], 1) * 100
            print(f"  胜率: {win_rate:.1f}%")
            print(f"  平均盈亏: ${pnl['avg_pnl']:.2f} ({pnl['avg_pnl_percent']:.2f}%)")
            print(f"  总盈亏: ${pnl['total_pnl']:.2f}")
    else:
        print("暂无交易记录")
    
    # 4. 当前持仓
    print_header("📦 当前持仓")
    positions = get_recent_positions()
    if positions:
        for pos in positions:
            pnl_color = '🟢' if pos['unrealized_pnl_percent'] > 0 else '🔴'
            print(f"{pnl_color} {pos['symbol']:6s} | "
                  f"数量: {pos['quantity']:4.0f} | "
                  f"成本: ${pos['avg_cost']:.2f} | "
                  f"现价: ${pos['current_price']:.2f} | "
                  f"盈亏: ${pos['unrealized_pnl']:.2f} ({pos['unrealized_pnl_percent']:+.2f}%)")
    else:
        print("暂无持仓")
    
    # 5. 错过的机会（近24小时，信心度≥0.65）
    print_header("⚠️  错过的机会（近24小时，信心度≥0.65）")
    missed = get_missed_opportunities(days=1, min_confidence=0.65)
    if missed:
        print(f"发现 {len(missed)} 个可能错过的交易机会：\n")
        for i, m in enumerate(missed, 1):
            try:
                reasoning = json.loads(m['reasoning']) if m['reasoning'] else []
                reasoning_text = '; '.join(reasoning[:2])  # 只显示前2条理由
            except:
                reasoning_text = str(m['reasoning'])[:100]
            
            print(f"{i}. {m['symbol']} | {m['action']} | "
                  f"信心度: {m['confidence']:.2f} | "
                  f"时间: {m['analysis_time']}")
            print(f"   跳过原因: {m['skip_reason']}")
            print(f"   理由: {reasoning_text}")
            print()
    else:
        print("✅ 近24小时没有错过高信心度的交易机会")
    
    # 6. 建议
    print_header("💡 优化建议")
    
    # 基于统计数据给出建议
    min_conf = config.get('min_confidence', 0.75) if config else 0.75
    trigger_rate = stats['triggered'] / max(stats['total'], 1) * 100
    
    print(f"当前信心度阈值: {min_conf:.2f}")
    print(f"成交率 (触发/分析): {trigger_rate:.1f}%\n")
    
    if trigger_rate < 20:
        print("⚠️  成交率过低（<20%），可能错过大量机会")
        print("   建议：")
        print(f"   1. 降低信心度阈值到 {max(min_conf - 0.05, 0.60):.2f}")
        print("   2. 检查是否有K线数据缺失")
        print("   3. 查看上方「错过的机会」，分析原因")
    elif trigger_rate < 35:
        print("⚠️  成交率偏低（20-35%），可能还有优化空间")
        print("   建议：")
        print(f"   1. 可考虑降低信心度阈值到 {max(min_conf - 0.02, 0.65):.2f}")
        print("   2. 观察1-2天，评估新阈值效果")
    elif trigger_rate < 55:
        print("✅ 成交率适中（35-55%），平衡合理")
        print("   建议：保持当前配置，继续观察")
    else:
        print("⚠️  成交率较高（>55%），可能交易过于频繁")
        print("   建议：")
        print(f"   1. 可考虑提高信心度阈值到 {min(min_conf + 0.03, 0.80):.2f}")
        print("   2. 检查是否盈亏比合理（胜率 × 盈亏比 > 1）")
    
    print()
    
    # 查看日志命令
    print("查看详细日志：")
    print("  tail -f logs/backend.log | grep 'AI Decision'")
    print("  tail -f logs/backend.log | grep '🤖\\|💰\\|✅'")
    
    print()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"❌ 诊断失败: {e}")
        import traceback
        traceback.print_exc()












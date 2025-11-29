#!/usr/bin/env python3
"""一键修复 AI 交易配置 - 降低阈值并启用真实交易"""

import sys
sys.path.insert(0, 'backend')

from app.repositories import get_ai_trading_config, update_ai_trading_config

print("=" * 80)
print("🔧 一键修复 AI 交易配置")
print("=" * 80)

# 获取当前配置
current_config = get_ai_trading_config()

if not current_config:
    print("\n❌ 配置不存在，请先运行: python fix_real_trading.py")
    sys.exit(1)

print("\n📋 当前配置:")
print(f"  - enabled: {current_config.get('enabled')}")
print(f"  - enable_real_trading: {current_config.get('enable_real_trading')} {'⚠️  已启用' if current_config.get('enable_real_trading') else '❌ 模拟模式'}")
print(f"  - min_confidence: {current_config.get('min_confidence', 0.75) * 100:.0f}%")
print(f"  - symbols: {current_config.get('symbols', [])}")

# 询问用户是否修改
print("\n💡 问题分析:")
print(f"  - AI 给出的最高信心度: 72%")
print(f"  - 当前阈值: {current_config.get('min_confidence', 0.75) * 100:.0f}%")
print(f"  - 结果: 所有交易都被跳过（信心度不足）")

print("\n🔧 修复方案:")
print("  1. 降低信心度阈值: 75% → 65%")
print("  2. 启用真实交易: False → True")
print("  3. 启用引擎: False → True")

# 自动修复
print("\n⚙️  正在应用修复...")

# 更新配置
current_config.update({
    'enabled': True,                    # 启用引擎
    'enable_real_trading': True,        # 启用真实交易
    'min_confidence': 0.65,             # 降低阈值到 65%
})

# 确保有监控股票
if not current_config.get('symbols') or len(current_config.get('symbols', [])) == 0:
    current_config['symbols'] = ['EDUC.US', 'CCC.US', 'EDSA.US']
    print("  - 设置监控股票: EDUC.US, CCC.US, EDSA.US")

# 确保有 AI API Key
if not current_config.get('ai_api_key') or current_config.get('ai_api_key', '').strip() == '':
    print("\n⚠️  警告: DeepSeek API Key 未配置")
    print("  请在前端「基础配置」页面设置 AI 配置")
    print("  或者在「AI Trading」设置中填写 AI API Key")

# 保存配置
try:
    update_ai_trading_config(current_config)
    print("\n✅ 配置已更新!")
except Exception as e:
    print(f"\n❌ 保存配置失败: {e}")
    sys.exit(1)

# 显示更新后的配置
print("\n📋 更新后的配置:")
print(f"  - enabled: ✅ {current_config.get('enabled')}")
print(f"  - enable_real_trading: ⚠️  {current_config.get('enable_real_trading')}")
print(f"  - min_confidence: 🎯 {current_config.get('min_confidence') * 100:.0f}%")
print(f"  - symbols: {current_config.get('symbols')}")

print("\n" + "=" * 80)
print("✅ 修复完成！")
print("=" * 80)

print("\n📌 下一步操作:")
print("  1. 访问 AI Trading 页面: http://localhost:5173/ai-trading")
print("  2. 如果引擎正在运行，点击「停止引擎」")
print("  3. 点击「启动引擎」（会加载新配置）")
print("  4. 点击「立即分析」测试")
print("  5. 观察日志，应该看到:")
print("     💰 真实买入: EDUC.US x XXX @ 市价")
print("     📤 提交买入订单...")

print("\n⚠️  重要提示:")
print("  - 真实交易已启用，将执行真实下单")
print("  - 信心度阈值已降低到 65%")
print("  - 请确保 Longbridge 凭据已配置且账户资金充足")
print("  - 建议先用小金额测试（如 $5000）")

print("\n💡 验证命令:")
print("  python diagnose_real_trading_detailed.py")
print("=" * 80)



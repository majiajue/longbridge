#!/usr/bin/env python3
"""测试 AI 交易是否准备就绪"""

import sys
sys.path.insert(0, 'backend')

from app.db import get_connection
from app.repositories import load_ai_credentials

print("=" * 80)
print("🧪 测试 AI 交易准备状态")
print("=" * 80)

issues = []
warnings = []

# 1. 检查数据库配置
print("\n1️⃣  检查数据库配置...")
try:
    with get_connection() as conn:
        result = conn.execute('''
            SELECT enabled, enable_real_trading, min_confidence, symbols, ai_api_key
            FROM ai_trading_config WHERE id = 1
        ''').fetchone()
        
        if not result:
            issues.append("❌ AI 交易配置不存在")
        else:
            enabled, real_trading, min_conf, symbols, api_key = result
            
            if not enabled:
                issues.append("❌ AI 引擎未启用")
            else:
                print("   ✅ 引擎已启用")
            
            if not real_trading:
                warnings.append("⚠️  当前是模拟模式（非真实交易）")
            else:
                print("   ⚠️  真实交易已启用")
            
            if min_conf >= 0.75:
                warnings.append(f"⚠️  信心度阈值较高: {min_conf*100:.0f}%（AI 最高72%）")
            else:
                print(f"   ✅ 信心度阈值: {min_conf*100:.0f}%")
            
            import json
            try:
                symbols_list = json.loads(symbols) if symbols else []
            except:
                symbols_list = []
            
            if not symbols_list:
                issues.append("❌ 未设置监控股票")
            else:
                print(f"   ✅ 监控股票: {', '.join(symbols_list)}")
            
            if not api_key or api_key.strip() == '':
                print("   ℹ️  配置中的 API Key 未设置（将从 settings 读取）")
except Exception as e:
    issues.append(f"❌ 数据库检查失败: {e}")

# 2. 检查 DeepSeek API Key
print("\n2️⃣  检查 DeepSeek API Key...")
try:
    creds = load_ai_credentials()
    deepseek_key = creds.get('DEEPSEEK_API_KEY', '').strip()
    
    if deepseek_key:
        print(f"   ✅ DeepSeek API Key 已配置 ({deepseek_key[:10]}...)")
    else:
        issues.append("❌ DeepSeek API Key 未配置")
        print("   ❌ 未在 settings 表中找到 DEEPSEEK_API_KEY")
except Exception as e:
    issues.append(f"❌ 无法读取凭据: {e}")

# 3. 检查 Longbridge 凭据
print("\n3️⃣  检查 Longbridge 凭据...")
try:
    from app.repositories import get_credentials
    lb_creds = get_credentials()
    
    if all(lb_creds.get(k) for k in ['LONGPORT_APP_KEY', 'LONGPORT_APP_SECRET', 'LONGPORT_ACCESS_TOKEN']):
        print("   ✅ Longbridge 凭据已配置")
    else:
        warnings.append("⚠️  Longbridge 凭据可能不完整")
except Exception as e:
    warnings.append(f"⚠️  无法验证 Longbridge 凭据: {e}")

# 总结
print("\n" + "=" * 80)
if issues:
    print("🚨 发现以下问题（必须修复）:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("✅ 所有必要配置检查通过!")

if warnings:
    print("\n⚠️  注意事项:")
    for warning in warnings:
        print(f"  {warning}")

print("\n" + "=" * 80)

if not issues:
    print("🎉 AI 交易已准备就绪!")
    print("\n📌 下一步:")
    print("  1. 访问: http://localhost:5173/ai-trading")
    print("  2. 点击「启动引擎」")
    print("  3. 点击「立即分析」测试")
    print("  4. 观察日志应该显示:")
    print("     - 真实交易: ⚠️ 已启用")
    print("     - 最小信心度: 65%")
    print("     - 💰 真实买入: XXX")
else:
    print("❌ 请先修复上述问题")
    print("\n💡 快速修复:")
    print("  1. 运行: python fix_ai_config_complete.py")
    print("  2. 访问: http://localhost:5173/settings")
    print("  3. 填写 DeepSeek API Key")

print("=" * 80)



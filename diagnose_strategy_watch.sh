#!/bin/bash
# 策略盯盘诊断脚本

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          策略盯盘诊断工具 🔧                               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# 1. 检查后端服务
echo "====== 1️⃣  检查后端服务 ======"
if curl -s -m 5 http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ 后端服务正常运行"
else
    echo "❌ 后端服务未启动或无响应"
    echo "   💡 解决方案: 运行 ./start.sh 启动服务"
    exit 1
fi
echo ""

# 2. 检查凭据配置
echo "====== 2️⃣  检查 API 凭据 ======"
cred_check=$(curl -s http://localhost:8000/settings/credentials 2>&1)
if echo "$cred_check" | grep -q "LONGPORT_APP_KEY"; then
    echo "✅ 凭据已配置"
    
    # 测试凭据有效性
    echo "   🔄 测试凭据有效性..."
    verify_result=$(curl -s -X POST http://localhost:8000/settings/verify \
        -H "Content-Type: application/json" \
        -d '{"symbols":[]}' 2>&1)
    
    if echo "$verify_result" | grep -q "401003"; then
        echo "   ❌ ACCESS_TOKEN 已过期 (code=401003)"
        echo "   💡 解决方案:"
        echo "      1. 访问 https://open.longbridgeapp.com/"
        echo "      2. 重新生成 ACCESS_TOKEN（选择「长期Token」）"
        echo "      3. 在「基础配置」页面更新并保存"
        exit 1
    elif echo "$verify_result" | grep -q "401004"; then
        echo "   ❌ ACCESS_TOKEN 无效 (code=401004)"
        echo "   💡 解决方案: 检查 TOKEN 是否完整复制，没有多余空格"
        exit 1
    elif echo "$verify_result" | grep -q "verified_count"; then
        echo "   ✅ 凭据有效，可以访问 API"
    else
        echo "   ⚠️  凭据验证返回异常，请检查后端日志"
    fi
else
    echo "❌ 凭据未配置"
    echo "   💡 解决方案: 在「基础配置」页面配置 Longbridge API 凭据"
    exit 1
fi
echo ""

# 3. 检查持仓数量
echo "====== 3️⃣  检查持仓股票 ======"
portfolio_check=$(curl -s http://localhost:8000/portfolio/overview 2>&1)
if echo "$portfolio_check" | grep -q "positions"; then
    position_count=$(echo "$portfolio_check" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(len(data.get('positions', [])))
except:
    print(0)
" 2>/dev/null)
    
    if [ "$position_count" -gt 0 ]; then
        echo "✅ 检测到 $position_count 只持仓股票"
    else
        echo "⚠️  暂无持仓股票"
        echo "   💡 提示: 可以在「基础配置」手动添加监控股票"
    fi
else
    echo "❌ 无法获取持仓数据"
    echo "   💡 解决方案: 检查 ACCESS_TOKEN 是否有效"
fi
echo ""

# 4. 检查监控股票配置
echo "====== 4️⃣  检查监控股票配置 ======"
symbols_check=$(curl -s http://localhost:8000/settings/symbols 2>&1)
if echo "$symbols_check" | grep -q "symbols"; then
    manual_count=$(echo "$symbols_check" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(len(data.get('symbols', [])))
except:
    print(0)
" 2>/dev/null)
    
    if [ "$manual_count" -gt 0 ]; then
        echo "✅ 已配置 $manual_count 只监控股票"
    else
        echo "⚠️  未配置监控股票"
        echo "   💡 提示: 如果有持仓会自动监控，也可以手动添加"
    fi
else
    echo "⚠️  无法获取监控股票配置"
fi
echo ""

# 5. 检查K线数据
echo "====== 5️⃣  检查历史K线数据 ======"
ohlc_check=$(python3 -c "
import duckdb
try:
    conn = duckdb.connect('data/quant.db', read_only=True)
    result = conn.execute('SELECT COUNT(DISTINCT symbol) as symbol_count, COUNT(*) as total_bars FROM ohlc').fetchone()
    print(f'{result[0]}|{result[1]}')
    conn.close()
except Exception as e:
    print('0|0')
" 2>/dev/null)

symbol_count=$(echo "$ohlc_check" | cut -d'|' -f1)
total_bars=$(echo "$ohlc_check" | cut -d'|' -f2)

if [ "$symbol_count" -gt 0 ]; then
    echo "✅ 已同步 $symbol_count 只股票的K线数据（共 $total_bars 条）"
else
    echo "❌ 数据库中没有K线数据！"
    echo "   💡 解决方案:"
    echo "      方案1（推荐）: 访问「关于行情」页面点击「同步历史数据」"
    echo "      方案2: 运行命令 python3 sync_position_data.py"
    exit 1
fi
echo ""

# 6. 检查策略信号
echo "====== 6️⃣  检查策略信号 ======"
signals_check=$(curl -s http://localhost:8000/strategies/advanced/watchlist/signals 2>&1)
if echo "$signals_check" | grep -q "signals"; then
    signal_stats=$(echo "$signals_check" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"{data.get('position_count', 0)}|{data.get('manual_count', 0)}|{len(data.get('signals', []))}\")
except:
    print('0|0|0')
" 2>/dev/null)
    
    pos_count=$(echo "$signal_stats" | cut -d'|' -f1)
    man_count=$(echo "$signal_stats" | cut -d'|' -f2)
    sig_count=$(echo "$signal_stats" | cut -d'|' -f3)
    
    echo "✅ 持仓: $pos_count 只 | 监控: $man_count 只 | 信号: $sig_count 条"
    
    if [ "$sig_count" -eq 0 ]; then
        total_stocks=$((pos_count + man_count))
        if [ "$total_stocks" -gt 0 ]; then
            echo "   ⚠️  有股票但没有信号"
            echo "   💡 可能原因:"
            echo "      1. K线数据不足（需要至少30条）"
            echo "      2. 当前确实没有明显的买卖信号（这是正常的）"
            echo "      3. 股票最近没有交易（停牌/退市）"
        else
            echo "   ⚠️  没有持仓也没有配置监控股票"
            echo "   💡 解决方案: 在「基础配置」添加监控股票"
        fi
    fi
else
    echo "❌ 无法获取策略信号"
    echo "   💡 解决方案: 检查后端日志 tail -f logs/backend.log"
fi
echo ""

# 总结
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                   诊断结果总结                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

if [ "$symbol_count" -gt 0 ] && [ "$sig_count" -ge 0 ]; then
    echo "✅ 系统运行正常！"
    echo ""
    echo "📊 当前状态:"
    echo "   • 后端服务: 运行中"
    echo "   • API 凭据: 有效"
    echo "   • 持仓股票: $pos_count 只"
    echo "   • 监控股票: $man_count 只"
    echo "   • K线数据: $symbol_count 只股票，$total_bars 条"
    echo "   • 策略信号: $sig_count 条"
    echo ""
    echo "💡 访问策略盯盘: http://localhost:5173 → 策略盯盘 🎯"
else
    echo "⚠️  系统需要配置或修复"
    echo ""
    echo "请按照上述提示解决问题，或查看详细文档:"
    echo "   docs/TROUBLESHOOTING_STRATEGY_WATCH.md"
fi
echo ""
echo "======================================================================"


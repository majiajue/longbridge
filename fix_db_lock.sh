#!/bin/bash
# 彻底清理数据库锁问题

echo "🔧 开始修复数据库锁问题..."
echo "================================"

# 1. 停止所有相关进程
echo "1️⃣  停止所有后端进程..."
pkill -9 -f "uvicorn.*app.main" 2>/dev/null
pkill -9 -f "python.*backend" 2>/dev/null
pkill -9 -f "Python.*quant" 2>/dev/null

# 等待进程完全退出
sleep 2

# 2. 检查是否还有进程在运行
echo ""
echo "2️⃣  检查残留进程..."
DB_PROCESSES=$(lsof 2>/dev/null | grep "quant.db" | wc -l)
if [ "$DB_PROCESSES" -gt 0 ]; then
    echo "⚠️  警告: 仍有 $DB_PROCESSES 个进程在访问数据库"
    echo "   正在强制终止..."
    lsof 2>/dev/null | grep "quant.db" | awk '{print $2}' | sort -u | xargs kill -9 2>/dev/null
    sleep 1
else
    echo "✅ 无进程访问数据库"
fi

# 3. 清理WAL文件
echo ""
echo "3️⃣  清理WAL文件..."
if [ -f "backend/data/quant.db.wal" ]; then
    rm -f backend/data/quant.db.wal
    echo "✅ WAL文件已删除"
else
    echo "✅ 无WAL文件需要清理"
fi

# 4. 验证数据库文件
echo ""
echo "4️⃣  验证数据库文件..."
if [ -f "backend/data/quant.db" ]; then
    DB_SIZE=$(du -h backend/data/quant.db | cut -f1)
    echo "✅ 数据库文件存在: $DB_SIZE"
else
    echo "❌ 数据库文件不存在!"
    exit 1
fi

# 5. 测试数据库访问
echo ""
echo "5️⃣  测试数据库访问..."
backend/.venv/bin/python << 'PYTHON_EOF'
import sys
try:
    import duckdb
    conn = duckdb.connect('backend/data/quant.db')
    result = conn.execute("SELECT 1").fetchone()
    conn.close()
    if result and result[0] == 1:
        print("✅ 数据库访问正常")
        sys.exit(0)
    else:
        print("❌ 数据库测试失败")
        sys.exit(1)
except Exception as e:
    print(f"❌ 数据库错误: {e}")
    sys.exit(1)
PYTHON_EOF

if [ $? -ne 0 ]; then
    echo "❌ 数据库测试失败，请检查日志"
    exit 1
fi

# 6. 完成
echo ""
echo "================================"
echo "✅ 数据库锁问题修复完成！"
echo ""
echo "📝 下一步:"
echo "   1. 启动后端: ./start.sh"
echo "   2. 监控日志: tail -f logs/backend.log"
echo "   3. 检查进程: ps aux | grep uvicorn"
echo ""
echo "⚠️  注意: 确保只启动一个后端实例"








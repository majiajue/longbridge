#!/bin/bash
# 检查数据库状态和访问情况

echo "📊 数据库状态检查"
echo "================================"

# 1. 检查数据库文件
echo "1️⃣  数据库文件:"
if [ -f "backend/data/quant.db" ]; then
    ls -lh backend/data/quant.db | awk '{print "   大小: " $5 ", 修改时间: " $6 " " $7 " " $8}'
else
    echo "   ❌ 数据库文件不存在"
fi

if [ -f "backend/data/quant.db.wal" ]; then
    ls -lh backend/data/quant.db.wal | awk '{print "   ⚠️  WAL文件: " $5 " (可能存在未提交事务)"}'
else
    echo "   ✅ 无WAL文件"
fi

# 2. 检查访问进程
echo ""
echo "2️⃣  访问数据库的进程:"
DB_PIDS=$(lsof 2>/dev/null | grep "quant.db" | awk '{print $2}' | sort -u)
if [ -z "$DB_PIDS" ]; then
    echo "   ✅ 无进程访问数据库"
else
    echo "   ⚠️  以下进程正在访问:"
    for pid in $DB_PIDS; do
        ps -p $pid -o pid,ppid,user,command | tail -1 | sed 's/^/      /'
    done
fi

# 3. 检查后端进程
echo ""
echo "3️⃣  后端进程:"
BACKEND_PROCS=$(ps aux | grep -E "(uvicorn.*app.main|python.*backend)" | grep -v grep)
if [ -z "$BACKEND_PROCS" ]; then
    echo "   ⏸️  后端未运行"
else
    echo "$BACKEND_PROCS" | head -3 | sed 's/^/   /'
    COUNT=$(echo "$BACKEND_PROCS" | wc -l)
    if [ "$COUNT" -gt 1 ]; then
        echo "   ⚠️  警告: 发现 $COUNT 个后端进程（应该只有1个）"
    fi
fi

# 4. 检查端口占用
echo ""
echo "4️⃣  端口占用:"
PORT_8000=$(lsof -i :8000 2>/dev/null)
if [ -z "$PORT_8000" ]; then
    echo "   ✅ 端口 8000 空闲"
else
    echo "   🟢 端口 8000 占用:"
    echo "$PORT_8000" | tail -1 | sed 's/^/      /'
fi

# 5. 服务健康检查
echo ""
echo "5️⃣  服务健康检查:"
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ 后端服务正常 (HTTP 200)"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo "   ❌ 无法连接服务"
    else
        echo "   ⚠️  服务异常 (HTTP $HTTP_CODE)"
    fi
else
    echo "   ⚠️  curl 未安装，跳过健康检查"
fi

echo ""
echo "================================"
echo "💡 提示:"
echo "   - 如有锁冲突，运行: ./fix_db_lock.sh"
echo "   - 启动服务: ./start.sh"
echo "   - 停止服务: ./stop.sh"








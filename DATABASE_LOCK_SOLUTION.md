# 数据库锁问题完整解决方案

## 🔍 问题根源

### DuckDB 的限制

DuckDB 使用**排他锁机制**，不支持：
- ❌ 多进程同时访问同一数据库
- ❌ 多个数据库连接（即使在同一进程内）

### 常见原因

1. **多个后端进程**
   ```bash
   uvicorn app.main:app --reload  # 进程 1
   python some_script.py          # 进程 2 - 也访问数据库
   ```

2. **未正常关闭的进程**
   - Ctrl+C 可能不会完全终止
   - 后台进程残留

3. **WAL 文件残留**
   - `quant.db.wal` - Write-Ahead Log
   - 表示有未提交的事务

## ✅ 即时修复

### 方法 1：使用修复脚本（推荐）

```bash
cd /Volumes/SamSung/longbridge
./fix_db_lock.sh
```

脚本会：
1. ✅ 停止所有后端进程
2. ✅ 清理 WAL 文件
3. ✅ 验证数据库访问
4. ✅ 测试连接

### 方法 2：手动修复

```bash
# 1. 停止所有进程
pkill -9 -f "uvicorn.*app.main"
pkill -9 -f "python.*backend"

# 2. 确认无进程访问数据库
lsof | grep quant.db

# 3. 清理 WAL 文件
rm -f backend/data/quant.db.wal

# 4. 重启服务
./start.sh
```

## 🛠️ 提供的工具

### 1. fix_db_lock.sh - 修复脚本

快速修复数据库锁问题：
```bash
./fix_db_lock.sh
```

**功能**：
- 停止所有后端进程
- 清理 WAL 文件
- 测试数据库连接
- 提供下一步指引

### 2. check_db_status.sh - 状态检查

检查数据库和服务状态：
```bash
./check_db_status.sh
```

**检查项**：
- 数据库文件大小和时间
- 访问进程列表
- 后端进程数量
- 端口占用情况
- 服务健康状态

**示例输出**：
```
📊 数据库状态检查
================================
1️⃣  数据库文件:
   大小: 455M, 修改时间: Oct 29 16:05
   ✅ 无WAL文件

2️⃣  访问数据库的进程:
   ✅ 无进程访问数据库

3️⃣  后端进程:
   🟢 uvicorn app.main:app (PID: 12345)

4️⃣  端口占用:
   🟢 端口 8000 占用 (正常)

5️⃣  服务健康检查:
   ✅ 后端服务正常 (HTTP 200)
```

## 🔧 代码层面的解决方案

### 当前实现（已有）

`backend/app/db.py` 已经使用了**单例连接模式**：

```python
# 全局单例连接
_CONN: DuckDBPyConnection | None = None
_LOCK = threading.RLock()

@contextmanager
def get_connection():
    with _LOCK:
        global _CONN
        if _CONN is None:
            _CONN = duckdb.connect(str(settings.duckdb_path))
            _run_migrations(_CONN)
        yield _CONN
```

**优点**：
- ✅ 同一进程内只有一个连接
- ✅ 线程安全（使用 RLock）
- ✅ 自动初始化和迁移

**限制**：
- ⚠️ 不能防止多进程访问
- ⚠️ 需要确保只启动一个后端实例

### 使用建议

1. **在代码中始终使用 `get_connection()`**

```python
# ✅ 正确
from app.db import get_connection

with get_connection() as conn:
    result = conn.execute("SELECT * FROM positions").fetchall()

# ❌ 错误 - 不要创建新连接
import duckdb
conn = duckdb.connect('backend/data/quant.db')  # 会导致锁冲突
```

2. **避免长时间持有连接**

```python
# ✅ 正确 - 用完即释放
with get_connection() as conn:
    data = conn.execute(query).fetchall()
# 连接自动释放

# ❌ 错误 - 长时间持有
with get_connection() as conn:
    data = conn.execute(query).fetchall()
    time.sleep(60)  # 阻塞其他操作
    # ... 更多操作
```

## 🚀 启动和停止最佳实践

### 启动前检查

```bash
# 1. 检查是否有残留进程
./check_db_status.sh

# 2. 如有问题，先修复
./fix_db_lock.sh

# 3. 启动服务
./start.sh
```

### 正常停止

```bash
# 使用官方停止脚本
./stop.sh
```

**不推荐**：
- ❌ `Ctrl+C` - 可能不完全停止
- ❌ 直接关闭终端 - 进程残留
- ❌ 强制杀进程 - 可能损坏数据

### 紧急停止

如果 `./stop.sh` 无效：
```bash
./fix_db_lock.sh
```

## 📊 监控和预防

### 1. 定期检查

建议定期运行状态检查：
```bash
# 添加到 crontab
*/10 * * * * cd /Volumes/SamSung/longbridge && ./check_db_status.sh >> logs/db_status.log
```

### 2. 启动时检查

修改 `start.sh` 添加预检查：
```bash
# 在启动前检查
if lsof | grep -q "quant.db"; then
    echo "⚠️  数据库被占用，正在清理..."
    ./fix_db_lock.sh
fi
```

### 3. 监控日志

关注这些错误：
```bash
tail -f logs/backend.log | grep -E "(lock|DuckDB|IO Error)"
```

## 🔄 迁移到支持并发的数据库（长期方案）

如果频繁遇到锁问题，考虑迁移到：

### 选项 1：PostgreSQL

**优点**：
- ✅ 完整的多进程/多用户支持
- ✅ ACID 事务
- ✅ 强大的并发控制

**迁移步骤**：
1. 导出 DuckDB 数据
2. 安装 PostgreSQL
3. 修改连接代码
4. 导入数据

### 选项 2：SQLite（WAL 模式）

**优点**：
- ✅ 轻量级，单文件
- ✅ WAL 模式支持读写并发
- ✅ 迁移简单

**配置**：
```python
import sqlite3
conn = sqlite3.connect('quant.db')
conn.execute('PRAGMA journal_mode=WAL')
```

### 选项 3：保持 DuckDB + Redis 缓存

**策略**：
- DuckDB：历史数据存储
- Redis：实时数据缓存
- 减少数据库访问频率

## 📝 常见问题

### Q1: 为什么会突然出现锁问题？

**A**: 通常是因为：
- 启动了多个后端实例
- 运行了直接访问数据库的脚本
- 之前的进程未正常关闭

### Q2: 可以同时运行多个后端吗？

**A**: 不可以。DuckDB 不支持多进程访问。如需横向扩展：
- 迁移到 PostgreSQL
- 或使用负载均衡器 + 单个数据库实例

### Q3: WAL 文件可以删除吗？

**A**: 
- ✅ 可以删除，**前提**是没有进程在访问
- ⚠️ 删除会丢失未提交的事务
- 💡 正常关闭服务会自动清理 WAL

### Q4: 如何避免锁问题？

**A**:
1. 确保只启动一个后端实例
2. 使用 `./start.sh` 和 `./stop.sh`
3. 运行脚本前检查服务状态
4. 定期运行 `check_db_status.sh`

## 🎯 快速命令参考

```bash
# 检查状态
./check_db_status.sh

# 修复锁问题
./fix_db_lock.sh

# 查看访问进程
lsof | grep quant.db

# 强制清理
pkill -9 -f uvicorn
rm -f backend/data/quant.db.wal

# 测试数据库
backend/.venv/bin/python -c "import duckdb; duckdb.connect('backend/data/quant.db').execute('SELECT 1')"

# 启动/停止
./start.sh
./stop.sh
```

---

## 📚 相关文档

- [AI_TRADING_FIX_COMPLETED.md](./AI_TRADING_FIX_COMPLETED.md) - AI交易修复
- [FIX_DATABASE_LOCK.md](./FIX_DATABASE_LOCK.md) - 锁问题详细说明

---

**创建日期**：2025-11-04  
**版本**：1.0  
**状态**：✅ 工具已创建，问题已修复








# DuckDB 数据库锁问题修复

## 问题描述

后端启动时报错：
```
ERROR: IO Error: Could not set lock on file "quant.db": Conflicting lock is held
```

## 原因分析

1. **DuckDB 单进程限制**：DuckDB 默认使用排他锁，同一时间只允许一个进程访问
2. **多个进程同时访问**：
   - 主应用进程
   - 行情流线程（`QuoteStreamManager._run_portfolio_updates`）
   - 持仓监控（`PositionMonitor`）
   - 可能的后台脚本

3. **WAL 文件残留**：`quant.db.wal` 文件表示之前的连接未正常关闭

## 解决方案

### 方案 1：使用连接池（推荐）

修改 `backend/app/db.py`，使用单例连接池：

```python
import duckdb
from contextlib import contextmanager
import threading

_db_lock = threading.RLock()
_db_connection = None

def get_connection():
    """获取数据库连接（线程安全的单例）"""
    global _db_connection
    with _db_lock:
        if _db_connection is None:
            db_path = get_settings().db_path
            _db_connection = duckdb.connect(str(db_path), read_only=False)
            _run_migrations(_db_connection)
        return _db_connection

@contextmanager
def get_db_cursor():
    """获取数据库游标（用于执行查询）"""
    conn = get_connection()
    with _db_lock:
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
```

### 方案 2：减少并发访问

1. **行情流线程中缓存数据**，减少数据库访问频率
2. **使用消息队列**传递数据而不是直接查询数据库
3. **定期批量写入**而不是实时写入

### 方案 3：切换到支持并发的数据库

考虑使用 PostgreSQL 或 SQLite（WAL模式）替代 DuckDB。

## 快速修复步骤

### 1. 停止所有进程

```bash
cd /Volumes/SamSung/longbridge
./stop.sh
pkill -9 -f "uvicorn.*app.main"
pkill -9 -f "python.*backend"
```

### 2. 清理锁文件

```bash
# 删除 WAL 文件（会丢失未提交的数据）
rm -f backend/data/quant.db.wal

# 或者使用 DuckDB 工具修复
python3 << EOF
import duckdb
conn = duckdb.connect('backend/data/quant.db')
conn.execute("CHECKPOINT")
conn.close()
EOF
```

### 3. 修改代码减少并发

临时方案：在 `streaming.py` 中禁用实时组合更新

```python
# 注释掉自动启动组合更新线程
# if not self._portfolio_thread or not self._portfolio_thread.is_alive():
#     self._portfolio_running = True
#     self._portfolio_thread = threading.Thread(...)
```

### 4. 重新启动

```bash
./start.sh
```

## 长期解决方案

### 修改数据库访问策略

创建 `backend/app/db_manager.py`：

```python
"""
数据库连接管理器
使用单例模式和连接池避免锁冲突
"""
import duckdb
import threading
from contextlib import contextmanager
from typing import Optional

class DatabaseManager:
    _instance: Optional['DatabaseManager'] = None
    _lock = threading.RLock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.connection: Optional[duckdb.DuckDBPyConnection] = None
            self.connection_lock = threading.RLock()
            self.initialized = True
    
    def connect(self, db_path: str):
        """初始化数据库连接"""
        with self.connection_lock:
            if self.connection is None:
                self.connection = duckdb.connect(db_path, read_only=False)
    
    @contextmanager
    def get_cursor(self):
        """获取游标的上下文管理器"""
        with self.connection_lock:
            cursor = self.connection.cursor()
            try:
                yield cursor
                self.connection.commit()
            except Exception:
                self.connection.rollback()
                raise
            finally:
                cursor.close()
    
    def close(self):
        """关闭连接"""
        with self.connection_lock:
            if self.connection:
                self.connection.close()
                self.connection = None

# 全局实例
db_manager = DatabaseManager()
```

## 监控和诊断

### 检查当前锁状态

```bash
# 查看哪些进程在访问数据库
lsof | grep quant.db

# 查看进程数量
ps aux | grep -c "python.*backend"
```

### 日志监控

```bash
# 监控数据库相关错误
tail -f logs/backend.log | grep -E "(lock|database|DuckDB)"
```

## 测试验证

创建测试脚本 `test_db_concurrent.py`：

```python
import duckdb
import threading
import time

def worker(worker_id):
    try:
        conn = duckdb.connect('backend/data/quant.db')
        print(f"Worker {worker_id}: 连接成功")
        conn.execute("SELECT 1")
        time.sleep(1)
        conn.close()
        print(f"Worker {worker_id}: 完成")
    except Exception as e:
        print(f"Worker {worker_id}: 失败 - {e}")

# 测试并发
threads = []
for i in range(3):
    t = threading.Thread(target=worker, args=(i,))
    threads.append(t)
    t.start()

for t in threads:
    t.join()
```

## 相关文件

- `backend/app/db.py` - 数据库连接管理
- `backend/app/streaming.py` - 行情流（包含组合更新线程）
- `backend/app/position_monitor.py` - 持仓监控
- `backend/app/repositories.py` - 数据访问层

---

**修复日期**：2025-11-04  
**优先级**：🔴 高  
**状态**：待修复









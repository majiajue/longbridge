# 自动同步持仓K线数据功能说明 🚀

## 概述

系统现在会在**后端启动时自动同步**所有持仓股票和监控股票的历史K线数据，无需手动操作！

---

## 功能特性

### ✅ 自动触发
- **启动时同步**：后端服务启动后3秒自动开始
- **智能识别**：自动获取持仓股票 + 手工配置的监控股票
- **去重合并**：同一股票只同步一次
- **异步执行**：后台运行，不阻塞其他服务启动

### ✅ 同步策略
- **数据量**：每只股票同步最近100个交易日的K线数据
- **请求间隔**：每只股票间隔0.5秒，避免API限流
- **错误容忍**：单只股票失败不影响其他股票
- **日志记录**：完整记录同步过程和结果

### ✅ 适用场景
1. **首次启动**：数据库为空，自动初始化所有股票数据
2. **日常重启**：更新最新的交易数据
3. **新增持仓**：买入新股票后重启，自动同步新股票数据
4. **手动监控**：添加新的监控股票后重启，自动同步

---

## 实现细节

### 代码位置

**文件**：`backend/app/main.py`

**核心函数**：`_auto_sync_position_data()`

```python
@app.on_event("startup")
async def on_startup() -> None:
    # ... 其他启动逻辑
    
    # Auto-sync position historical data
    asyncio.create_task(_auto_sync_position_data())
    logger.info("startup: auto-sync task scheduled")
```

### 同步流程

```
启动后端服务
     ↓
等待 3 秒（确保其他服务就绪）
     ↓
获取持仓股票列表
     ↓
获取手工监控股票列表
     ↓
合并去重
     ↓
逐个同步（每个间隔 0.5 秒）
     ↓
记录结果（成功/失败）
     ↓
完成
```

###日志示例

**成功同步：**
```
INFO:app.main:auto-sync: starting position data sync
INFO:app.main:auto-sync: found 14 position symbols
INFO:app.main:auto-sync: found 5 manual symbols
INFO:app.main:auto-sync: syncing 14 symbols
INFO:app.services:Got 100 candles for TSLL.US using candlesticks()
INFO:app.services:Inserted 100 records for TSLL.US
INFO:app.services:Got 100 candles for JD.US using candlesticks()
INFO:app.services:Inserted 100 records for JD.US
...
INFO:app.main:auto-sync: completed - success: 14, failed: 0
```

**部分失败：**
```
INFO:app.main:auto-sync: AAPL.US synced 100 bars
ERROR:app.main:auto-sync: XXXX.US failed: OpenApiException: symbol not found
INFO:app.main:auto-sync: completed - success: 13, failed: 1
```

---

## 使用指南

### 💡 用户无需任何操作

**传统方式**（已淘汰）：
1. 启动系统
2. 打开浏览器
3. 进入"关于行情"页面
4. 点击"同步历史数据"
5. 等待同步完成
6. 再去查看策略盯盘

**现在的方式**（自动化）：
1. 启动系统 ✅ 完成！

系统会在后台自动完成所有数据同步工作。

---

## 常见问题

### Q1: 如何确认自动同步是否成功？

**方法 1：查看后端日志**
```bash
tail -f /Volumes/SamSung/longbridge/logs/backend.log | grep "auto-sync"
```

**预期输出：**
```
INFO:app.main:auto-sync: starting position data sync
INFO:app.main:auto-sync: found 14 position symbols
...
INFO:app.main:auto-sync: completed - success: 14, failed: 0
```

**方法 2：运行诊断脚本**
```bash
cd /Volumes/SamSung/longbridge
./diagnose_strategy_watch.sh
```

**方法 3：检查策略盯盘**
- 访问 `http://localhost:5173`
- 点击"策略盯盘 🎯"
- 应该能看到所有持仓股票及其信号

---

### Q2: 自动同步需要多长时间？

**计算公式：**
```
同步时间 = 股票数量 × 0.5秒 + 网络延迟

示例：
- 14只股票 ≈ 7-10秒
- 30只股票 ≈ 15-20秒
```

**Tips**：
- 同步在后台进行，不影响其他功能使用
- 可以立即访问策略盯盘，数据会逐步加载

---

### Q3: 如果 ACCESS_TOKEN 无效会怎样？

**行为：**
```
INFO:app.main:auto-sync: starting position data sync
WARNING:app.main:auto-sync: failed to get positions: OpenApiException: token invalid
INFO:app.main:auto-sync: no symbols to sync
```

**结果：**
- 自动同步会静默失败（不会中断服务启动）
- 策略盯盘会显示提示信息
- 可以在"基础配置"更新 TOKEN 后手动同步

**解决方案：**
1. 更新 ACCESS_TOKEN
2. 重启后端服务（会自动重新同步）

---

### Q4: 已经有数据了，还会重复同步吗？

**是的，但这是设计行为！**

**原因：**
- 确保数据是最新的
- K线数据会随时间更新（新的交易日）
- 同步函数会自动去重（已存在的数据不会重复插入）

**优化建议（未来）：**
- 只同步最近N天的数据
- 检查数据库中的最新时间，增量同步

---

### Q5: 可以禁用自动同步吗？

**可以！**

修改 `backend/app/main.py`，注释掉以下代码：

```python
@app.on_event("startup")
async def on_startup() -> None:
    # ... 其他启动逻辑
    
    # Auto-sync position historical data
    # asyncio.create_task(_auto_sync_position_data())  # ← 注释这行
    # logger.info("startup: auto-sync task scheduled")  # ← 注释这行
```

**何时需要禁用：**
- 开发调试时，频繁重启服务
- 网络环境不稳定
- 想节省 API 调用次数

---

## 监控与调试

### 查看实时同步进度

```bash
# 方法 1：查看实时日志
tail -f /Volumes/SamSung/longbridge/logs/backend.log | grep -E "(auto-sync|Inserted)"

# 方法 2：统计已同步股票
curl -s http://localhost:8000/quotes/history?symbol=TSLL.US&limit=1 | grep -q "bars" && echo "✅ 已同步" || echo "❌ 未同步"
```

### 检查同步结果

```python
# 运行 Python 脚本检查数据库
cd /Volumes/SamSung/longbridge/backend
source venv/bin/activate
python -c "
from app.repositories import _repo_fetch_candlesticks
import json

symbols = ['TSLL.US', 'JD.US', 'AAPL.US']
for symbol in symbols:
    bars = _repo_fetch_candlesticks(symbol, 5)
    print(f'{symbol:12} {len(bars):3} 条数据')
"
```

---

## 技术细节

### 依赖的服务和函数

1. **`get_portfolio_overview()`**
   - 来源：`app/services.py`
   - 作用：获取持仓股票列表
   - 依赖：有效的 ACCESS_TOKEN

2. **`load_symbols()`**
   - 来源：`app/repositories.py`
   - 作用：读取手工配置的监控股票
   - 依赖：数据库中的 `symbols` 表

3. **`sync_history_candlesticks()`**
   - 来源：`app/services.py`
   - 作用：从 Longbridge API 获取K线数据并存入数据库
   - 依赖：有效的 ACCESS_TOKEN、网络连接

### 错误处理

```python
try:
    result = sync_history_candlesticks(
        symbols=[symbol],
        period="day",
        adjust_type="forward_adjust",
        count=100
    )
    synced = result.get('synced_count', 0)
    if synced > 0:
        logger.info(f"auto-sync: {symbol} synced {synced} bars")
        success_count += 1
except Exception as e:
    logger.error(f"auto-sync: {symbol} failed: {e}")
    fail_count += 1
    # 继续同步下一只股票，不中断整个流程
```

**设计原则：**
- **容错优先**：单只股票失败不影响其他股票
- **日志详细**：记录每一步操作和结果
- **静默失败**：不干扰用户体验

---

## 性能优化

### 当前实现

- ✅ 异步执行（不阻塞其他服务）
- ✅ 请求节流（0.5秒/股票）
- ✅ 错误容忍（失败继续）

### 未来优化方向

1. **增量同步**
   ```python
   # 检查最后同步时间
   last_sync = get_last_sync_time(symbol)
   if last_sync and (now - last_sync) < timedelta(hours=1):
       skip  # 1小时内已同步，跳过
   ```

2. **并发同步**
   ```python
   # 使用 asyncio.gather 同时同步多只股票
   tasks = [sync_one_symbol(s) for s in symbols]
   await asyncio.gather(*tasks, return_exceptions=True)
   ```

3. **智能限流**
   ```python
   # 根据 API 限制动态调整间隔
   if api_rate_limit_reached:
       await asyncio.sleep(retry_after)
   ```

---

## 对比传统方式

| 特性 | 传统手动同步 | 自动同步（新） |
|------|-------------|---------------|
| 触发方式 | 用户点击按钮 | 启动时自动 |
| 数据范围 | 需手动选择股票 | 自动识别持仓+监控 |
| 同步时机 | 随时 | 仅启动时 |
| 用户操作 | 4-5步 | 0步 |
| 失败提示 | 界面弹窗 | 日志记录 |
| 适用场景 | 按需更新 | 初始化/日常重启 |

---

## 总结

### ✅ 优势

1. **零操作**：用户启动服务即可，无需任何配置
2. **智能化**：自动识别持仓和监控股票
3. **可靠性**：容错机制确保部分失败不影响整体
4. **透明性**：详细日志可追溯每一步
5. **高效性**：异步执行，不阻塞其他功能

### 📊 实际效果

**测试数据：**
- 14只持仓股票
- 同步时间：约10秒
- 成功率：100%
- 数据量：1400条K线记录

**用户体验：**
1. 运行 `./start.sh`
2. 等待10-15秒
3. 打开浏览器访问策略盯盘
4. 立即看到所有股票的策略信号 ✅

---

**这就是"持仓的后台默认同步"功能！** 🎉





















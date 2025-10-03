# 文件结构速查表

## 📁 核心目录

| 目录 | 作用 | 重要性 |
|-----|------|--------|
| `backend/app/` | 后端应用核心代码 | ⭐⭐⭐⭐⭐ |
| `backend/app/routers/` | API 路由定义 | ⭐⭐⭐⭐⭐ |
| `frontend/src/` | 前端源代码 | ⭐⭐⭐⭐⭐ |
| `frontend/src/pages/` | 前端页面组件 | ⭐⭐⭐⭐ |
| `config/` | 配置文件（策略等） | ⭐⭐⭐⭐⭐ |
| `data/` | 数据库文件 | ⭐⭐⭐⭐⭐ |
| `logs/` | 日志文件 | ⭐⭐⭐ |
| `docs/` | 项目文档 | ⭐⭐⭐ |
| `.cursor/rules/` | Cursor IDE 规则 | ⭐⭐ |

---

## 📄 后端核心文件

### 应用入口与配置

| 文件 | 作用 | 何时修改 |
|-----|------|---------|
| `main.py` | FastAPI 应用入口、路由注册、启动/关闭事件 | 新增路由、修改中间件 |
| `config.py` | 配置管理（数据库路径、加密密钥） | 修改系统配置 |
| `db.py` | 数据库连接、表创建、迁移 | 新增表、修改表结构 |
| `models.py` | Pydantic 数据模型 | 新增 API 接口时定义请求/响应模型 |

### 业务逻辑层

| 文件 | 作用 | 何时修改 |
|-----|------|---------|
| `services.py` | 业务逻辑（K线同步、组合查询等） | 新增业务功能 |
| `repositories.py` | 数据访问层（CRUD 操作） | 新增数据表操作 |
| `exceptions.py` | 自定义异常定义 | 新增异常类型 |

### 核心引擎

| 文件 | 作用 | 何时修改 |
|-----|------|---------|
| `streaming.py` | 行情流管理（订阅、广播） | 修改行情订阅逻辑 |
| `strategy_engine.py` | 策略引擎（条件评估、交易执行） | 新增技术指标、修改交易逻辑 |
| `position_monitor.py` | 仓位监控（风险管理、止损止盈） | 修改监控逻辑、风险参数 |
| `trading_api.py` | Longbridge 交易 API 封装 | 修改交易接口 |
| `notification_manager.py` | 通知系统（WebSocket 推送） | 新增通知类型 |
| `optimal_trading_signals.py` | 最优信号分析 | 优化信号算法 |

### API 路由

| 文件 | 端点前缀 | 作用 |
|-----|---------|------|
| `routers/settings.py` | `/settings` | 凭据、符号列表配置 |
| `routers/quotes.py` | `/quotes` | 行情数据查询、同步 |
| `routers/portfolio.py` | `/portfolio` | 持仓、组合概览 |
| `routers/strategies.py` | `/strategies` | 策略管理与控制 |
| `routers/monitoring.py` | `/monitoring` | 仓位监控配置 |
| `routers/notifications.py` | `/notifications` | 通知查询与 WebSocket |
| `routers/signal_analysis.py` | `/signal-analysis` | 信号分析接口 |

---

## 📄 前端核心文件

### 应用入口

| 文件 | 作用 | 何时修改 |
|-----|------|---------|
| `main.tsx` | React 应用入口 | 很少修改 |
| `App.tsx` | 主应用组件、导航切换 | 新增页面时添加 Tab |
| `index.css` | 全局样式 | 修改全局样式 |

### API 层

| 文件 | 作用 | 何时修改 |
|-----|------|---------|
| `api/client.ts` | API 基础客户端、所有接口方法 | 新增 API 端点 |
| `api/quotes.ts` | 行情专用 API | 新增行情相关接口 |

### 页面组件

| 文件 | 路由 | 作用 |
|-----|-----|------|
| `pages/Settings.tsx` | `/` | 凭据、符号配置、历史同步 |
| `pages/RealtimeSimple.tsx` | - | 实时行情列表 |
| `pages/RealtimeKLine.tsx` | - | 实时 K 线图表 |
| `pages/History.tsx` | - | 历史 K 线查询 |
| `pages/StrategyControl.tsx` | - | 策略管理界面 |
| `pages/PositionMonitoring.tsx` | - | 仓位监控界面 |
| `pages/SignalAnalysis.tsx` | - | 信号分析展示 |

### 可复用组件

| 文件 | 作用 | 使用场景 |
|-----|------|---------|
| `components/KLineChart.tsx` | K 线图表组件 | 所有需要展示 K 线的页面 |
| `components/StatusSnackbar.tsx` | 状态提示组件 | 成功/错误提示 |
| `components/LoadingSpinner.tsx` | 加载动画 | 异步操作时显示 |

---

## 📄 配置文件

### 策略配置

| 文件 | 格式 | 作用 |
|-----|------|------|
| `config/strategies.json` | JSON | 策略定义、全局设置、通知配置 |

**重要字段**：
- `strategies[]` - 策略列表
  - `id` - 策略唯一标识
  - `enabled` - 是否启用
  - `symbols[]` - 监控股票
  - `conditions.buy/sell` - 买卖条件
  - `risk_management` - 风险参数
- `global_settings` - 全局限制
- `notification_settings` - 通知配置

### Python 配置

| 文件 | 作用 |
|-----|------|
| `backend/pyproject.toml` | Python 项目配置、依赖列表 |

**关键依赖**：
- `fastapi` - Web 框架
- `uvicorn` - ASGI 服务器
- `duckdb` - 数据库
- `longport` - Longbridge SDK
- `cryptography` - 加密库

### 前端配置

| 文件 | 作用 |
|-----|------|
| `frontend/package.json` | npm 依赖、脚本命令 |
| `frontend/vite.config.ts` | Vite 构建配置 |
| `frontend/tsconfig.json` | TypeScript 编译配置 |
| `frontend/tailwind.config.js` | Tailwind CSS 配置 |

---

## 📊 数据库表结构

### DuckDB 表一览

| 表名 | 主键 | 作用 |
|-----|------|------|
| `settings` | `key` | 配置信息（凭据加密存储） |
| `symbols` | `symbol` | 股票代码列表 |
| `ohlc` | `(symbol, ts)` | K 线历史数据 |
| `ticks` | `(symbol, ts)` | Tick 实时数据 |
| `positions` | `symbol` | 持仓快照 |
| `position_monitoring` | `symbol` | 仓位监控配置 |
| `global_monitoring_settings` | `id` (固定=1) | 全局监控设置 |

### 表字段速查

**settings** (凭据存储)
```
key TEXT PRIMARY KEY
value TEXT  -- Fernet 加密后的值
```

**symbols** (符号列表)
```
symbol TEXT PRIMARY KEY
enabled INTEGER DEFAULT 1
```

**ohlc** (K 线数据)
```
symbol TEXT
ts TIMESTAMP
open, high, low, close REAL
volume, turnover REAL
PRIMARY KEY (symbol, ts)
```

**ticks** (Tick 数据)
```
symbol TEXT
ts TIMESTAMP
sequence INTEGER
price, volume, turnover REAL
current_volume, current_turnover REAL
PRIMARY KEY (symbol, ts)
```

**position_monitoring** (仓位监控配置)
```
symbol TEXT PRIMARY KEY
monitoring_status TEXT  -- active/paused/excluded
strategy_mode TEXT  -- auto/alert_only/balanced/disabled
enabled_strategies TEXT  -- JSON 数组
max_position_ratio, stop_loss_ratio, take_profit_ratio REAL
cooldown_minutes INTEGER
notes TEXT
created_at, updated_at TEXT
```

---

## 📝 日志文件

| 文件 | 内容 | 查看命令 |
|-----|------|---------|
| `logs/backend.log` | 后端运行日志、交易记录、错误堆栈 | `tail -f logs/backend.log` |
| `logs/frontend.log` | 前端运行日志 | `tail -f logs/frontend.log` |

### 日志级别
- **DEBUG**: 调试信息（默认关闭）
- **INFO**: 正常运行信息
- **WARNING**: 警告（如高波动、风险限制触发）
- **ERROR**: 错误（如 API 调用失败）
- **CRITICAL**: 严重错误（如数据库连接丢失）

---

## 🔧 脚本文件

| 文件 | 作用 | 使用场景 |
|-----|------|---------|
| `start.sh` / `start.bat` | 启动后端和前端服务 | 开发/测试环境启动 |
| `stop.sh` / `stop.bat` | 停止所有服务 | 关闭系统 |
| `start_trading.py` | 启动交易引擎 | 独立运行策略引擎 |
| `scripts/update_llms.sh` | 更新 LLM 提示词文件 | 文档更新后运行 |

**其他工具脚本**：
- `backend/debug_sync.py` - 调试历史同步
- `backend/sync_candlesticks.py` - 批量同步 K 线
- `backend/test_*.py` - 各种测试脚本

---

## 📚 文档文件

| 文件 | 作用 |
|-----|------|
| `docs/ARCHITECTURE.md` | 架构详细文档（全面） |
| `docs/FILE_STRUCTURE.md` | 文件结构速查表（本文件） |
| `docs/DECISIONS.md` | 架构决策记录 (ADR) |
| `docs/README.md` | 文档说明 |
| `docs/rules.md` | 编码规范 |
| `docs/llms.txt` | LLM 提示词汇总 |
| `README.md` | 项目说明（根目录） |
| `本地量化系统（Longbridge_OpenAPI）分析与实施计划.md` | 系统分析与计划 |
| `自动买卖功能使用指南.md` | 自动交易使用指南 |

---

## 🎯 Cursor Rules

`.cursor/rules/` 目录下的所有 `.mdc` 文件：

| 规则文件 | 描述 |
|---------|------|
| `project-structure.mdc` | 项目整体结构指南 |
| `backend-fastapi.mdc` | 后端 FastAPI 结构与约定 |
| `db-duckdb.mdc` | DuckDB 与仓储层约定 |
| `frontend-react.mdc` | 前端 React/Vite 使用规范 |
| `settings-credentials.mdc` | 设置与凭据管理 |
| `quotes-history.mdc` | 行情与历史数据接口 |
| `streaming-ws.mdc` | 行情流与 WebSocket 规范 |
| `portfolio-monitoring.mdc` | 资产组合与监控 |
| `notifications.mdc` | 通知系统规范 |
| `strategy-engine.mdc` | 策略引擎与自动交易 |
| `trading-api.mdc` | Longbridge 交易 API 集成 |
| `position-monitor.mdc` | 仓位监控系统 |
| `error-handling.mdc` | 异常处理与错误规范 |
| `repositories.mdc` | 数据持久化层规范 |

---

## 🚀 快速定位

### 我想...

**修改交易策略**
→ 编辑 `config/strategies.json`
→ 或修改 `backend/app/strategy_engine.py`

**新增技术指标**
→ 修改 `backend/app/strategy_engine.py` 的 `TechnicalIndicators` 类

**调整风险参数**
→ 修改 `config/strategies.json` 中的 `risk_management`
→ 或修改 `backend/app/position_monitor.py` 的风险检查逻辑

**新增 API 端点**
→ 在 `backend/app/routers/` 创建或修改路由文件
→ 在 `backend/app/main.py` 注册路由（如果是新文件）

**新增前端页面**
→ 在 `frontend/src/pages/` 创建页面组件
→ 在 `frontend/src/App.tsx` 添加导航 Tab
→ 在 `frontend/src/api/client.ts` 添加 API 方法（如需要）

**查看交易日志**
→ 查看 `logs/backend.log`
→ 搜索关键词：`order_placed`, `order_filled`, `ERROR`

**调试行情订阅**
→ 检查 `backend/app/streaming.py`
→ 查看日志中的 `QuoteStreamManager` 相关信息

**修改数据库结构**
→ 修改 `backend/app/db.py` 的 `_run_migrations()`
→ 或使用 `_ensure_column()` 动态添加列

---

## 📋 常用命令

### 启动服务
```bash
# Linux/Mac
./start.sh

# Windows
start.bat
```

### 停止服务
```bash
# Linux/Mac
./stop.sh

# Windows
stop.bat
```

### 查看日志
```bash
# 实时查看后端日志
tail -f logs/backend.log

# 搜索错误
grep "ERROR" logs/backend.log
```

### 数据库操作
```bash
# 进入 DuckDB CLI
duckdb data/quant.db

# 查看表
SHOW TABLES;

# 查询数据
SELECT * FROM symbols;
SELECT * FROM ohlc WHERE symbol='AAPL.US' ORDER BY ts DESC LIMIT 10;
```

### 依赖管理
```bash
# 安装后端依赖
cd backend
pip install -e .

# 安装前端依赖
cd frontend
npm install
```

---

## 🔍 文件搜索技巧

### 查找特定功能的代码

**查找策略评估逻辑**
→ `backend/app/strategy_engine.py` → `evaluate_strategy()`

**查找交易下单逻辑**
→ `backend/app/trading_api.py` → `place_order()`

**查找 K 线数据存储**
→ `backend/app/repositories.py` → `store_candlesticks()`

**查找 WebSocket 推送**
→ `backend/app/streaming.py` → `_broadcast()`
→ `backend/app/notification_manager.py` → `send_notification()`

**查找前端 API 调用**
→ `frontend/src/api/client.ts`

**查找页面路由**
→ `frontend/src/App.tsx`

---

## ⚠️ 重要提示

### 不要修改的文件
- `backend/data/quant.db` - 直接编辑可能损坏数据库
- `frontend/dist/` - 构建产物，会被覆盖
- `backend/app/__pycache__/` - Python 缓存，自动生成

### 谨慎修改的文件
- `backend/app/db.py` - 数据库迁移逻辑，错误可能导致数据丢失
- `backend/app/main.py` - 应用入口，影响整个系统启动
- `config/strategies.json` - 策略配置，错误可能导致交易异常

### 必须备份的文件
- `data/quant.db` - 所有历史数据
- `config/strategies.json` - 策略配置
- `backend/app/repositories.py` 中的加密密钥配置

---

**版本**: 1.0  
**最后更新**: 2024-10-03


# 项目规则与方案记录

## 基本约定
- 所有回复默认使用中文。
- 开发 Longbridge OpenAPI 相关功能前，必须先阅读并确认对应文档要求。
- 凭据 `LONGPORT_APP_KEY`、`LONGPORT_APP_SECRET`、`LONGPORT_ACCESS_TOKEN` 仅保存在本地，不上传至版本控制。

## 量化系统最小化实现方案

### 目标
搭建单机可运行的最小可用量化系统，涵盖凭据配置、行情订阅、K 线与指标展示、策略信号生成及下单建议，依赖 Longbridge OpenAPI 与本地 DuckDB。

### 技术栈
- 后端：Python（FastAPI + Longbridge SDK + asyncio）
- 前端：React + Vite + ECharts
- 存储：DuckDB（本地文件），Redis 可选（若需缓存/队列，可先用内存队列）
- 实时通道：WebSocket（后端推送行情与信号）

### 后端模块
1. **配置与凭据管理**
   - REST 接口：保存/读取 Longbridge 凭据与股票列表
   - DuckDB 表：`settings(key TEXT PRIMARY KEY, value TEXT)`
   - 敏感字段加密存储；保存后验证 QuoteContext 连接
2. **行情采集 Data Ingest**
   - 订阅实时行情推送，写入内存队列
   - 定时调用历史接口补足 K 线数据，落库 `ohlc`
   - 遵守频控：Quote API ≤10 次/秒，≤5 并发
3. **策略引擎**
   - 消费行情队列生成实时 K 线与指标
   - 策略插件化（`on_tick`/`on_bar`），默认均线交叉策略
   - 输出买卖点信号入库 `signals` 并通过 WebSocket 推送
4. **交易服务**
   - 接收信号执行下单/撤单；调用 Longbridge Trade API
   - 下单前校验资金、持仓（`Get Account Balance`、`Get Stock Positions`）
   - 记录订单表 `orders`，轮询 `Today Orders` 同步状态
5. **WebSocket 推送**
   - 聚合行情、信号、订单动态推送至前端
   - 维护心跳、断线重连

### 前端模块
1. **设置页**
   - 表单录入凭据与股票代码（支持多只）
   - 测试连接按钮调用后端校验接口
2. **实时行情页**
   - ECharts 绘制 K 线/指标，多股票切换
   - 展示最新价、涨跌幅、成交量等
   - 策略信号列表实时更新
3. **订单页**
   - 展示订单历史与当前持仓
   - 可选手动下单入口
4. **全局通知**
   - 显示策略触发、下单结果、连接状态

### DuckDB 表结构建议
- `settings(key TEXT PRIMARY KEY, value TEXT)`
- `symbols(symbol TEXT PRIMARY KEY, enabled INTEGER)`
- `ohlc(symbol TEXT, ts TIMESTAMP, open REAL, high REAL, low REAL, close REAL, volume REAL)`
- `ticks(symbol TEXT, ts TIMESTAMP, price REAL, volume REAL)`
- `signals(id TEXT PRIMARY KEY, symbol TEXT, ts TIMESTAMP, action TEXT, price REAL, reason TEXT, status TEXT)`
- `orders(order_id TEXT PRIMARY KEY, symbol TEXT, side TEXT, qty REAL, price REAL, status TEXT, ts_created TIMESTAMP, ts_updated TIMESTAMP)`
- `positions(symbol TEXT PRIMARY KEY, qty REAL, avg_price REAL, last_updated TIMESTAMP)`

### 开发阶段
1. 初始化项目结构、DuckDB DAO、配置接口、前端设置页。
2. 打通行情订阅与历史拉取，构建 WebSocket 推送，前端 K 线实时展示。
3. 实现基础策略引擎与信号展示。
4. 打通订单执行流程（可先模拟再接真实 API）。
5. 完善风控、日志、备份导出与运维细节。

### 其他约定
- 配置加载遵循：环境变量优先，数据库其次。
- 提供 CLI 辅助脚本用于历史数据导入/备份。
- 持续维护 `docs/llms.txt`，遇到 API 调用前先查阅官方文档链接。

## 当前进度（2025-09-20）
- 后端已完成凭据/股票配置接口，DuckDB 表初始化，历史 K 线同步与缓存查询，以及行情订阅线程（`QuoteStreamManager`）+ WebSocket `/ws/quotes` 推送。
- 实时推送会写入 `ticks` 表，并提供 `/quotes/ticks` 与 `/quotes/stream/status` REST 查询入口。
- 新增持仓配置与盈亏计算：`/portfolio/positions`、`/portfolio/overview` 接口支持本地持仓维护、最新行情估值与 PnL 统计，前端实时根据推送动态刷新。
- 持仓信息现直接对接 Longbridge Trade API `stock_positions`，后台自动解析渠道 `channels.positions` 并按照多/空方向计算成本、市值、盈亏。
- 前端实时页面改为表格呈现持仓清单，展示方向、市场、可用数量、盈亏等核心字段。
- 前端实现“基础配置”和“实时行情”两个 Tab：可录入凭据、股票列表、维护持仓，下发历史同步请求，并通过 WebSocket 实时查看行情快照、盈亏卡片、日志与 Tick 查询工具。
- 项目结构已稳定：`backend/`（FastAPI 服务）+ `frontend/`（React 管理界面）+ `docs/` 规则/规范，界面采用 Material UI 现代化布局。
- 近期修复：`QuoteStreamManager.ensure_started` 与 `request_restart` 调整为在释放锁后更新状态，避免启动阶段因重复加锁造成死锁；`main.py` 增加日志输出与基础日志配置，方便调试启动流程。

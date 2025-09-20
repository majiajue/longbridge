# Longbridge Quant Console

A local-first toolkit for exploring the [Longbridge OpenAPI](https://open.longbridge.com/) and monitoring a live trading account. The project contains:

- **FastAPI 后端**：统一封装长桥 SDK，负责凭据管理、历史数据同步、行情推送、实时持仓与盈亏计算。
- **React 前端**：提供基础配置页与实时监控台，展示行情摘要、持仓列表、调试日志等信息。
- **DuckDB 本地缓存**：存储凭据、订阅股票、历史 OHLC、实时 tick，方便离线分析。

本仓库保持轻量，适合作为二次开发或自定义量化控制台的骨架。下文详细介绍架构组成以及使用方式，后续优化也会同步在此文档维护。

---

## Architecture Overview

```
┌─────────────┐      REST / WS      ┌──────────────┐
│ React (Vite)│  <----------------> │ FastAPI      │
│  frontend   │                     │  backend     │
└─────┬───────┘                     └─────┬────────┘
      │          DuckDB (local cache)      │
      │                                     │
      ▼                                     ▼
┌───────────────┐        SDK calls       ┌──────────────┐
│ WebSocket     │  <-------------------- │ Longbridge   │
│ monitoring    │        (Quote/Trade)   │ OpenAPI      │
└───────────────┘                        └──────────────┘
```

### Backend 架构（FastAPI + Longbridge SDK + DuckDB）

| 目录 | 说明 |
| ---- | ---- |
| `app/main.py` | FastAPI 入口。注册 REST & WebSocket 路由，在启动事件中拉起 `QuoteStreamManager` 背景线程订阅行情。|
| `app/streaming.py` | `QuoteStreamManager` 封装长桥行情订阅，负责：<br/>① 根据 DuckDB 中配置的股票自动订阅；<br/>② 接收推送后写入 `ticks` 表并广播给 WebSocket 客户端；<br/>③ 维护心跳、重新订阅、状态快照。|
| `app/services.py` | 业务逻辑层。<br/>- `verify_quote_access`、`sync_history_candlesticks` 等函数调用 SDK 的行情接口。<br/>- `get_positions` 通过 `TradeContext.stock_positions()` 获取真实持仓，识别多/空方向、整理成本、市值、盈亏，并结合本地行情快照计算实时 PnL。|
| `app/repositories.py` | DuckDB 访问层：负责建表、加密后的凭据存储、历史 OHLC、实时 tick 读写等。|
| `app/routers/` | API 路由：`settings` 管理凭据+股票、`quotes` 提供历史/实时接口、`portfolio` 返回持仓及汇总指标。|

**后台如何工作：**
1. 用户在设置页保存 `LONGPORT_APP_KEY/SECRET/ACCESS_TOKEN` 与股票列表，数据加密后落入 DuckDB。
2. 后端启动时，`QuoteStreamManager` 使用凭据和股票列表自动订阅行情，推送结果写入 `ticks` 表并通过 WebSocket 推给前端。
3. 请求 `/portfolio/overview` 时，后端实时调用长桥 Trade API，解析返回的 `channels.positions`，计算多/空方向的成本、市值、盈亏，并额外查询本地 tick 数据以获取最新价格。

### Frontend 架构（React + Material UI）

| 目录 | 说明 |
| ---- | ---- |
| `src/pages/Settings.tsx` | 基础配置页：录入凭据、配置订阅股票、触发历史数据同步。保存成功后会调用后端 `/settings/*` 接口。|
| `src/pages/Realtime.tsx` | 实时监控台：<br/>- KPI 卡片显示成本、市值、总盈亏；<br/>- 表格展示实时持仓（多/空方向、数量、均价、市值、盈亏）；<br/>- WebSocket 调试面板；<br/>- Tick 查询工具。|
| `src/api/client.ts` | 前端 API 访问封装，默认请求 `http://localhost:8000`，也可以通过 `VITE_API_BASE` 指定后端地址。|

前端开启后会自动连接 `ws://localhost:8000/ws/quotes`，接收推送后实时刷新持仓和行情信息。

---

## Getting Started

### 1. Clone & install prerequisites

```bash
# clone the repo
git clone https://github.com/<your-org>/longbridge-quant-console.git
cd longbridge-quant-console

# backend virtualenv (Python 3.9+ recommended)
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install --upgrade pip setuptools wheel
# install backend deps (include longport SDK)
pip install fastapi uvicorn[standard] duckdb cryptography pydantic-settings python-dotenv longport
```

Longbridge OpenAPI SDK (`longport`) is published on PyPI. If you are in a restricted network, configure a proxy or install from a local wheel.

### 2. Configure environment variables

Create `backend/.env` (or export vars in your shell) with your Longbridge credentials:

```
LONGPORT_APP_KEY=your-app-key
LONGPORT_APP_SECRET=your-app-secret
LONGPORT_ACCESS_TOKEN=your-access-token
# Optional: specify region for mainland China accounts
# LONGPORT_REGION=cn
```

> ⚠️ 这些凭据能够直接对账户下单，请妥善保管，不要提交到版本库。

### 3. Start the backend

```bash
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level debug
```

The server exposes:
- REST endpoints under `http://localhost:8000` (health, settings, portfolio, historical quotes, etc.).
- WebSocket streaming at `ws://localhost:8000/ws/quotes` for real-time quotes.

DuckDB data files are created in `backend/data/`.

### 4. Start the frontend

```bash
cd frontend
npm install
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

Open the Vite dev server (default `http://localhost:5173`) and you should see:
1. **基础配置**页面：管理凭据和订阅的股票代码，触发历史数据同步。
2. **实时行情**页面：查看实时行情摘要、持仓表格、调试日志、tick 查询等。

---

## Key Usage Notes

- **持仓估值**：后台直接调用 `TradeContext.stock_positions()`；`cost_price` 为正代表多头持仓，为负时会被视为空头，盈亏公式会自动调整方向。
- **实时行情**：WebSocket 推送中如果 `timestamp` 是 `datetime`，会转换为 UTC，再写入 DuckDB 并推送给前端。
- **历史数据**：`/quotes/history/sync` 使用分页接口写入 DuckDB 的 `ohlc` 表，可用于回测或技术指标计算。
- **安全**：凭据使用 Fernet 加密后存放在 DuckDB 的 `settings` 表，密钥生成在 `backend/data/encryption.key`。

---

## Repository Layout

```
backend/
  app/
    main.py             # FastAPI entrypoint
    services.py         # Business logic & SDK bridges
    streaming.py        # QuoteStreamManager for WebSocket push
    repositories.py     # DuckDB access helpers
    routers/            # API route modules
  data/                 # DuckDB files, Fernet key (gitignored)
  scripts/
    inspect_positions.py# Debug script to inspect SDK response
frontend/
  src/
    api/client.ts       # REST/WebSocket client wrappers
    pages/Settings.tsx  # Configuration UI
    pages/Realtime.tsx  # Monitoring console
  vite.config.ts        # Frontend build config
```

Documentation helpers:
- `docs/llms.txt` — Longbridge LLMs Text
- `docs/rules.md` — 设计与排查记录（持续更新）
- `scripts/update_llms.sh` — 一键刷新 `llms.txt`

---

## 常见操作流程

1. **首次部署**：完成 “Getting Started” 四个步骤。
2. **更新凭据/订阅股票**：在前端 “基础配置” 页面保存即可，后端会自动重启行情订阅。
3. **刷新持仓**：实时页面点击 “刷新持仓” 按钮，即刻从长桥获取最新仓位。
4. **调试行情推送**：实时日志与 tick 查询面板可以确认推送是否正常写入 DuckDB 并广播。
5. **核对盈亏**：后台按 `cost_price` 正负判断多/空方向；如需进一步排查可运行 `backend/scripts/inspect_positions.py` 打印原始返回。

---

## Development Workflow

1. **Backend**
   - Keep the virtualenv activated while developing (`source backend/.venv/bin/activate`).
   - Use `python -m uvicorn app.main:app --reload` for auto-reload during development.
   - DuckDB is ACID-compliant; if you need a fresh start, delete `backend/data/quant.db`.
   - When updating service logic, log with `logging.getLogger(__name__)` for easier debugging.

2. **Frontend**
   - All API requests read `import.meta.env.VITE_API_BASE`; set it in `.env.local` for convenience.
   - The realtime page is React StrictMode friendly; when adding state, mind double invocation of side-effects.
   - Use Material UI components consistently; theme overrides live in `App.tsx`.

3. **Testing**
   - Currently the project relies on manual verification (curl + UI). We plan to add pytest suites (backend) and vitest (frontend) in future iterations.
   - For SDK-related issues (e.g., cost definition), consult the Longbridge docs in `docs/llms.txt` and verify with the provided `scripts/inspect_positions.py`.

4. **Git 提交流程**
   ```bash
   git status
   git add <files>
   git commit -m "feat: ..."
   git push origin main
   ```
   根据实际远程仓库/分支调整命令。

---

## Roadmap

- [ ] Expand automated tests (pytest/vitest) for critical endpoints.
- [ ] Add historical PnL charts and factor analytics.
- [ ] Provide Docker Compose setup for one-click orchestration.
- [ ] Introduce strategy backtesting examples and risk management rules.
- [ ] Localisation of the UI（中英文切换）.

Contributions are welcome! Please open an issue describing your use case or improvement idea before raising a PR so we can discuss the best integration plan.

---

## License

This repository is provided “as is” for personal research and exploration. Before putting it into production, review Longbridge’s API terms, test thoroughly, and make sure your deployment complies with all regulatory requirements.

# Longbridge 本地量化交易系统 - 项目概览文档

## 一、系统概述

这是一个基于 **Longbridge OpenAPI** 构建的**本地智能量化交易系统**，支持港股、美股、A股的实时行情、自动交易策略和AI驱动的交易决策。

### 核心能力
- 实时行情订阅与展示（WebSocket）
- 历史K线数据同步与查询
- 多因子信号分析引擎（11个因子）
- 5种预设自动交易策略
- AI驱动的智能交易引擎（DeepSeek）
- 仓位实时监控与风险管理
- 智能选股器

### 技术栈
| 层级 | 技术选型 |
|------|----------|
| 后端 | Python 3.9+ / FastAPI / asyncio |
| 前端 | React 18 / TypeScript / Vite / MUI |
| 数据库 | DuckDB（嵌入式） |
| 实时通信 | WebSocket |
| 交易API | Longbridge OpenAPI SDK |
| AI引擎 | DeepSeek API |
| 加密 | Fernet 对称加密 |

---

## 二、项目结构

```
longbridge/
├── backend/                      # 后端代码
│   ├── app/                      # FastAPI 应用
│   │   ├── routers/              # API 路由（15个模块）
│   │   ├── strategies/           # 策略定义
│   │   ├── main.py               # 应用入口
│   │   ├── ai_analyzer.py        # AI分析器（DeepSeek集成）
│   │   ├── ai_trading_engine.py  # AI交易引擎
│   │   ├── strategy_engine.py    # 传统策略引擎
│   │   ├── streaming.py          # 行情流管理
│   │   ├── position_monitor.py   # 仓位监控
│   │   ├── trading_api.py        # 交易API封装
│   │   ├── stock_picker.py       # 智能选股器
│   │   ├── services.py           # 业务逻辑层
│   │   ├── repositories.py       # 数据访问层
│   │   └── ...
│   └── data/                     # 运行时数据
│       └── quant.db              # DuckDB 数据库
│
├── frontend/                     # 前端代码
│   └── src/
│       ├── pages/                # 17个页面组件
│       ├── components/           # 可复用组件
│       ├── api/                  # API 客户端
│       └── App.tsx               # 主应用
│
├── config/                       # 配置文件
│   └── strategies.json           # 策略配置
│
├── docs/                         # 文档目录
│   ├── llms.txt                  # Longbridge API 文档
│   ├── ARCHITECTURE.md           # 架构文档
│   └── ...
│
├── logs/                         # 日志
├── scripts/                      # 脚本工具
├── start.sh / start.bat          # 启动脚本
└── stop.sh / stop.bat            # 停止脚本
```

---

## 三、后端核心模块详解

### 3.1 核心引擎层

| 模块 | 文件 | 职责 |
|------|------|------|
| **行情流管理** | `streaming.py` | 管理Longbridge行情订阅、WebSocket广播、派发数据到策略引擎 |
| **策略引擎** | `strategy_engine.py` | 加载策略配置、计算技术指标、评估买卖条件、执行交易 |
| **AI交易引擎** | `ai_trading_engine.py` | DeepSeek AI驱动的智能交易决策 |
| **AI分析器** | `ai_analyzer.py` | 调用DeepSeek API进行市场分析 |
| **仓位监控** | `position_monitor.py` | 实时监控持仓、风险管理、止损止盈 |
| **交易API** | `trading_api.py` | 封装Longbridge TradeContext，下单/撤单/查询 |
| **通知管理** | `notification_manager.py` | WebSocket推送通知 |
| **智能选股** | `stock_picker.py` | AI驱动的选股分析 |

### 3.2 API路由层（/backend/app/routers/）

| 路由 | 端点前缀 | 功能 |
|------|----------|------|
| `settings.py` | `/settings` | 凭据配置、符号列表管理 |
| `quotes.py` | `/quotes` | 行情查询、历史数据同步 |
| `portfolio.py` | `/portfolio` | 持仓、账户余额查询 |
| `strategies.py` | `/strategies` | 传统策略管理 |
| `strategies_advanced.py` | `/strategies-advanced` | 高级策略功能 |
| `monitoring.py` | `/monitoring` | 仓位监控配置 |
| `notifications.py` | `/notifications` | 通知查询 |
| `signal_analysis.py` | `/signal-analysis` | 信号分析 |
| `position_manager.py` | `/position-manager` | 仓位管理 |
| `ai_trading.py` | `/ai-trading` | AI交易控制 |
| `stock_picker.py` | `/stock-picker` | 智能选股 |
| `ai_config.py` | `/ai-config` | AI配置管理 |

### 3.3 数据层

| 模块 | 功能 |
|------|------|
| `db.py` | DuckDB连接管理、表创建、迁移 |
| `repositories.py` | 数据CRUD操作、凭据加密存储 |
| `models.py` | Pydantic数据模型定义 |

### 3.4 数据库表结构

| 表名 | 主键 | 作用 |
|------|------|------|
| `settings` | `key` | 配置信息（凭据加密存储） |
| `symbols` | `symbol` | 股票代码列表 |
| `ohlc` | `(symbol, ts)` | K线历史数据 |
| `ticks` | `(symbol, ts)` | Tick实时数据 |
| `positions` | `symbol` | 持仓快照 |
| `position_monitoring` | `symbol` | 仓位监控配置 |
| `ai_analysis_log` | `id` | AI分析日志 |
| `ai_trades` | `id` | AI交易记录 |
| `ai_positions` | `symbol` | AI持仓 |

---

## 四、前端页面结构

| 页面组件 | 功能描述 |
|----------|----------|
| `Settings.tsx` | 凭据配置、符号列表、AI配置 |
| `Realtime.tsx` | 实时行情监控 |
| `RealtimeKLine.tsx` | 实时K线图表 |
| `History.tsx` | 历史数据查询 |
| `StrategyControl.tsx` | 策略管理界面 |
| `StrategyWatch.tsx` | 策略盯盘 |
| `PositionMonitoring.tsx` | 仓位监控 |
| `PositionKLines.tsx` | 持仓K线分析 |
| `SmartPosition.tsx` | 智能仓位管理 |
| `SignalAnalysis.tsx` | 信号分析展示 |
| `AiTrading.tsx` | AI交易控制台 |
| `StockPicker.tsx` | 智能选股器 |

---

## 五、交易策略系统

### 5.1 预设策略（5种）

| 策略ID | 名称 | 原理 |
|--------|------|------|
| `ma_crossover` | 均线交叉 | 短期均线上穿长期均线买入，下穿卖出 |
| `rsi_oversold` | RSI超卖 | RSI低于30买入，高于70卖出 |
| `breakout` | 突破 | 价格突破关键阻力位买入 |
| `bollinger_bands` | 布林带 | 价格触及下轨买入，触及上轨卖出 |
| `macd_divergence` | MACD背离 | MACD金叉买入，死叉卖出 |

### 5.2 信号分析引擎（11因子）

**买入因子（6个）**：
1. 趋势一致性
2. 动量
3. 均值回归
4. 成交量确认
5. 支撑/阻力
6. 市场情绪

**卖出因子（5个）**：
1. 止盈
2. 趋势反转
3. 动量背离
4. 阻力拒绝
5. 风险管理

### 5.3 AI交易引擎

- **模型**：DeepSeek API
- **功能**：分析K线、指标，生成买卖建议
- **输出**：动作(BUY/SELL/HOLD)、置信度、入场价格区间、止损止盈价格

---

## 六、Longbridge OpenAPI 集成

### 6.1 API文档位置
`docs/llms.txt` - 包含完整的Longbridge OpenAPI文档索引

### 6.2 主要API功能

| 类别 | 功能 |
|------|------|
| **交易API** | 下单、撤单、查询订单、执行记录 |
| **行情API** | 实时行情、历史K线、深度数据 |
| **资产API** | 账户余额、持仓查询、资金流水 |
| **订阅API** | WebSocket实时订阅/取消订阅 |

### 6.3 频率限制

| API类型 | 限制 |
|---------|------|
| 行情API | ≤10次/秒，≤5并发，≤500订阅 |
| 交易API | ≤30次/30秒，间隔≥0.02秒 |

### 6.4 SDK封装

项目中的封装文件：
- `trading_api.py` - 交易接口封装
- `services.py` - 行情接口封装（`_quote_context`, `_trade_context`）
- `streaming.py` - WebSocket订阅封装

---

## 七、数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Longbridge OpenAPI                       │
│           (QuoteContext / TradeContext)                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    streaming.py                              │
│              (QuoteStreamManager)                            │
│  - 管理行情订阅                                               │
│  - 归一化数据                                                 │
│  - 多路派发                                                   │
└─────────────────────────────────────────────────────────────┘
          ↓                    ↓                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ WebSocket    │    │ StrategyEngine│    │PositionMonitor│
│ 广播到前端    │    │ 策略评估      │    │ 风险监控      │
└──────────────┘    └──────────────┘    └──────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    trading_api.py                            │
│              (LongbridgeTradingAPI)                          │
│  - 下单/撤单                                                  │
│  - 订单查询                                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     DuckDB                                   │
│  - 持久化K线、Tick数据                                        │
│  - 存储交易记录                                               │
│  - 加密存储凭据                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、关键配置文件

### 8.1 策略配置 (`config/strategies.json`)

```json
{
  "strategies": [
    {
      "id": "ma_crossover",
      "name": "均线交叉策略",
      "enabled": true,
      "symbols": ["AAPL.US"],
      "conditions": {
        "buy": [...],
        "sell": [...]
      },
      "risk_management": {
        "stop_loss_pct": 0.05,
        "take_profit_pct": 0.1,
        "max_position_pct": 0.2
      }
    }
  ],
  "global_settings": {
    "max_daily_trades": 10,
    "max_total_position": 0.8
  }
}
```

### 8.2 环境变量

```bash
# Longbridge API 凭据（必需）
LONGPORT_APP_KEY=your-app-key
LONGPORT_APP_SECRET=your-app-secret
LONGPORT_ACCESS_TOKEN=your-access-token

# DeepSeek AI（可选）
DEEPSEEK_API_KEY=your-deepseek-key
```

---

## 九、启动与运行

### 启动命令
```bash
# Linux/Mac
./start.sh

# Windows
start.bat
```

### 服务端口
- 后端API: `http://localhost:8000`
- 前端页面: `http://localhost:5173`
- WebSocket行情: `ws://localhost:8000/ws/quotes`
- WebSocket AI交易: `ws://localhost:8000/ws/ai-trading`

### 健康检查
```bash
curl http://localhost:8000/health
```

---

## 十、常见Bug定位指南

### 10.1 交易执行失败
检查文件：
- `backend/app/trading_api.py` - 下单逻辑
- `backend/app/strategy_engine.py` - 策略触发
- `logs/backend.log` - 错误日志

### 10.2 行情订阅失败
检查文件：
- `backend/app/streaming.py` - 订阅管理
- `backend/app/repositories.py` - 凭据读取
- 确认API凭据有效性

### 10.3 AI分析失败
检查文件：
- `backend/app/ai_analyzer.py` - DeepSeek调用
- `backend/app/ai_trading_engine.py` - AI引擎
- 确认DeepSeek API Key有效

### 10.4 前端API调用失败
检查文件：
- `frontend/src/api/client.ts` - API客户端
- 检查CORS配置
- 确认后端服务运行

### 10.5 数据库问题
检查文件：
- `backend/app/db.py` - 数据库连接
- `backend/app/repositories.py` - CRUD操作
- `backend/data/quant.db` - 数据库文件

---

## 十一、API速查

### 常用端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/settings/credentials` | GET/PUT | 凭据管理 |
| `/settings/symbols` | GET/PUT | 股票列表 |
| `/quotes/history/sync` | POST | 同步历史数据 |
| `/quotes/history` | GET | 查询历史K线 |
| `/portfolio/positions` | GET | 获取持仓 |
| `/strategies/` | GET | 获取所有策略 |
| `/ai-trading/start` | POST | 启动AI交易 |
| `/ai-trading/stop` | POST | 停止AI交易 |
| `/stock-picker/analyze` | POST | 执行选股分析 |

---

## 十二、维护建议

1. **定期备份**：`data/quant.db` 和 `config/strategies.json`
2. **日志清理**：定期清理 `logs/` 目录
3. **凭据更新**：Longbridge Access Token 有效期有限，需定期刷新
4. **依赖更新**：定期更新Python/npm依赖

---

**文档版本**: 1.0  
**生成日期**: 2025-12-01  
**适用项目版本**: main branch (commit 5a65912)

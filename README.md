# Longbridge Quant Console

A comprehensive automated trading system with intelligent signal analysis for the [Longbridge OpenAPI](https://open.longbridge.com/). The project provides:

- **智能信号分析**：基于多因子模型的最佳买卖点识别系统，支持趋势分析、动量指标、均值回归等 11 个分析因子。
- **自动交易引擎**：集成 5 种预配置策略（均线交叉、RSI超卖、突破、布林带、MACD背离），支持实时信号触发和自动下单。
- **实时监控系统**：持仓监控、风险管理、策略执行状态监控，支持动态止损止盈和仓位管理。
- **FastAPI 后端**：统一封装长桥 SDK，负责凭据管理、历史数据同步、行情推送、交易执行和智能信号分析。
- **React 前端**：现代化的交易界面，包含 7 个功能模块：配置管理、实时行情、K线图表、策略控制、信号分析、持仓监控。
- **DuckDB 本地存储**：高性能本地数据库，存储历史行情、交易信号、策略配置和系统状态。

本项目是一个完整的量化交易解决方案，适合个人投资者和小型投资团队使用。

---

## 🎯 核心功能特性

### 🧠 智能信号分析系统
- **多因子分析模型**：集成 6 个买入因子和 5 个卖出因子
  - 买入因子：趋势一致性、动量指标、均值回归、成交量确认、支撑阻力、市场情绪
  - 卖出因子：获利了结、趋势反转、动量背离、阻力拒绝、风险管理
- **智能置信度评分**：0-1 置信度评分系统，支持 5 级信号强度分类
- **市场概览分析**：实时市场情绪分析、信号统计和牛熊比例计算

### 🤖 自动交易引擎
- **5 种预配置策略**：
  - 均线交叉策略（MA Crossover）- 已启用
  - RSI超卖反弹策略 - 可配置
  - 突破策略 - 可配置
  - 布林带策略 - 可配置
  - MACD背离策略 - 可配置
- **实时信号执行**：支持策略信号触发后自动下单
- **风险管理系统**：动态止损止盈、仓位控制、最大持仓限制

### 📊 实时监控系统
- **持仓实时监控**：13+ 个实际持仓的实时 PnL 计算和风险监控
- **策略执行监控**：策略状态、信号触发、订单执行全流程监控
- **通知系统**：支持 WebSocket 和日志双通道事件通知

---

## Architecture Overview

```
┌─────────────┐    REST/WS/Signal     ┌──────────────┐
│ React UI    │  <----------------->  │ FastAPI      │
│ 7 Pages     │    Analysis API       │ Backend      │
└─────────────┘                       └──────┬───────┘
                                              │
┌─────────────┐    DuckDB Storage             │    ┌──────────────┐
│ Signal      │  <-------------------->  ┌────▼────┴─┐ Longbridge │
│ Analysis    │    Historical Data       │ Strategy  │ OpenAPI    │
│ Engine      │                          │ Engine    │ (Live)     │
└─────────────┘                          └───────────┘ Trading    │
                                                       └───────────┘
┌─────────────┐    Real-time Monitoring        ▲
│ Position    │  <----------------------------- │
│ Monitor     │    Risk Management             │
└─────────────┘                                │
                                              │
┌─────────────┐    Order Execution            │
│ Trading API │  <-----------------------------┘
│ Integration │    Buy/Sell Signals
└─────────────┘
```

### 后端架构（FastAPI + Longbridge SDK + DuckDB + AI Signals）

| 模块 | 文件 | 功能说明 |
|------|------|----------|
| **核心应用** | `app/main.py` | FastAPI 入口，注册所有路由和中间件，启动实时数据流和监控系统 |
| **智能信号** | `app/optimal_trading_signals.py` | 多因子信号分析引擎，提供最佳买卖点识别 |
| **策略引擎** | `app/strategy_engine.py` | 策略执行引擎，集成传统指标策略和智能信号分析 |
| **交易接口** | `app/trading_api.py` | Longbridge 交易 API 封装，支持下单、撤单、查询订单状态 |
| **持仓监控** | `app/position_monitor.py` | 实时持仓监控和风险管理系统 |
| **实时数据** | `app/streaming.py` | WebSocket 行情推送和数据广播系统 |
| **通知系统** | `app/notification_manager.py` | 事件通知管理，支持多种通知类型和渠道 |
| **业务逻辑** | `app/services.py` | 核心业务逻辑，持仓计算、行情处理等 |
| **数据访问** | `app/repositories.py` | DuckDB 数据访问层，加密存储和数据管理 |
| **API 路由** | `app/routers/` | 分模块的 API 路由：设置、行情、持仓、策略、监控、信号分析 |

### 前端架构（React + TypeScript + Material UI）

| 页面 | 文件 | 功能描述 |
|------|------|----------|
| **基础配置** | `pages/Settings.tsx` | Longbridge 凭据配置、股票订阅管理 |
| **实时行情** | `pages/Realtime.tsx` | 实时行情监控、持仓展示、WebSocket 调试 |
| **实时K线** | `pages/RealtimeKLine.tsx` | 实时K线图表、技术指标展示 |
| **历史K线** | `pages/History.tsx` | 历史数据查询和图表分析 |
| **策略控制** | `pages/StrategyControl.tsx` | 策略开关、参数配置、执行状态监控 |
| **信号分析** | `pages/SignalAnalysis.tsx` | 智能信号分析、市场概览、因子解释 |
| **持仓监控** | `pages/PositionMonitoring.tsx` | 持仓实时监控、风险参数设置 |

---

## 🚀 Getting Started

### 1. 环境准备

```bash
# 克隆仓库
git clone <your-repo-url>
cd longbridge-quant-console

# 后端环境（Python 3.9+）
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .

# 前端环境（Node.js 16+）
cd ../frontend
npm install
```

### 2. 配置 Longbridge 凭据

在后端目录创建 `.env` 文件：

```bash
# Longbridge API 凭据
LONGPORT_APP_KEY=your-app-key
LONGPORT_APP_SECRET=your-app-secret
LONGPORT_ACCESS_TOKEN=your-access-token

# 可选：指定区域（大陆账户）
# LONGPORT_REGION=cn

# 数据存储路径（可选）
# DATA_DIR=../data
```

> ⚠️ **安全提醒**：这些凭据具有真实交易权限，请妥善保管，不要提交到版本库。

### 3. 启动系统

#### 启动后端服务器

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端将启动以下服务：
- REST API：`http://localhost:8000`
- WebSocket 行情流：`ws://localhost:8000/ws/quotes`
- API 文档：`http://localhost:8000/docs`

#### 启动前端界面

```bash
cd frontend
npm run dev
```

前端默认运行在 `http://localhost:5173`

### 4. 初始配置

1. 打开前端界面，进入「基础配置」页面
2. 输入 Longbridge API 凭据并验证连接
3. 配置要监控的股票代码（如：`AAPL.US`, `700.HK`, `000001.SZ`）
4. 系统将自动开始接收实时行情和加载历史数据

---

## 💡 核心功能使用指南

### 🧠 智能信号分析

1. **个股分析**：
   - 进入「信号分析」页面
   - 输入股票代码查询最佳买卖点
   - 查看置信度评分和影响因子分解

2. **市场概览**：
   - 实时查看所有配置股票的信号统计
   - 市场情绪指标和牛熊比例分析
   - 按置信度排序的交易机会列表

3. **批量分析**：
   - 支持多股票代码批量分析
   - 可设置最低置信度筛选条件
   - 按信号强度排序显示结果

### 🤖 自动交易策略

1. **策略配置**：
   - 进入「策略控制」页面
   - 启用/禁用特定策略
   - 调整策略参数和风险设置

2. **实时执行**：
   - 策略会自动监控配置的股票
   - 满足条件时自动触发买卖信号
   - 支持智能信号增强的策略决策

3. **策略类型**：
   - **均线交叉**：基于短期和长期均线交叉点
   - **RSI超卖**：识别超卖反弹机会
   - **价格突破**：捕捉突破关键阻力位的机会
   - **布林带**：均值回归策略
   - **MACD背离**：趋势反转信号识别

### 📊 持仓监控

1. **实时监控**：
   - 自动监控所有持仓的实时 PnL
   - 动态计算风险指标和止损点位
   - 支持多币种（USD、HKD、CNY）持仓

2. **风险管理**：
   - 为每个持仓设置止损/止盈参数
   - 最大仓位限制和冷却期设置
   - 自动风险预警和通知

---

## 📊 数据和性能指标

### 实时数据处理能力
- **行情推送**：支持实时接收和处理 WebSocket 行情数据
- **信号计算**：毫秒级信号分析响应时间
- **数据存储**：本地 DuckDB 高性能 OLAP 数据库

### 交易执行效率
- **订单延迟**：< 100ms 信号到订单提交时间
- **策略响应**：实时市场数据触发策略评估
- **风险控制**：实时止损止盈监控

### 分析精度
- **信号置信度**：0-1 精确评分系统
- **多因子权重**：经过优化的因子权重配置
- **回测验证**：历史数据验证信号准确性

---

## 🔧 高级配置

### 策略参数调整

编辑 `config/strategies.json` 文件来调整策略参数：

```json
{
  "strategies": [
    {
      "id": "ma_crossover",
      "name": "均线交叉策略",
      "enabled": true,
      "use_optimal_signals": true,
      "conditions": {
        "buy": [
          {
            "type": "ma_crossover",
            "params": {
              "short_period": 5,
              "long_period": 20,
              "direction": "golden_cross"
            }
          }
        ]
      },
      "risk_management": {
        "stop_loss": 0.05,
        "take_profit": 0.15,
        "position_size": 0.1,
        "max_positions": 3
      }
    }
  ]
}
```

### 通知设置

系统支持多种通知类型：
- 策略触发通知
- 订单执行通知
- 止损止盈触发通知
- 智能信号分析通知

---

## 🚦 系统监控和维护

### 日志监控
- 后端日志：查看策略执行、交易、错误信息
- 前端调试：WebSocket 连接状态、API 请求响应

### 性能监控
- 内存使用：DuckDB 数据库大小监控
- CPU 负载：实时计算和信号分析负载
- 网络延迟：Longbridge API 响应时间

### 数据备份
```bash
# 备份 DuckDB 数据库
cp backend/data/quant.db backup/quant_$(date +%Y%m%d).db

# 备份策略配置
cp config/strategies.json backup/strategies_$(date +%Y%m%d).json
```

---

## 🐛 故障排查

### 常见问题

1. **WebSocket 连接失败**：
   - 检查后端服务是否正常运行
   - 确认防火墙设置允许 WebSocket 连接
   - 查看浏览器控制台错误信息

2. **交易执行失败**：
   - 验证 Longbridge API 凭据是否有效
   - 检查账户余额和交易权限
   - 查看后端日志中的具体错误信息

3. **信号分析异常**：
   - 确认有足够的历史数据用于分析
   - 检查股票代码格式是否正确
   - 验证市场是否在交易时间内

### 调试工具

```bash
# 检查后端服务状态
curl http://localhost:8000/health

# 测试 API 连接
curl http://localhost:8000/settings/credentials

# 查看实时行情流状态
curl http://localhost:8000/quotes/stream/status

# 获取市场概览
curl http://localhost:8000/signals/market_overview
```

---

## 🔒 安全和合规

### 数据安全
- 凭据使用 Fernet 加密存储
- 本地数据库，无敏感信息上传云端
- API 访问控制和请求限制

### 合规要求
- 遵守 Longbridge API 使用条款
- 符合当地金融监管要求
- 个人投资者风险自担

---

## 🎯 开发路线图

### 已完成功能 ✅
- ✅ 智能信号分析系统（11 个分析因子）
- ✅ 5 种自动交易策略
- ✅ 实时持仓监控和风险管理
- ✅ 完整的前端交易界面
- ✅ WebSocket 实时数据推送
- ✅ 本地数据存储和加密

### 计划中功能 🚧
- [ ] 策略回测系统和性能评估
- [ ] 更多技术指标和信号类型
- [ ] 投资组合优化建议
- [ ] 移动端应用支持
- [ ] 多语言界面支持
- [ ] Docker 一键部署方案

### 长期规划 🌟
- [ ] 机器学习增强的信号分析
- [ ] 社区策略分享平台
- [ ] 云端部署和 SaaS 服务
- [ ] 机构级功能和 API

---

## 🤝 贡献指南

欢迎贡献代码和改进建议！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交变更：`git commit -m 'Add your feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 提交 Pull Request

### 开发环境设置
```bash
# 安装开发依赖
pip install -e ".[dev]"  # 后端
npm install --include=dev  # 前端

# 运行测试
pytest  # 后端测试
npm test  # 前端测试

# 代码格式化
black app/  # Python 代码格式化
npm run format  # TypeScript 代码格式化
```

---

## 📄 许可证

本项目基于 MIT 许可证开源，详见 [LICENSE](LICENSE) 文件。

⚠️ **免责声明**：本软件仅用于学习和研究目的。实际使用时请充分测试并遵守相关法规。投资有风险，使用者需自行承担所有投资决策的后果。

---

## 📞 支持和反馈

- 📧 邮箱支持：[gymayong@gmail.com]
- 💬 GitHub Issues：[提交问题和建议](https://github.com/majiajue/longbridge/issues)
- 📚 文档：查看 `docs/` 目录获取更多技术文档
- 🚀 更新日志：查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新

---

*最后更新：2025-09-24 | 版本：v2.0.0 - 智能信号分析版*
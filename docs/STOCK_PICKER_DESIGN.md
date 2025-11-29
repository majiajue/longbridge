# 智能选股分析系统设计文档

## 📋 需求概述

### 功能描述
用户提供两个股票池（做多池和做空池），系统自动分析所有股票，给出买入/做空建议和评分排序。

### 核心需求
1. **股票池管理**
   - 做多候选池：最多20只股票
   - 做空候选池：最多20只股票
   - 支持添加/删除/批量导入

2. **自动分析**
   - 自动获取所有股票的K线数据
   - 使用AI分析器+量化评分系统分析
   - 生成综合评分和建议

3. **结果展示**
   - 做多池：按买入推荐度排序
   - 做空池：按做空推荐度排序
   - 显示评分、信号、K线预览
   - 支持详细查看和一键交易

4. **定时更新**
   - 支持手动刷新
   - 可设置自动刷新（如每5分钟）

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    前端界面                          │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  做多股票池   │  │  做空股票池   │                │
│  │  (Long Pool) │  │ (Short Pool) │                │
│  └──────────────┘  └──────────────┘                │
│          ↓                  ↓                       │
│  ┌─────────────────────────────────┐               │
│  │      分析结果展示（排序）        │               │
│  │  评分 | 信号 | K线 | 操作         │               │
│  └─────────────────────────────────┘               │
└─────────────────────────────────────────────────────┘
                      ↕ API
┌─────────────────────────────────────────────────────┐
│                   后端服务                           │
│  ┌──────────────────────────────────────┐          │
│  │  Stock Picker Service                │          │
│  │  - 股票池管理                        │          │
│  │  - 批量分析调度                      │          │
│  │  - 结果缓存                          │          │
│  └──────────────────────────────────────┘          │
│                      ↓                              │
│  ┌──────────────────────────────────────┐          │
│  │  AI Analyzer (已有)                  │          │
│  │  - K线获取                           │          │
│  │  - 量化评分                          │          │
│  │  - AI决策                            │          │
│  └──────────────────────────────────────┘          │
│                      ↓                              │
│  ┌──────────────────────────────────────┐          │
│  │  Database (DuckDB)                   │          │
│  │  - stock_picker_pools 表             │          │
│  │  - stock_picker_analysis 表          │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## 📊 数据模型设计

### 1. stock_picker_pools 表（股票池配置）

```sql
CREATE TABLE IF NOT EXISTS stock_picker_pools (
    id INTEGER PRIMARY KEY,
    pool_type TEXT NOT NULL,          -- 'LONG' 或 'SHORT'
    symbol TEXT NOT NULL,             -- 股票代码
    name TEXT,                        -- 股票名称（可选）
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_reason TEXT,                -- 添加理由（可选）
    is_active BOOLEAN DEFAULT TRUE,   -- 是否激活
    priority INTEGER DEFAULT 0,       -- 优先级（可选）
    UNIQUE(pool_type, symbol)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pool_type ON stock_picker_pools(pool_type);
CREATE INDEX IF NOT EXISTS idx_is_active ON stock_picker_pools(is_active);
```

**字段说明**：
- `pool_type`: 'LONG'（做多池）或 'SHORT'（做空池）
- `symbol`: 股票代码，如 'AAPL.US', '00700.HK'
- `is_active`: 是否激活，方便暂时停用某只股票
- `priority`: 用户自定义优先级（可选功能）

### 2. stock_picker_analysis 表（分析结果）

```sql
CREATE TABLE IF NOT EXISTS stock_picker_analysis (
    id INTEGER PRIMARY KEY,
    pool_id INTEGER NOT NULL,         -- 关联 stock_picker_pools
    symbol TEXT NOT NULL,
    pool_type TEXT NOT NULL,          -- 'LONG' 或 'SHORT'
    
    -- 分析时间
    analysis_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 价格信息
    current_price REAL,
    price_change_1d REAL,             -- 1日涨跌幅
    price_change_5d REAL,             -- 5日涨跌幅
    
    -- 量化评分
    score_total REAL,                 -- 总分 0-100
    score_grade TEXT,                 -- 评级 A/B/C/D
    score_trend REAL,                 -- 趋势分 0-30
    score_momentum REAL,              -- 动量分 0-25
    score_volume REAL,                -- 量能分 0-15
    score_volatility REAL,            -- 波动分 0-15
    score_pattern REAL,               -- 形态分 0-15
    
    -- AI决策
    ai_action TEXT,                   -- BUY/SELL/HOLD
    ai_confidence REAL,               -- 信心度 0-1
    ai_reasoning TEXT,                -- 理由（JSON数组）
    
    -- 技术指标（快照）
    indicators TEXT,                  -- JSON格式存储所有指标
    
    -- 检测到的信号
    signals TEXT,                     -- JSON数组
    
    -- 推荐度（综合评分）
    recommendation_score REAL,        -- 推荐度 0-100
    recommendation_reason TEXT,       -- 推荐理由
    
    -- K线数据快照（最近20根）
    klines_snapshot TEXT,             -- JSON格式
    
    FOREIGN KEY (pool_id) REFERENCES stock_picker_pools(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_analysis_pool ON stock_picker_analysis(pool_id);
CREATE INDEX IF NOT EXISTS idx_analysis_time ON stock_picker_analysis(analysis_time);
CREATE INDEX IF NOT EXISTS idx_recommendation ON stock_picker_analysis(recommendation_score DESC);
```

---

## 🔌 API 设计

### 1. 股票池管理 API

#### 1.1 获取股票池
```http
GET /api/stock-picker/pools?type=LONG|SHORT
```

**响应示例**：
```json
{
  "long_pool": [
    {
      "id": 1,
      "symbol": "AAPL.US",
      "name": "Apple Inc.",
      "added_at": "2025-10-24T10:00:00",
      "added_reason": "科技龙头，业绩稳定",
      "is_active": true,
      "priority": 1
    }
  ],
  "short_pool": [
    {
      "id": 21,
      "symbol": "TSLA.US",
      "name": "Tesla Inc.",
      "added_at": "2025-10-24T10:05:00",
      "added_reason": "估值过高",
      "is_active": true,
      "priority": 0
    }
  ]
}
```

#### 1.2 添加股票到池
```http
POST /api/stock-picker/pools
Content-Type: application/json

{
  "pool_type": "LONG",
  "symbol": "AAPL.US",
  "name": "Apple Inc.",
  "added_reason": "科技龙头"
}
```

#### 1.3 批量添加
```http
POST /api/stock-picker/pools/batch
Content-Type: application/json

{
  "pool_type": "LONG",
  "symbols": [
    {"symbol": "AAPL.US", "name": "Apple"},
    {"symbol": "MSFT.US", "name": "Microsoft"},
    {"symbol": "GOOGL.US", "name": "Alphabet"}
  ]
}
```

#### 1.4 删除股票
```http
DELETE /api/stock-picker/pools/{pool_id}
```

#### 1.5 切换激活状态
```http
PATCH /api/stock-picker/pools/{pool_id}/toggle
```

### 2. 分析 API

#### 2.1 触发分析（批量）
```http
POST /api/stock-picker/analyze
Content-Type: application/json

{
  "pool_type": "LONG",      // 可选，不填则分析所有
  "force_refresh": false    // 是否强制重新分析（忽略缓存）
}
```

**响应示例**：
```json
{
  "task_id": "abc123",
  "status": "processing",
  "total": 20,
  "message": "开始分析20只股票..."
}
```

#### 2.2 获取分析结果
```http
GET /api/stock-picker/analysis?pool_type=LONG&sort_by=recommendation
```

**查询参数**：
- `pool_type`: LONG | SHORT | ALL（默认ALL）
- `sort_by`: recommendation（推荐度）| score（评分）| confidence（信心度）
- `order`: desc | asc（默认desc）
- `limit`: 返回数量（默认20）

**响应示例**：
```json
{
  "long_analysis": [
    {
      "id": 1,
      "symbol": "NVDA.US",
      "name": "NVIDIA",
      "pool_type": "LONG",
      "analysis_time": "2025-10-24T14:30:00",
      
      "current_price": 485.50,
      "price_change_1d": 2.5,
      "price_change_5d": 8.3,
      
      "score": {
        "total": 85.0,
        "grade": "A",
        "breakdown": {
          "trend": 27,
          "momentum": 22,
          "volume": 15,
          "volatility": 13,
          "pattern": 13
        }
      },
      
      "ai_decision": {
        "action": "BUY",
        "confidence": 0.88,
        "reasoning": [
          "A级评分，多因子共振",
          "红三兵形态，趋势向上",
          "MACD强势金叉"
        ]
      },
      
      "signals": [
        "多头排列(MA5>MA20>MA60)",
        "MACD强势金叉",
        "明显放量(1.8x)",
        "红三兵(看涨)"
      ],
      
      "recommendation_score": 92,
      "recommendation_reason": "强烈推荐买入：A级评分+高信心度+多个看涨信号"
    },
    {
      "id": 2,
      "symbol": "AAPL.US",
      "name": "Apple",
      "score": {...},
      "recommendation_score": 78,
      ...
    }
  ],
  "short_analysis": [...],
  "stats": {
    "long_count": 20,
    "long_avg_score": 68.5,
    "long_recommended": 12,
    "short_count": 20,
    "short_avg_score": 42.3,
    "short_recommended": 8
  }
}
```

#### 2.3 获取单个股票详情
```http
GET /api/stock-picker/analysis/{symbol}
```

返回完整的分析详情，包括K线数据、所有指标等。

#### 2.4 获取分析任务状态
```http
GET /api/stock-picker/tasks/{task_id}
```

**响应示例**：
```json
{
  "task_id": "abc123",
  "status": "completed",
  "progress": {
    "total": 20,
    "completed": 20,
    "failed": 0
  },
  "results": {...}
}
```

### 3. 配置 API

#### 3.1 获取配置
```http
GET /api/stock-picker/config
```

#### 3.2 更新配置
```http
PUT /api/stock-picker/config
Content-Type: application/json

{
  "auto_refresh_enabled": true,
  "auto_refresh_interval": 300,  // 秒
  "max_pool_size": 20,
  "cache_duration": 300,         // 分析结果缓存时长（秒）
  "min_score_to_recommend": 65   // 最低推荐分数
}
```

---

## 🎨 前端界面设计

### 页面布局

```
┌────────────────────────────────────────────────────────┐
│  📊 智能选股分析                    [刷新] [配置]      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌─ 做多股票池 (12/20) ───────────┐  ┌─ 做空股票池 (8/20) ─┐
│  │                                │  │                      │
│  │  [+ 添加股票] [批量导入]       │  │  [+ 添加股票]        │
│  │                                │  │                      │
│  │  🔍 搜索...      [分析全部]    │  │  🔍 搜索...          │
│  │  ────────────────────────────  │  │  ──────────────────  │
│  │                                │  │                      │
│  │  ┌──────────────────────────┐ │  │  ┌─────────────────┐ │
│  │  │ #1 NVDA 🟢 A级 (92分)    │ │  │  │ #1 XYZ 🔴 (85分)│ │
│  │  │ $485.50 ↑2.5%            │ │  │  │ $125.30 ↓1.2%  │ │
│  │  │ ✓ 多头排列 ✓ MACD金叉    │ │  │  │ ✗ 空头排列     │ │
│  │  │ 信心度: 88%              │ │  │  │ 信心度: 82%    │ │
│  │  │ [详情] [买入]            │ │  │  │ [详情] [做空]  │ │
│  │  └──────────────────────────┘ │  │  └─────────────────┘ │
│  │                                │  │                      │
│  │  ┌──────────────────────────┐ │  │  ┌─────────────────┐ │
│  │  │ #2 AAPL 🟡 B级 (78分)    │ │  │  │ #2 ABC (72分)  │ │
│  │  │ $175.50 ↑1.2%            │ │  │  │                 │ │
│  │  │ ...                      │ │  │  │ ...             │ │
│  │  └──────────────────────────┘ │  │  └─────────────────┘ │
│  │                                │  │                      │
│  └────────────────────────────────┘  └──────────────────────┘
│                                                            │
│  📈 统计信息                                              │
│  做多池: 平均评分 68.5 | 推荐 12/20                       │
│  做空池: 平均评分 42.3 | 推荐 8/20                        │
└────────────────────────────────────────────────────────────┘
```

### 股票卡片详细设计

```
┌───────────────────────────────────────────────────┐
│ #1 NVDA.US - NVIDIA Corporation          🟢 A级  │
├───────────────────────────────────────────────────┤
│                                                   │
│  💰 $485.50  ↑ +2.5% (1日)  ↑ +8.3% (5日)       │
│                                                   │
│  📊 量化评分: 85/100 (A级)                       │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  趋势 27/30              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  动量 22/25              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  量能 15/15              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  波动 13/15              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  形态 13/15              │
│                                                   │
│  🤖 AI决策: BUY (信心度: 88%)                    │
│  理由:                                            │
│   • A级评分，多因子共振                          │
│   • 红三兵形态，趋势强劲                         │
│   • MACD强势金叉，动量充足                       │
│                                                   │
│  ✓ 检测信号:                                     │
│   ✓ 多头排列(MA5>MA20>MA60)                     │
│   ✓ MACD强势金叉                                │
│   ✓ 明显放量(1.8x)                              │
│   ✓ 红三兵(看涨)                                │
│                                                   │
│  📈 K线预览: [迷你K线图]                         │
│                                                   │
│  ⭐ 推荐度: 92/100                               │
│  💡 强烈推荐买入：A级评分+高信心度+多个看涨信号  │
│                                                   │
│  [📊 查看详情] [📈 查看K线] [💰 立即买入]       │
│  [🗑️ 从池中移除] [⏸️ 暂停监控]                 │
└───────────────────────────────────────────────────┘
```

### 添加股票对话框

```
┌─────────────────────────────────────┐
│  添加股票到做多池                    │
├─────────────────────────────────────┤
│                                     │
│  股票代码: [AAPL.US        ]       │
│           (支持: AAPL.US, 00700.HK) │
│                                     │
│  股票名称: [Apple Inc.     ]       │
│           (可选，自动获取)          │
│                                     │
│  添加理由: [________________]       │
│           (可选)                    │
│                                     │
│  优先级:   ○ 高  ● 中  ○ 低        │
│                                     │
│  [取消]          [确定添加]         │
└─────────────────────────────────────┘
```

### 批量导入对话框

```
┌─────────────────────────────────────────┐
│  批量导入股票                            │
├─────────────────────────────────────────┤
│                                         │
│  每行一个股票代码，格式:                 │
│  AAPL.US                                │
│  MSFT.US Apple的竞争对手                │
│  GOOGL.US                               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ NVDA.US 看好AI芯片              │   │
│  │ AAPL.US                         │   │
│  │ MSFT.US                         │   │
│  │ GOOGL.US                        │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  或者上传文件: [选择CSV文件]            │
│                                         │
│  [取消]          [导入 (4只股票)]       │
└─────────────────────────────────────────┘
```

---

## 🔄 业务流程

### 1. 用户添加股票流程

```
用户操作
   ↓
[点击"添加股票"]
   ↓
[填写股票代码 + 可选信息]
   ↓
[提交]
   ↓
后端验证
   ↓
[检查代码有效性]
   ↓
[检查是否已存在]
   ↓
[检查池容量(<20)]
   ↓
保存到 stock_picker_pools
   ↓
返回成功
   ↓
前端刷新列表
```

### 2. 批量分析流程

```
用户点击"分析全部"
   ↓
后端创建分析任务
   ↓
返回 task_id
   ↓
前端显示进度条
   ↓
后端异步处理
   ├─ 获取股票池列表
   ├─ 对每只股票:
   │   ├─ 检查缓存（5分钟内）
   │   ├─ 获取K线数据
   │   ├─ 计算技术指标
   │   ├─ 量化评分
   │   ├─ AI分析（可选）
   │   ├─ 计算推荐度
   │   └─ 保存结果
   └─ 完成
   ↓
前端轮询任务状态
   ↓
完成后刷新结果列表
   ↓
按推荐度排序展示
```

### 3. 推荐度计算逻辑

```python
def calculate_recommendation_score(analysis, pool_type):
    """
    计算推荐度分数 (0-100)
    
    对于做多池:
        推荐度 = 量化评分 * 0.5 + AI信心度 * 50 * 0.3 + 信号强度 * 0.2
    
    对于做空池:
        推荐度 = (100-量化评分) * 0.5 + AI信心度 * 50 * 0.3 + 信号强度 * 0.2
        (注意: 做空池的推荐度越高，说明越适合做空)
    """
    
    score = analysis['score']['total']
    confidence = analysis['ai_decision']['confidence']
    
    # 信号强度（检测到的信号数量和质量）
    signal_strength = calculate_signal_strength(analysis['signals'])
    
    if pool_type == 'LONG':
        # 做多：高分 + 高信心度 = 高推荐度
        recommendation = (
            score * 0.5 +
            confidence * 50 * 0.3 +
            signal_strength * 0.2
        )
    else:  # SHORT
        # 做空：低分 + 高信心度 = 高推荐度
        recommendation = (
            (100 - score) * 0.5 +
            confidence * 50 * 0.3 +
            signal_strength * 0.2
        )
    
    return min(100, max(0, recommendation))
```

---

## 🛠️ 技术实现要点

### 1. 后端实现（Python/FastAPI）

**文件结构**：
```
backend/app/
├── stock_picker.py          # 核心服务
├── routers/
│   └── stock_picker.py      # API路由
└── models.py                # 添加相关模型
```

**关键类**：
```python
class StockPickerService:
    """选股服务"""
    
    async def add_stock(self, pool_type, symbol, **kwargs):
        """添加股票到池"""
        pass
    
    async def remove_stock(self, pool_id):
        """从池中移除股票"""
        pass
    
    async def analyze_pool(self, pool_type=None, force=False):
        """批量分析股票池"""
        pass
    
    async def get_analysis_results(self, pool_type, sort_by):
        """获取分析结果（排序）"""
        pass
    
    def calculate_recommendation_score(self, analysis, pool_type):
        """计算推荐度"""
        pass
```

### 2. 前端实现（React/TypeScript）

**文件结构**：
```
frontend/src/
├── pages/
│   └── StockPicker.tsx      # 主页面
├── components/
│   ├── StockPool.tsx        # 股票池组件
│   ├── StockCard.tsx        # 股票卡片
│   ├── AddStockDialog.tsx   # 添加对话框
│   └── AnalysisDetail.tsx   # 详情弹窗
└── api/
    └── stockPicker.ts       # API客户端
```

### 3. 性能优化

1. **缓存策略**
   - 分析结果缓存5分钟
   - K线数据缓存根据时间周期
   - 使用 Redis 或内存缓存

2. **批量分析优化**
   - 使用异步任务队列（Celery 或 asyncio）
   - 并发分析（限制并发数，避免API限流）
   - 进度实时反馈

3. **前端优化**
   - 虚拟滚动（大量股票时）
   - 结果分页加载
   - WebSocket 实时更新（可选）

### 4. 错误处理

- 股票代码无效
- API 限流
- 网络超时
- 数据不足（K线少于20根）
- 分析失败（记录但不中断批量任务）

---

## 📱 移动端适配

- 响应式布局
- 左右滑动切换做多/做空池
- 卡片简化显示
- 点击展开详情

---

## 🔒 权限控制

- 普通用户：查看自己的股票池
- 高级用户：可创建多个股票池
- 管理员：查看所有用户的股票池

---

## 📊 统计与报表

### 1. 实时统计
- 各池平均评分
- 推荐股票数量
- 各评级分布（A/B/C/D）
- 信心度分布

### 2. 历史对比
- 股票评分变化趋势
- 推荐准确率统计
- 收益回测（如果有交易记录）

---

## 🚀 实施计划

### Phase 1: 核心功能（1周）
- [ ] 数据库表设计与创建
- [ ] 股票池管理 API
- [ ] 批量分析服务
- [ ] 基础前端界面

### Phase 2: 优化增强（3-5天）
- [ ] 推荐度算法优化
- [ ] 缓存与性能优化
- [ ] 详情页与K线预览
- [ ] 批量导入功能

### Phase 3: 高级功能（1周）
- [ ] 自动刷新机制
- [ ] WebSocket 实时推送
- [ ] 历史分析记录
- [ ] 统计报表

### Phase 4: 测试与部署（2-3天）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 文档完善

---

## 📋 API 路由总览

| 方法 | 路径 | 功能 |
|-----|------|------|
| GET | `/api/stock-picker/pools` | 获取股票池 |
| POST | `/api/stock-picker/pools` | 添加股票 |
| POST | `/api/stock-picker/pools/batch` | 批量添加 |
| DELETE | `/api/stock-picker/pools/{id}` | 删除股票 |
| PATCH | `/api/stock-picker/pools/{id}/toggle` | 切换激活 |
| POST | `/api/stock-picker/analyze` | 触发分析 |
| GET | `/api/stock-picker/analysis` | 获取分析结果 |
| GET | `/api/stock-picker/analysis/{symbol}` | 获取详情 |
| GET | `/api/stock-picker/tasks/{id}` | 任务状态 |
| GET | `/api/stock-picker/config` | 获取配置 |
| PUT | `/api/stock-picker/config` | 更新配置 |
| GET | `/api/stock-picker/stats` | 统计信息 |

---

## 💡 扩展功能建议

1. **智能推荐**
   - 根据历史表现自动推荐股票
   - 板块分析

2. **组合优化**
   - 最优股票组合建议
   - 风险分散建议

3. **模拟交易**
   - 虚拟交易测试
   - 收益回测

4. **社交功能**
   - 分享股票池
   - 跟随高手池

5. **AI 助手**
   - 自然语言查询："哪些股票适合买入？"
   - 智能筛选建议

---

## 🎯 成功指标

- ✅ 支持管理 40 只股票（做多20 + 做空20）
- ✅ 5 分钟内完成 40 只股票的批量分析
- ✅ 推荐准确率 > 60%（后续统计）
- ✅ 前端响应时间 < 1 秒
- ✅ 系统稳定性 > 99%

---

**文档版本**: v1.0  
**创建日期**: 2025-10-24  
**状态**: 待评审












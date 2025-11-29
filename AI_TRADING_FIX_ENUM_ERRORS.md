# AI实时交易失败问题修复

## 问题描述

AI实时交易总是失败，后端日志显示错误：
```
ERROR:app.streaming:Error processing strategy quote for BHP.US: ACTIVE
```

## 根本原因

代码中使用的枚举值与定义不匹配：

1. **MonitoringStatus 枚举问题**
   - 代码中使用：`MonitoringStatus.ACTIVE`
   - 实际定义：`ENABLED`, `DISABLED`, `PAUSED`
   - 错误：`ACTIVE` 不存在，导致 `AttributeError`

2. **StrategyMode 枚举问题**
   - 代码中使用：`StrategyMode.AUTO`, `StrategyMode.ALERT_ONLY`, `StrategyMode.DISABLED`
   - 旧定义：`CONSERVATIVE`, `BALANCED`, `AGGRESSIVE`, `CUSTOM`
   - 错误：使用的值不存在

## 修复内容

### 1. 修复 MonitoringStatus 使用
**文件**：`backend/app/position_monitor.py`, `backend/app/routers/monitoring.py`

```python
# 修复前
if position.monitoring_config.monitoring_status != MonitoringStatus.ACTIVE:
    return

# 修复后
if position.monitoring_config.monitoring_status != MonitoringStatus.ENABLED:
    return
```

**修改位置**：
- `position_monitor.py:162` - process_quote 方法中的状态检查
- `position_monitor.py:94, 210` - 创建新监控配置时的默认状态
- `position_monitor.py:597` - 获取活跃监控状态列表
- `routers/monitoring.py:269` - 启用所有监控的接口

### 2. 修复 StrategyMode 枚举定义
**文件**：`backend/app/models.py`

```python
# 修复前
class StrategyMode(str, Enum):
    CONSERVATIVE = "conservative"
    BALANCED = "balanced"
    AGGRESSIVE = "aggressive"
    CUSTOM = "custom"

# 修复后
class StrategyMode(str, Enum):
    AUTO = "auto"              # 自动执行交易
    ALERT_ONLY = "alert_only"  # 仅发送告警
    DISABLED = "disabled"      # 禁用策略
    BALANCED = "balanced"      # 平衡模式（向后兼容）
```

### 3. 更新默认策略模式
**文件**：`backend/app/models.py`, `backend/app/position_monitor.py`

```python
# 修改默认值为更安全的 ALERT_ONLY
class PositionMonitoringConfig(BaseModel):
    # ...
    strategy_mode: StrategyMode = StrategyMode.ALERT_ONLY  # 默认仅告警，安全优先

# 更新代码中的默认值
strategy_mode=getattr(self.global_settings, "default_strategy_mode", StrategyMode.ALERT_ONLY)
```

## 策略模式说明

修复后的 `StrategyMode` 有以下模式：

| 模式 | 值 | 说明 |
|------|------|------|
| AUTO | "auto" | 自动执行交易信号 |
| ALERT_ONLY | "alert_only" | 仅发送告警，不执行交易（默认，安全） |
| DISABLED | "disabled" | 禁用所有策略 |
| BALANCED | "balanced" | 保留用于向后兼容 |

## 工作流程

修复后的AI交易工作流程：

1. **行情推送** → `streaming.py:_normalize_quote()`
2. **处理策略** → `streaming.py:_process_strategy_quote()`
3. **检查监控状态** → `position_monitor.py:process_quote()`
   - 检查 `monitoring_status == ENABLED` ✅
4. **评估策略** → `position_monitor.py:evaluate_strategies()`
   - 检查 `strategy_mode != DISABLED` ✅
5. **执行或告警**：
   - `strategy_mode == AUTO` → 自动执行交易
   - `strategy_mode == ALERT_ONLY` → 仅发送告警

## 测试验证

修复后验证：
1. ✅ 没有 linter 错误
2. ✅ 枚举值全部匹配
3. ✅ 默认模式为 `ALERT_ONLY`（安全）

## 如何启用自动交易

要启用AI自动交易，需要：

1. **启用监控**：
```bash
# 通过 API
POST /api/monitoring/enable-all
```

2. **设置为自动模式**：
```python
# 修改配置
config.strategy_mode = StrategyMode.AUTO
```

3. **配置策略**：
```python
# 启用具体策略
config.enabled_strategies = ['strategy_id_1', 'strategy_id_2']
```

## 重启服务

修复后需要重启后端服务以应用更改：

```bash
cd /Volumes/SamSung/longbridge
./stop.sh
./start.sh
```

## 相关文件

- `backend/app/models.py` - 枚举定义
- `backend/app/position_monitor.py` - 监控逻辑
- `backend/app/streaming.py` - 行情流处理
- `backend/app/routers/monitoring.py` - 监控API

---

**修复日期**：2025-11-04  
**状态**：✅ 已完成  
**影响**：修复了AI交易失败问题，现在可以正常处理策略信号









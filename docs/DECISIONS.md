# 项目关键决策与约定（持久备忘）

记录近期重要改动与约定，便于后续统一认知与排查。

更新时间：2025-09-24

- DuckDB 连接管理
  - 采用全局单例连接 + 互斥锁串行化 DB 访问，避免同一进程内并发打开同一 DB 文件导致的 “Unique file handle conflict”。
  - 位置：backend/app/db.py

- 实时 K 线策略
  - 页面切换为“分钟线流更新”：首屏加载 1000 根 `min1`，随后按 WebSocket 推送按分钟桶增量更新/追加蜡烛。
  - 历史 `min1` 默认由 ticks 聚合生成（兜底），以免与日线 OHLC 混淆。
  - 位置：
    - 后端：backend/app/routers/quotes.py（period=min1 时走 tick 聚合）
    - 聚合：backend/app/repositories.py（`fetch_bars_from_ticks`）
    - 前端：frontend/src/pages/RealtimeKLine.tsx（加载 `period=min1`，实时按分钟桶更新）

- 历史 K 线兜底
  - 若 `ohlc` 无数据，回退到由 ticks 聚合的分钟线，前端仍可正常绘图。
  - 位置：backend/app/services.py（`get_cached_candlesticks` 内回退逻辑）

- 设置接口稳定性
  - 修复 `/settings/symbols` 偶发 500，根因是 DB 并发连接冲突（见 DuckDB 决策）。
  - 位置：backend/app/db.py（同上）

- 策略控制中心持仓展示
  - 合并真实账户持仓到 `/strategies/positions/all` 返回值（strategy 引擎未开仓也能显示账户现有持仓）。
  - 位置：backend/app/routers/strategies.py

- 前端一致性
  - 统一 K 线时间轴为数值型 UTC 时间戳（秒），避免因字符串时间与数值时间混用导致的图表不更新。
  - 位置：frontend/src/pages/RealtimeKLine.tsx

后续可选优化（待评估）
- 为 `min1` 构建独立持久化表，提供更长的分钟历史查询能力（避免仅依赖已采集 ticks）。
- 在 K 线页展示“当前数据来源”（日线/分钟聚合/实时），增强可观测性。
- 在策略控制中心计算并显示真实持仓的实时 PnL。


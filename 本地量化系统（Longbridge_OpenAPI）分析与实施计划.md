# 本地量化系统（Longbridge OpenAPI）分析与实施计划

## Core Features

- 设置中心：凭据与股票清单维护，保存后重启流

- 历史K线同步与缓存预览、导出

- 实时看板：订阅表、KPI、连接状态与告警

- 组合概览：持仓解析与盈亏聚合

- 事件与工具：WebSocket事件流与Tick查询

- 全局规则：实现前必须阅读 docs/llms.txt（启动/CI 校验与脚本提示）

- 前端：历史K线图（Recharts 蜡烛图）

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "mui"
  },
  "iOS": null,
  "Android": null
}

## Design

Material风格、卡片化布局、顶部应用栏+侧边导航+底部状态条；12列栅格。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 项目理解与分析

[/] 强化实时看板：订阅表行高亮更新、KPI 卡片、连接/延迟状态与告警提示

[/] 后端：portfolio/overview 返回 USD 资金账户（无则标注 usd_missing）

[/] 后端：USD available_cash 精确匹配（不再回退 total_cash）

[X] 后端：透传 withdraw_cash/settling_cash/frozen_transaction_fee_usd（对齐 App 口径）

[ ] 前端：现金口径按 withdraw_cash 优先（如缺失再用 available_cash）

[/] 前端：历史K线页面与蜡烛图展示（Recharts）

[/] 历史K线：一键同步+预览联动

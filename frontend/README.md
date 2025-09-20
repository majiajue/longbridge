# Longbridge Quant Frontend

基于 React + Vite + Material UI 的单页应用，用于管理本地量化系统的基础配置。

## 现有功能
- 录入并保存 Longbridge 凭据（存储在本地 DuckDB，经 Fernet 加密）
- 管理股票代码列表，支持多只股票批量维护

## 开发方式

```bash
cd frontend
npm install
npm run dev
```

默认向 `http://localhost:8000` 发起请求，可通过环境变量覆盖：

```bash
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

后续会在此基础上扩展实时行情、K 线展示与策略信号监控等界面。

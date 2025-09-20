# Longbridge Quant Backend

本服务基于 FastAPI，提供本地量化系统的基础能力：

- 凭据与股票代码配置接口（DuckDB 持久化 + Fernet 加密敏感信息）
- 统一健康检查 `GET /health`

后续会在此基础上拓展行情订阅、策略引擎、交易执行等模块。

## 开发环境

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

默认使用 `../data/quant.db` 持久化数据。如需自定义，设置环境变量：

```bash
export DATA_DIR=/path/to/data
export DUCKDB_PATH=/path/to/data/quant.db
```

首次运行会自动生成加密密钥 `data/encryption.key`。

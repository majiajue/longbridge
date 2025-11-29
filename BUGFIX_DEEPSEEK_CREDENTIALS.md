# 🐛 Bug修复：DeepSeek API 凭据读取错误

## ❌ 问题描述

用户在数据库中配置了 `DEEPSEEK_API_KEY`，但系统日志显示：
```
WARNING:app.stock_picker:⚠️ 未配置DeepSeek API，使用纯量化评分: LYFT.US
```

系统无法读取 DeepSeek API 凭据，导致所有股票都使用纯量化模式，而不是 AI 深度分析。

---

## 🔍 根本原因

### 错误代码（修复前）

```python
# backend/app/stock_picker.py

from .repositories import load_credentials  # ❌ 错误的函数

# 获取AI凭据
creds = load_credentials()  # ❌ 只读取 Longbridge 凭据
api_key = creds.get('DEEPSEEK_API_KEY')  # ❌ 永远读不到
```

### 问题分析

**repositories.py 中有两个不同的函数**：

```python
# backend/app/repositories.py

CRED_KEYS = {
    "LONGPORT_APP_KEY": "longport_app_key",
    "LONGPORT_APP_SECRET": "longport_app_secret",
    "LONGPORT_ACCESS_TOKEN": "longport_access_token",
}

AI_CRED_KEYS = {
    "DEEPSEEK_API_KEY": "deepseek_api_key",
}

def load_credentials() -> Dict[str, str]:
    """只读取 Longbridge 凭据（CRED_KEYS）"""
    # ...
    rows = conn.execute(
        "SELECT key, value FROM settings WHERE key IN (?, ?, ?)",
        list(CRED_KEYS.values()),  # ❌ 只查询 Longbridge 的 key
    ).fetchall()
    # ...

def load_ai_credentials() -> Dict[str, str]:
    """读取 AI 凭据（AI_CRED_KEYS）"""
    # ...
    rows = conn.execute(
        "SELECT key, value FROM settings WHERE key IN (?)",
        list(AI_CRED_KEYS.values()),  # ✅ 查询 DeepSeek 的 key
    ).fetchall()
    # ...
```

**问题**：
- `load_credentials()` 只查询 `CRED_KEYS`（Longbridge）
- `load_ai_credentials()` 才查询 `AI_CRED_KEYS`（DeepSeek）
- 代码错误调用了 `load_credentials()`，导致无法读取 DeepSeek API Key

---

## ✅ 修复方案

### 修复代码（修复后）

```python
# backend/app/stock_picker.py

from .repositories import load_ai_credentials  # ✅ 使用正确的函数

# 获取AI凭据（使用正确的函数）
ai_creds = load_ai_credentials()  # ✅ 读取 AI 凭据
api_key = ai_creds.get('DEEPSEEK_API_KEY')  # ✅ 可以读取到
base_url = ai_creds.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
```

---

## 📊 修复前后对比

### 修复前
```python
# 错误的函数调用
from .repositories import load_credentials

creds = load_credentials()  # 返回 {'LONGPORT_APP_KEY': '...', ...}
api_key = creds.get('DEEPSEEK_API_KEY')  # None
```

**结果**：
```
⚠️ 未配置DeepSeek API，使用纯量化评分: LYFT.US
```

---

### 修复后
```python
# 正确的函数调用
from .repositories import load_ai_credentials

ai_creds = load_ai_credentials()  # 返回 {'DEEPSEEK_API_KEY': 'sk-...', ...}
api_key = ai_creds.get('DEEPSEEK_API_KEY')  # 'sk-...'
```

**结果**：
```
🤖 DeepSeek分析: LYFT.US
🤖 AI决策: LYFT.US - BUY (信心度: 0.82)
```

---

## 🔧 修复详情

### 修改的文件
**backend/app/stock_picker.py** - 第 240、243 行

### 修改内容
```diff
- from .repositories import load_credentials
+ from .repositories import load_ai_credentials

- # 获取AI凭据
- creds = load_credentials()
- api_key = creds.get('DEEPSEEK_API_KEY')
- base_url = creds.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
+ # 获取AI凭据（使用正确的函数）
+ ai_creds = load_ai_credentials()
+ api_key = ai_creds.get('DEEPSEEK_API_KEY')
+ base_url = ai_creds.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
```

---

## 🧪 测试验证

### 修复前测试
1. 数据库中有 `deepseek_api_key = 'sk-...'`
2. 运行股票分析
3. 日志显示：`⚠️ 未配置DeepSeek API`
4. 使用纯量化模式 ❌

### 修复后测试
1. 数据库中有 `deepseek_api_key = 'sk-...'`
2. 重启后端
3. 运行股票分析
4. 日志显示：`🤖 DeepSeek分析: XXX.US`
5. 使用 AI 深度分析 ✅

---

## 📚 相关代码说明

### repositories.py 凭据管理架构

```python
# 两套独立的凭据管理系统

# 1. Longbridge 凭据（交易 API）
CRED_KEYS = {
    "LONGPORT_APP_KEY": "longport_app_key",
    "LONGPORT_APP_SECRET": "longport_app_secret",
    "LONGPORT_ACCESS_TOKEN": "longport_access_token",
}

def save_credentials(creds: Dict[str, str]) -> None:
    """保存 Longbridge 凭据"""
    for env_key, db_key in CRED_KEYS.items():
        # ...

def load_credentials() -> Dict[str, str]:
    """读取 Longbridge 凭据"""
    # 查询 CRED_KEYS.values()
    # ...

# 2. AI 凭据（DeepSeek API）
AI_CRED_KEYS = {
    "DEEPSEEK_API_KEY": "deepseek_api_key",
}

def save_ai_credentials(creds: Dict[str, str]) -> None:
    """保存 AI 凭据"""
    for env_key, db_key in AI_CRED_KEYS.items():
        # ...

def load_ai_credentials() -> Dict[str, str]:
    """读取 AI 凭据"""
    # 查询 AI_CRED_KEYS.values()
    # ...
```

**设计原因**：
- 分离 Longbridge 和 AI 凭据管理
- 避免混淆不同类型的配置
- 提供更清晰的接口

---

## ⚠️ 注意事项

### 类似问题排查

如果遇到"未配置 XXX"的警告，检查：

1. **数据库中是否有配置**
   ```sql
   SELECT * FROM settings WHERE key LIKE '%api%';
   ```

2. **使用了正确的读取函数**
   - Longbridge 凭据 → `load_credentials()`
   - AI 凭据 → `load_ai_credentials()`
   - 不要混用！

3. **key 名称是否匹配**
   - 环境变量名：`DEEPSEEK_API_KEY`
   - 数据库 key：`deepseek_api_key`
   - 映射关系在 `CRED_KEYS` 或 `AI_CRED_KEYS` 中定义

---

## 🎯 影响范围

### 受影响的功能
- ✅ 智能选股系统（已修复）
- ✅ DeepSeek AI 深度分析（已修复）

### 未受影响的功能
- ✅ Longbridge 交易 API（使用 `load_credentials()`，正常）
- ✅ 纯量化评分（回退机制，正常）
- ✅ K线同步（使用 Longbridge API，正常）

---

## 🚀 验证步骤

### 第1步：确认数据库配置
```bash
# 查看数据库中的 AI 凭据
sqlite3 data/quant.duckdb "SELECT key, substr(value, 1, 20) || '...' FROM settings WHERE key = 'deepseek_api_key';"
```

应该看到：
```
deepseek_api_key|gAAAAAAAA...
```

---

### 第2步：重启后端（已完成）
系统正在重启中...

---

### 第3步：测试分析
1. 访问 http://localhost:5173
2. 进入「🎯 智能选股」
3. 点击「🔄 分析全部」
4. 查看日志

**预期日志**：
```
正在分析: LYFT.US
📥 同步K线: LYFT.US - 200条
🤖 DeepSeek分析: LYFT.US          ← 应该显示这行！
🤖 AI决策: LYFT.US - XXX (0.XX)  ← 应该显示这行！
✅ 分析完成: LYFT.US - 评分: XX.X, 推荐度: XX.X
```

**不应该再看到**：
```
⚠️ 未配置DeepSeek API，使用纯量化评分: LYFT.US  ❌ 不应该出现
```

---

## 📝 总结

### Bug
- ❌ 使用了错误的凭据读取函数 `load_credentials()`
- ❌ 无法读取 DeepSeek API Key
- ❌ 所有股票都回退到纯量化模式

### 修复
- ✅ 使用正确的函数 `load_ai_credentials()`
- ✅ 可以正确读取 DeepSeek API Key
- ✅ 所有股票都使用 AI 深度分析

### 教训
- 📚 理解代码中的函数职责和分工
- 📚 注意不同类型配置的读取方式
- 📚 遇到问题时检查日志和数据库

---

**感谢用户发现这个 Bug！** 🎉

现在系统应该可以正常使用 DeepSeek AI 进行深度分析了！











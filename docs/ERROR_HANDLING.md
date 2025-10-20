# 错误处理与用户友好提示

## 概述

本文档说明了系统的错误处理机制，确保用户能获得清晰、可操作的错误提示。

## 后端错误处理

### 1. 结构化错误响应

所有 API 错误现在返回结构化的 JSON 格式：

```json
{
  "error": "api_error",
  "error_code": "401003",
  "message": "ACCESS_TOKEN 已过期",
  "solution": "请访问 Longbridge 开放平台重新获取 ACCESS_TOKEN",
  "steps": [
    "1. 访问 https://open.longbridgeapp.com/",
    "2. 登录并进入「应用管理」",
    "3. 找到你的应用并重新生成 ACCESS_TOKEN",
    "4. 确保选择「长期 Token」类型",
    "5. 复制新的 TOKEN 并更新到系统"
  ],
  "platform_url": "https://open.longbridgeapp.com/",
  "raw_error": "OpenApiException: (code=401003, trace_id=xxx) token expired"
}
```

### 2. 错误类型与代码

| 错误代码 | 说明 | HTTP 状态码 |
|---------|------|------------|
| `401001` | ACCESS_TOKEN 无效 | 502 |
| `401002` | APP_KEY 或 APP_SECRET 无效 | 502 |
| `401003` | ACCESS_TOKEN 已过期 | 502 |
| `network` | 网络连接失败 | 502 |
| `dependency_missing` | Longbridge SDK 未安装 | 503 |
| `invalid_input` | 凭据不完整 | 400 |
| `save_failed` | 保存失败 | 500 |

### 3. 实现位置

- **路由层**：`backend/app/routers/settings.py`
  - `/settings/verify` - 凭据验证
  - `/settings/credentials` - 保存凭据

### 4. 错误解析逻辑

```python
# 提取错误代码
if "code=" in error_msg:
    error_code = error_msg.split("code=")[1].split(",")[0].strip()

# 根据错误代码提供友好提示
if error_code == "401003":
    return {
        "message": "ACCESS_TOKEN 已过期",
        "solution": "请访问 Longbridge 开放平台重新获取 ACCESS_TOKEN",
        "steps": [...],
        "platform_url": "https://open.longbridgeapp.com/"
    }
```

## 前端错误处理

### 1. APIError 类

```typescript
export class APIError extends Error {
  status: number;
  errorCode?: string;
  solution?: string;
  steps?: string[];
  platformUrl?: string;
  rawError?: string;
}
```

### 2. ErrorDialog 组件

提供友好的错误对话框，包含：
- ✅ 主要错误信息
- ✅ 解决方案
- ✅ 操作步骤
- ✅ 平台链接（可直接打开）
- ✅ 技术详情（可复制）

**使用示例：**

```tsx
const [errorDialog, setErrorDialog] = useState<{ 
  open: boolean; 
  error: Error | APIError | null; 
  title?: string 
}>({ open: false, error: null });

// 捕获错误时
catch (error) {
  if (error instanceof APIError || error instanceof Error) {
    setErrorDialog({
      open: true,
      error,
      title: "操作失败"
    });
  }
}

// 渲染
<ErrorDialog
  open={errorDialog.open}
  error={errorDialog.error}
  title={errorDialog.title}
  onClose={() => setErrorDialog({ open: false, error: null })}
/>
```

### 3. 错误显示效果

![错误对话框示例](error-dialog-example.png)

- **错误代码标签**：显示具体错误代码
- **主要信息**：大字突出显示错误原因
- **解决方案**：提供具体的解决建议
- **操作步骤**：分步骤指导用户解决问题
- **快捷链接**：直接跳转到相关平台
- **技术详情**：可复制给技术支持的完整错误信息

## 常见错误场景

### 场景 1：ACCESS_TOKEN 过期

**用户看到：**
```
❌ ACCESS_TOKEN 已过期

解决方案：
请访问 Longbridge 开放平台重新获取 ACCESS_TOKEN

操作步骤：
1. 访问 https://open.longbridgeapp.com/
2. 登录并进入「应用管理」
3. 找到你的应用并重新生成 ACCESS_TOKEN
4. 确保选择「长期 Token」类型
5. 复制新的 TOKEN 并更新到系统

[打开 Longbridge 开放平台 →]
```

### 场景 2：凭据不完整

**用户看到：**
```
❌ 凭据不完整

解决方案：
请确保 APP_KEY、APP_SECRET 和 ACCESS_TOKEN 都已填写

缺失字段：
- LONGPORT_ACCESS_TOKEN
```

### 场景 3：网络连接失败

**用户看到：**
```
❌ 网络连接失败

解决方案：
请检查网络连接是否正常

操作步骤：
1. 检查是否能访问 https://openapi.longbridgeapp.com/
2. 检查防火墙或代理设置
3. 如果在中国大陆，可能需要配置网络代理
```

## 扩展新的错误类型

### 后端添加

在 `backend/app/routers/settings.py` 中：

```python
elif error_code == "NEW_CODE" or "keyword" in error_msg.lower():
    error_details.update({
        "message": "友好的错误提示",
        "solution": "建议的解决方案",
        "steps": [
            "1. 第一步",
            "2. 第二步",
            "3. 第三步"
        ],
        "platform_url": "相关帮助页面URL"  # 可选
    })
```

### 前端使用

ErrorDialog 组件会自动解析并显示新的错误信息，无需修改前端代码。

## 测试

### 1. 手动测试

```bash
# 测试 TOKEN 过期错误
curl -X POST http://localhost:8000/settings/verify \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL.US"]}'

# 测试凭据不完整错误
curl -X PUT http://localhost:8000/settings/credentials \
  -H "Content-Type: application/json" \
  -d '{"LONGPORT_APP_KEY": ""}'
```

### 2. 前端测试

1. 访问 http://localhost:5173
2. 进入「基础配置」
3. 输入无效凭据并点击「验证」
4. 查看错误对话框是否显示完整信息

## 最佳实践

### ✅ 应该做的

1. **明确错误原因**：告诉用户具体出了什么问题
2. **提供解决方案**：给出可操作的步骤
3. **保留技术详情**：方便技术支持排查
4. **提供快捷链接**：减少用户操作步骤

### ❌ 不应该做的

1. ~~只显示 "操作失败"~~
2. ~~只显示技术错误信息~~
3. ~~不提供任何解决建议~~
4. ~~使用专业术语而不解释~~

## 日志记录

所有错误都会在后端日志中记录：

```
ERROR:app.routers.monitoring:Error getting monitored positions: OpenApiException: (code=401003, trace_id=xxx) token expired
```

查看日志：
```bash
tail -f logs/backend.log | grep ERROR
```

## 商业化建议

对于商业产品，还可以添加：

1. **在线客服**：错误对话框中添加「联系客服」按钮
2. **自动工单**：一键创建支持工单并附带错误详情
3. **视频教程**：针对常见错误提供视频指导
4. **知识库链接**：链接到详细的帮助文档
5. **错误统计**：收集错误频率，优先优化常见问题

## 更新记录

- 2025-01-20：初始版本，支持 Longbridge API 错误友好提示
- 支持错误代码：401001, 401002, 401003, network errors


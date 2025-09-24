@echo off
REM Longbridge Quant Console 停止脚本 (Windows)
REM 使用方法：stop.bat

echo 🛑 停止 Longbridge Quant Console...
echo ================================================

REM 停止后端进程
:stop_backend
echo 📊 停止后端服务...

REM 查找并停止 uvicorn 进程
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo csv ^| findstr uvicorn') do (
    echo    停止进程 PID: %%i
    taskkill /PID %%i /F >nul 2>&1
)

REM 也可以通过命令行参数查找
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" >nul 2>&1

REM 检查端口8000占用情况
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  端口 8000 仍被占用，尝试强制释放...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        taskkill /PID %%p /F >nul 2>&1
    )
) else (
    echo ✅ 后端服务已停止
)

REM 停止前端进程
:stop_frontend
echo 🎨 停止前端服务...

REM 查找并停止 Node.js 相关进程
tasklist | findstr "node.exe" >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr node') do (
        echo    停止进程 PID: %%i
        taskkill /PID %%i /F >nul 2>&1
    )
)

REM 检查端口5173占用情况
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  端口 5173 仍被占用，尝试强制释放...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
        taskkill /PID %%p /F >nul 2>&1
    )
) else (
    echo ✅ 前端服务已停止
)

REM 清理临时文件
:cleanup_temp
echo 🧹 清理临时文件...

REM 清理 Python 缓存
if exist "backend\__pycache__" rmdir /S /Q "backend\__pycache__" >nul 2>&1
for /r backend %%d in (__pycache__) do if exist "%%d" rmdir /S /Q "%%d" >nul 2>&1

REM 清理 .pyc 文件
for /r backend %%f in (*.pyc) do if exist "%%f" del "%%f" >nul 2>&1

REM 清理日志文件（如果指定参数）
if "%1"=="--clean-logs" (
    echo    清理日志文件...
    if exist "logs\backend.log" del "logs\backend.log" >nul 2>&1
    if exist "logs\frontend.log" del "logs\frontend.log" >nul 2>&1
)

echo ✅ 临时文件清理完成

REM 检查服务状态
:check_status
echo.
echo 📊 服务状态检查:
echo ================================================

REM 检查后端服务
curl -s http://localhost:8000/health >nul 2>&1
if not errorlevel 1 (
    echo ❌ 后端服务仍在运行: http://localhost:8000
) else (
    echo ✅ 后端服务已停止
)

REM 检查前端服务
curl -s http://localhost:5173 >nul 2>&1
if not errorlevel 1 (
    echo ❌ 前端服务仍在运行: http://localhost:5173
) else (
    echo ✅ 前端服务已停止
)

echo.
echo 🎉 Longbridge Quant Console 已完全停止
echo ================================================
echo.
echo 💡 重新启动请运行: start.bat
echo 🧹 完全清理请运行: stop.bat --clean-logs
echo.

REM 显示帮助信息
if "%1"=="--help" (
    echo 用法: stop.bat [选项]
    echo.
    echo 选项:
    echo   --clean-logs    同时清理日志文件
    echo   --help         显示此帮助信息
    echo.
    echo 示例:
    echo   stop.bat                # 停止所有服务
    echo   stop.bat --clean-logs   # 停止服务并清理日志
    echo.
)

pause
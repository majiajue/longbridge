@echo off
REM Longbridge Quant Console 启动脚本 (Windows)
REM 使用方法：start.bat

setlocal EnableDelayedExpansion

echo 🚀 启动 Longbridge Quant Console...
echo ================================================

REM 检查系统环境
:check_requirements
echo 📋 检查系统环境...

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Python
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo ✅ %%i

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Node.js
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js %%i

REM 检查 npm
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 npm
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do echo ✅ npm %%i

echo.

REM 检查后端环境
:check_backend
echo 📊 检查后端环境...

if not exist "backend\.venv" (
    echo ❌ 错误: 未找到虚拟环境，请先运行: python -m venv backend\.venv
    pause
    exit /b 1
)
echo ✅ 虚拟环境存在

if not exist "backend\.env" (
    echo ⚠️  警告: 未找到 .env 配置文件，请配置 Longbridge API 凭据
) else (
    echo ✅ 环境配置文件存在
)

echo.

REM 检查前端环境
:check_frontend
echo 🎨 检查前端环境...

if not exist "frontend\node_modules" (
    echo ⚠️  警告: 未找到 node_modules，将自动安装依赖...
    cd frontend
    call npm install
    cd ..
) else (
    echo ✅ 前端依赖已安装
)

echo.

REM 创建日志目录
if not exist "logs" mkdir logs

REM 启动后端服务
:start_backend
echo 📊 启动后端服务器...
cd backend

REM 激活虚拟环境
call .venv\Scripts\activate

REM 检查端口占用
netstat -an | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  端口 8000 已被占用，请手动停止占用进程
)

REM 启动后端服务（后台运行）
echo 🔄 启动 FastAPI 服务器...
start /B cmd /c "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ..\logs\backend.log 2>&1"

REM 等待服务启动
echo ⏳ 等待后端服务启动...
timeout /t 10 /nobreak >nul

REM 检查后端是否启动成功
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo ❌ 后端服务启动失败，请检查日志: logs\backend.log
    pause
    exit /b 1
)
echo ✅ 后端服务启动成功

cd ..

REM 启动前端服务
:start_frontend
echo 🎨 启动前端界面...
cd frontend

REM 检查端口占用
netstat -an | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  端口 5173 已被占用，请手动停止占用进程
)

REM 设置后端地址
set VITE_API_BASE=http://127.0.0.1:8000

REM 启动前端服务（后台运行）
echo 🔄 启动 Vite 开发服务器...
start /B cmd /c "npm run dev > ..\logs\frontend.log 2>&1"

REM 等待服务启动
echo ⏳ 等待前端服务启动...
timeout /t 15 /nobreak >nul

REM 检查前端是否启动成功
curl -s http://localhost:5173 >nul 2>&1
if errorlevel 1 (
    echo ❌ 前端服务启动失败，请检查日志: logs\frontend.log
    pause
    exit /b 1
)
echo ✅ 前端服务启动成功

cd ..

REM 显示启动信息
:show_info
echo.
echo 🎉 系统启动完成！
echo ================================================
echo 📊 后端服务: http://localhost:8000
echo 🎨 前端界面: http://localhost:5173
echo 📖 API文档: http://localhost:8000/docs
echo ❤️  健康检查: http://localhost:8000/health
echo.
echo 💡 使用说明:
echo 1. 打开浏览器访问 http://localhost:5173
echo 2. 进入「基础配置」页面配置 Longbridge API 凭据
echo 3. 添加要监控的股票代码
echo 4. 查看「信号分析」页面获取智能交易建议
echo.
echo 📝 日志文件:
echo    后端: logs\backend.log
echo    前端: logs\frontend.log
echo.
echo 🛑 停止服务: 运行 stop.bat 或按 Ctrl+C
echo ================================================
echo.

REM 自动打开浏览器（可选）
echo 🌐 自动打开浏览器？ (Y/N)
choice /C YN /T 10 /D N /M "10秒内选择，默认不打开: "
if !errorlevel! EQU 1 (
    echo 🌐 正在打开浏览器...
    start http://localhost:5173
)

echo.
echo 🔄 服务正在后台运行...
echo 💡 可以最小化此窗口，但请不要关闭
echo 🛑 需要停止服务时请运行 stop.bat
echo.

REM 保持窗口打开
:keep_running
timeout /t 30 /nobreak >nul
echo [%date% %time%] 系统运行正常...
goto keep_running

pause
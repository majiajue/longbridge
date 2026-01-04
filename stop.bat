@echo off
REM Longbridge Quant Console stop script (Windows)
REM Usage: stop.bat [--clean-logs] [--help]

setlocal EnableExtensions

echo Stopping Longbridge Quant Console...
echo ================================================

echo Stopping backend...

for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo csv ^| findstr uvicorn') do (
    echo   Stopping PID: %%i
    taskkill /PID %%i /F >nul 2>&1
)

taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" >nul 2>&1

netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo WARN: Port 8000 still in use. Forcing release...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
        taskkill /PID %%p /F >nul 2>&1
    )
) else (
    echo OK: backend stopped
)

echo.
echo Stopping frontend...

tasklist | findstr "node.exe" >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr node') do (
        echo   Stopping PID: %%i
        taskkill /PID %%i /F >nul 2>&1
    )
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo WARN: Port 5173 still in use. Forcing release...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
        taskkill /PID %%p /F >nul 2>&1
    )
) else (
    echo OK: frontend stopped
)

echo.
echo Cleaning temp files...

if exist "backend\__pycache__" rmdir /S /Q "backend\__pycache__" >nul 2>&1
for /r backend %%d in (__pycache__) do if exist "%%d" rmdir /S /Q "%%d" >nul 2>&1
for /r backend %%f in (*.pyc) do if exist "%%f" del "%%f" >nul 2>&1

if "%1"=="--clean-logs" (
    echo   Cleaning logs...
    if exist "logs\backend.log" del "logs\backend.log" >nul 2>&1
    if exist "logs\frontend.log" del "logs\frontend.log" >nul 2>&1
)

echo OK: cleaned

echo.
echo Service status:
echo ================================================

call :check_url "http://localhost:8000/health"
if not errorlevel 1 (
    echo ERROR: backend still running: http://localhost:8000
) else (
    echo OK: backend stopped
)

call :check_url "http://localhost:5173"
if not errorlevel 1 (
    echo ERROR: frontend still running: http://localhost:5173
) else (
    echo OK: frontend stopped
)

echo.
echo Longbridge Quant Console stopped.
echo ================================================
echo Restart:   start.bat
echo Clean logs: stop.bat --clean-logs
echo.

if "%1"=="--help" (
    echo Usage: stop.bat [options]
    echo.
    echo Options:
    echo   --clean-logs    Also delete logs\backend.log and logs\frontend.log
    echo   --help         Show this help
    echo.
)

pause
exit /b 0

REM ---------------------------------------------------------------------------
REM Helpers

:check_url
set "URL=%~1"
where curl >nul 2>&1
if not errorlevel 1 (
    curl -fsS "%URL%" >nul 2>&1
    exit /b %errorlevel%
)
powershell -NoProfile -Command "param([string]$u) try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $u | Out-Null; exit 0 } catch { exit 1 }" "%URL%" >nul 2>&1
exit /b %errorlevel%

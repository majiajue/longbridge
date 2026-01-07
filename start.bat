@echo off
REM Longbridge Quant Console start script (Windows)
REM Usage: start.bat

setlocal EnableExtensions

echo Starting Longbridge Quant Console...
echo ================================================

call :check_requirements || goto fail
call :check_backend || goto fail
call :check_frontend || goto fail

if not exist "logs" mkdir logs

call :start_backend || goto fail
call :start_frontend || goto fail

call :show_info
call :maybe_open_browser
call :keep_running
exit /b 0

:fail
echo.
echo ERROR: Startup failed. See logs\backend.log and logs\frontend.log
echo.
pause
exit /b 1

REM ---------------------------------------------------------------------------
REM Checks

:check_requirements
echo Checking requirements...

echo - Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python not found
  exit /b 1
)
set "PY_VERSION="
for /f "delims=" %%i in ('python --version') do set "PY_VERSION=%%i"
if not defined PY_VERSION (
  echo ERROR: Failed to read Python version
  exit /b 1
)
echo OK: %PY_VERSION%

echo - Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found
  exit /b 1
)
set "NODE_VERSION="
for /f "delims=" %%i in ('node --version') do set "NODE_VERSION=%%i"
if not defined NODE_VERSION (
  echo ERROR: Failed to read Node.js version
  exit /b 1
)
echo OK: Node.js %NODE_VERSION%

echo - Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found in PATH
  exit /b 1
)
set "NPM_VERSION="
for /f "delims=" %%i in ('npm --version') do set "NPM_VERSION=%%i"
if not defined NPM_VERSION (
  echo ERROR: Failed to read npm version. Try running: npm --version
  exit /b 1
)
echo OK: npm %NPM_VERSION%

echo.
exit /b 0

:check_backend
echo Checking backend...

if not exist "backend\.venv" (
  echo WARN: venv missing. Creating: backend\.venv
  python -m venv backend\.venv
  if errorlevel 1 (
    echo ERROR: Failed to create venv (python -m venv backend\.venv)
    exit /b 1
  )
)
echo OK: venv exists

if not exist "backend\.env" (
  echo WARN: backend\.env missing. Configure Longbridge API credentials.
) else (
  echo OK: backend\.env exists
)

set "NEED_BACKEND_DEPS=1"
if exist "backend\.venv\.deps_installed" (
  where powershell >nul 2>&1
  if not errorlevel 1 (
    powershell -NoProfile -Command "if ((Get-Item 'backend\\pyproject.toml').LastWriteTime -le (Get-Item 'backend\\.venv\\.deps_installed').LastWriteTime) { exit 0 } else { exit 1 }" >nul 2>&1
    if not errorlevel 1 set "NEED_BACKEND_DEPS=0"
  )
)

if "%NEED_BACKEND_DEPS%"=="1" (
  echo - Installing backend dependencies...
  pushd backend
  call .venv\Scripts\python.exe -m pip install -U pip
  if errorlevel 1 (
    popd
    echo ERROR: Failed to upgrade pip
    exit /b 1
  )

  call .venv\Scripts\python.exe -m pip install -e .
  if errorlevel 1 (
    if exist "requirements.txt" (
      echo WARN: Editable install failed; trying requirements.txt
      call .venv\Scripts\python.exe -m pip install -r requirements.txt
      if errorlevel 1 (
        popd
        echo ERROR: Failed to install backend dependencies
        exit /b 1
      )
    ) else (
      popd
      echo ERROR: Failed to install backend dependencies (no requirements.txt fallback)
      exit /b 1
    )
  )

  type nul > .venv\.deps_installed
  popd
  echo OK: backend dependencies installed
)

echo.
exit /b 0

:check_frontend
echo Checking frontend...

if not exist "frontend\node_modules" (
  echo WARN: frontend\node_modules missing. Installing dependencies...
  pushd frontend
  call npm install
  if errorlevel 1 (
    popd
    echo ERROR: npm install failed
    exit /b 1
  )
  popd
) else (
  echo OK: frontend dependencies installed
)

echo.
exit /b 0

REM ---------------------------------------------------------------------------
REM Start services

:start_backend
echo Starting backend...

call :free_port 8000
pushd backend
call .venv\Scripts\activate.bat

start /B cmd /c "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ..\logs\backend.log 2>&1"
popd

echo Waiting for backend...
call :wait_url "http://localhost:8000/health" 15
if errorlevel 1 (
  echo ERROR: Backend did not become ready.
  exit /b 1
)
echo OK: backend started
echo.
exit /b 0

:start_frontend
echo Starting frontend...

call :free_port 5173
pushd frontend
set VITE_API_BASE=http://127.0.0.1:8000
start /B cmd /c "npm run dev > ..\logs\frontend.log 2>&1"
popd

echo Waiting for frontend...
call :wait_url "http://localhost:5173" 15
if errorlevel 1 (
  echo ERROR: Frontend did not become ready.
  exit /b 1
)
echo OK: frontend started
echo.
exit /b 0

REM ---------------------------------------------------------------------------
REM UI

:show_info
echo System started!
echo ================================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API docs: http://localhost:8000/docs
echo Health:   http://localhost:8000/health
echo.
echo Logs:
echo   Backend:  logs\backend.log
echo   Frontend: logs\frontend.log
echo.
echo Stop: run stop.bat
echo ================================================
echo.
exit /b 0

:maybe_open_browser
choice /C YN /T 10 /D N /M "Open browser? (Y/N) "
if errorlevel 2 exit /b 0
start http://localhost:5173
exit /b 0

:keep_running
echo Services are running in background...
echo You can minimize this window, but do not close it.
echo To stop services, run stop.bat
echo.

:keep_running_loop
timeout /t 30 /nobreak >nul
echo [%date% %time%] OK
goto keep_running_loop

REM ---------------------------------------------------------------------------
REM Helpers

:free_port
set "PORT=%~1"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
)
exit /b 0

:wait_url
set "URL=%~1"
set "RETRIES=%~2"
set /a i=1
:wait_url_loop
call :check_url "%URL%"
if not errorlevel 1 exit /b 0
if %i% GEQ %RETRIES% exit /b 1
set /a i+=1
timeout /t 1 /nobreak >nul
goto wait_url_loop

:check_url
set "URL=%~1"
where curl >nul 2>&1
if not errorlevel 1 (
  curl -fsS "%URL%" >nul 2>&1
  exit /b %errorlevel%
)
powershell -NoProfile -Command "param([string]$u) try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $u | Out-Null; exit 0 } catch { exit 1 }" "%URL%" >nul 2>&1
exit /b %errorlevel%

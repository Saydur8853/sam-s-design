@echo off
setlocal
title sameulshajid.art Launcher
cd /d "%~dp0"

echo.
echo  ========================================
echo       sameulshajid.art - Starting
echo  ========================================
echo.

echo [0/5] Stopping servers from the previous launcher run...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\stop-dev-servers.ps1"
taskkill /FI "WINDOWTITLE eq sameulshajid.art - Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq sameulshajid.art - Frontend*" /T /F >nul 2>&1
ping 127.0.0.1 -n 2 >nul

if not exist ".venv\Scripts\python.exe" (
    echo [1/5] Creating Python environment...
    py -m venv .venv
    if errorlevel 1 goto :error
) else (
    echo [1/5] Python environment is ready.
)

".venv\Scripts\python.exe" -c "import django, rest_framework" >nul 2>&1
if errorlevel 1 (
    echo [2/5] Installing backend dependencies...
    ".venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
    if errorlevel 1 goto :error
) else (
    echo [2/5] Backend dependencies are ready.
)

if not exist "frontend\node_modules\.bin\ng.cmd" (
    echo [3/5] Installing frontend dependencies...
    pushd frontend
    call npm install
    if errorlevel 1 (
        popd
        goto :error
    )
    popd
) else (
    echo [3/5] Frontend dependencies are ready.
)

rem npm on Windows can record optional native packages without extracting them.
rem Verify the bindings with the project's pinned Node runtime and self-repair if needed.
set "FRONTEND_NODE=%CD%\frontend\node_modules\node\bin\node.exe"
if not exist "%FRONTEND_NODE%" (
    echo Project-local Node runtime is missing.
    goto :error
)

for %%I in (npm.cmd) do set "NPM_COMMAND=%%~$PATH:I"
if not defined NPM_COMMAND (
    echo npm.cmd was not found in PATH.
    goto :error
)
for %%I in ("%NPM_COMMAND%") do set "NPM_HOME=%%~dpI"
set "NPM_CLI=%NPM_HOME%node_modules\npm\bin\npm-cli.js"

pushd frontend
"%FRONTEND_NODE%" -e "require('@oxc-parser/binding-win32-x64-msvc'); require('@rolldown/binding-win32-x64-msvc')" >nul 2>&1
if errorlevel 1 (
    echo       Repairing missing Angular native bindings...
    "%FRONTEND_NODE%" "%NPM_CLI%" install --force
    if errorlevel 1 (
        popd
        goto :error
    )
    "%FRONTEND_NODE%" -e "require('@oxc-parser/binding-win32-x64-msvc'); require('@rolldown/binding-win32-x64-msvc')" >nul 2>&1
    if errorlevel 1 (
        popd
        goto :error
    )
)
popd

echo [4/5] Applying database migrations...
".venv\Scripts\python.exe" "backend\manage.py" migrate --noinput
if errorlevel 1 goto :error
".venv\Scripts\python.exe" "backend\manage.py" seed_demo_data --if-empty
if errorlevel 1 goto :error

if /i "%~1"=="--check" (
    echo Launcher check completed successfully.
    exit /b 0
)

echo [5/5] Opening development servers...
start "sameulshajid.art - Backend" cmd /k ".venv\Scripts\python.exe backend\manage.py runserver"
start "sameulshajid.art - Frontend" cmd /k "cd frontend && node_modules\node\bin\node.exe node_modules\@angular\cli\bin\ng.js serve --proxy-config proxy.conf.json"

echo.
echo Backend:  http://127.0.0.1:8000
echo Website:  http://localhost:4200
echo API Docs: http://127.0.0.1:8000/api/docs/
echo.
echo Two server windows were opened. Close them or press Ctrl+C in each to stop.
echo Waiting for the frontend before opening the browser...
set /a FRONTEND_ATTEMPTS=0

:wait_for_frontend
curl.exe --silent --fail "http://localhost:4200/" >nul 2>&1
if not errorlevel 1 goto :open_frontend
set /a FRONTEND_ATTEMPTS+=1
if %FRONTEND_ATTEMPTS% GEQ 30 goto :frontend_timeout
ping 127.0.0.1 -n 2 >nul
goto :wait_for_frontend

:open_frontend
start "" "http://localhost:4200"
exit /b 0

:frontend_timeout
echo Frontend did not answer within 30 seconds. Check the frontend server window.
pause
exit /b 1

:error
echo.
echo Setup could not be completed. Review the error above.
echo.
pause
exit /b 1


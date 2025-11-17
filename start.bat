@echo off
echo.
echo ============================
echo    周历应用启动器 v1.0.6
echo ============================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found
    pause
    exit /b 1
)

netstat -ano | findstr ":8080" >nul
if %errorlevel% equ 0 (
    echo Port 8080 in use, using 8081
    set PORT=8081
) else (
    set PORT=8080
)

echo Starting HTTP server on port %PORT%
start "Weekly Calendar Server" python -m http.server %PORT%

echo Waiting for server to start...
ping -n 3 127.0.0.1 >nul

echo Opening browser...
start http://localhost:%PORT%

echo.
echo SUCCESS: Application started!
echo.
pause
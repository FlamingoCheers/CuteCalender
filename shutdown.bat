@echo off
setlocal enabledelayedexpansion

title Weekly Calendar - Complete Shutdown
color 4F

echo.
echo ========================================
echo    Weekly Calendar - Process Shutdown
echo ========================================
echo.

set "success_count=0"
set "fail_count=0"

echo [INFO] Starting process termination...
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Running without administrator privileges
    echo [WARNING] Some processes may not be terminable
    echo.
)

REM Terminate Python processes
echo [PROCESS] Terminating Python processes...
taskkill /IM python.exe /F >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Python processes terminated
    set /a success_count+=1
) else (
    echo [INFO] No Python processes found
)

REM Terminate Node.js processes
echo [PROCESS] Terminating Node.js processes...
taskkill /IM node.exe /F >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Node.js processes terminated
    set /a success_count+=1
) else (
    echo [INFO] No Node.js processes found
)

REM Terminate CMD processes (with confirmation)
echo [PROCESS] Terminating project CMD windows...
for /f "tokens=2" %%a in ('tasklist ^| findstr "cmd.exe"') do (
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo [SUCCESS] CMD process %%a terminated
        set /a success_count+=1
    )
)

REM Clean up port 8080
echo [PROCESS] Cleaning up port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080"') do (
    if not "%%a"=="0" (
        taskkill /PID %%a /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [SUCCESS] Port 8080 cleared (PID: %%a)
            set /a success_count+=1
        ) else (
            echo [FAILED] Could not clear port 8080 (PID: %%a)
            set /a fail_count+=1
        )
    )
)

REM Clean up port 8081
echo [PROCESS] Cleaning up port 8081...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081"') do (
    if not "%%a"=="0" (
        taskkill /PID %%a /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [SUCCESS] Port 8081 cleared (PID: %%a)
            set /a success_count+=1
        ) else (
            echo [FAILED] Could not clear port 8081 (PID: %%a)
            set /a fail_count+=1
        )
    )
)

REM Clean up other common ports
echo [PROCESS] Cleaning up other development ports...
for %%p in (3000 3306 6379 27017) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p"') do (
        if not "%%a"=="0" (
            taskkill /PID %%a /F >nul 2>&1
            echo [INFO] Port %%p cleared
            set /a success_count+=1
        )
    )
)

echo.
echo ========================================
echo [RESULTS]
echo ========================================
echo   Successful operations: %success_count%
echo   Failed operations: %fail_count%
echo.

if %fail_count% gtr 0 (
    echo [WARNING] Some processes could not be terminated
    echo [INFO] Try running as administrator if needed
) else (
    echo [SUCCESS] All project processes have been terminated
)

echo.
echo [INFO] Shutdown complete
echo.
timeout /t 3 >nul
endlocal
exit /b 0
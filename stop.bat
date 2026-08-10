@echo off
chcp 65001 >nul 2>&1
title 运维工作平台 - 停止

echo ========================================
echo   停止运维工作平台服务...
echo ========================================
echo.

:: 停止后端进程（匹配 uvicorn / app.main）
echo [1/2] 停止后端服务...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
    echo       已终止后端进程 PID: %%a
)

:: 停止前端进程（匹配 vite / node）
echo [2/2] 停止前端服务...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
    echo       已终止前端进程 PID: %%a
)

:: 兜底：按进程名匹配
taskkill /im python.exe /fi "WINDOWTITLE eq OpsPlatform-Backend*" /f >nul 2>&1
taskkill /im node.exe /fi "WINDOWTITLE eq OpsPlatform-Frontend*" /f >nul 2>&1

echo.
echo ========================================
echo   所有服务已停止
echo ========================================
echo.
pause

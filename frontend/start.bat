@echo off
chcp 65001 >nul 2>&1
title 运维工作平台 - 前端

:: 获取脚本所在目录
set "FRONTEND_DIR=%~dp0"

cd /d "%FRONTEND_DIR%"

:: 检查 node_modules
if not exist "node_modules" (
    echo [信息] 首次运行，安装依赖中...
    call npm install --registry https://registry.npmmirror.com
)

echo.
echo ========================================
echo   前端服务启动中...
echo   页面地址:  http://localhost:5173
echo   按 Ctrl+C 停止
echo ========================================
echo.

call npm run dev

pause

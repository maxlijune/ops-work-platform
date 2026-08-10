@echo off
chcp 65001 >nul 2>&1
title 运维工作平台 - 启动

echo ========================================
echo   运维工作平台 (Ops Work Platform)
echo ========================================
echo.

:: 获取脚本所在目录
set "BASE_DIR=%~dp0"

:: ========================================
:: 1. 检查 Python 环境
:: ========================================
echo [1/4] 检查 Python 环境...
where python >nul 2>&1
if %errorlevel%==0 (
    set "PYTHON_CMD=python"
) else (
    where py >nul 2>&1
    if %errorlevel%==0 (
        set "PYTHON_CMD=py"
    ) else (
        echo [错误] 未找到 Python，请先安装 Python 3.10+
        echo        下载地址: https://www.python.org/downloads/
        pause
        exit /b 1
    )
)
echo       Python: %PYTHON_CMD%

:: ========================================
:: 2. 检查 Node.js 环境
:: ========================================
echo [2/4] 检查 Node.js 环境...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 npm，请先安装 Node.js 16+
    echo        下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo       npm: 已安装

:: ========================================
:: 3. 检查后端依赖
:: ========================================
echo [3/4] 检查后端依赖...
if not exist "%BASE_DIR%backend\venv" (
    echo       首次运行，创建虚拟环境...
    cd /d "%BASE_DIR%backend"
    %PYTHON_CMD% -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    cd /d "%BASE_DIR%"
) else (
    echo       虚拟环境已存在
)

:: ========================================
:: 4. 检查前端依赖
:: ========================================
echo [4/4] 检查前端依赖...
if not exist "%BASE_DIR%frontend\node_modules" (
    echo       首次运行，安装前端依赖（可能需要几分钟）...
    cd /d "%BASE_DIR%frontend"
    call npm install --registry https://registry.npmmirror.com
    cd /d "%BASE_DIR%"
) else (
    echo       前端依赖已安装
)

echo.
echo ========================================
echo   正在启动服务...
echo ========================================

:: ========================================
:: 启动后端（新窗口）
:: ========================================
echo.
echo [1/2] 启动后端服务 (端口 8000)...
start "OpsPlatform-Backend" cmd /k "cd /d "%BASE_DIR%backend" && call venv\Scripts\activate.bat && python -m app.main"

:: 等待后端启动
echo       等待后端就绪...
timeout /t 3 /nobreak >nul

:: ========================================
:: 启动前端（新窗口）
:: ========================================
echo [2/2] 启动前端服务 (端口 5173)...
start "OpsPlatform-Frontend" cmd /k "cd /d "%BASE_DIR%frontend" && npm run dev"

:: 等待前端启动
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   平台已启动！
echo ========================================
echo.
echo   前端页面:  http://localhost:5173
echo   后端API:   http://localhost:8000
echo   API文档:   http://localhost:8000/docs
echo.
echo   后端窗口:  OpsPlatform-Backend
echo   前端窗口:  OpsPlatform-Frontend
echo.
echo   停止平台:  关闭上述两个窗口
echo              或运行 stop.bat
echo ========================================

:: 尝试自动打开浏览器
timeout /t 1 /nobreak >nul
start http://localhost:5173

echo.
echo 按任意键关闭此启动窗口（服务继续运行）...
pause >nul

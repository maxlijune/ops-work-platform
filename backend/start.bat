@echo off
chcp 65001 >nul 2>&1
title 运维工作平台 - 后端

:: 获取脚本所在目录
set "BACKEND_DIR=%~dp0"

cd /d "%BACKEND_DIR%"

:: 检查虚拟环境
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo [信息] 已激活虚拟环境
) else (
    echo [提示] 未找到虚拟环境，使用系统 Python
)

:: 检查依赖
python -c "import fastapi" >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 缺少依赖，正在安装...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
)

echo.
echo ========================================
echo   后端服务启动中...
echo   API 地址:  http://localhost:8000
echo   文档地址:  http://localhost:8000/docs
echo   按 Ctrl+C 停止
echo ========================================
echo.

python -m app.main

pause

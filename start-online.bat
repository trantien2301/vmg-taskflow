@echo off
title TaskFlow Pro - Online Cloudflare Tunnel
color 0B
echo ========================================================
echo        TASKFLOW PRO - KHOI CHAY ONLINE INTERNET
echo ========================================================
echo.
echo 1. Khoi dong Backend Server tai cong 3000...
start "TaskFlow Server" cmd /k "node server.js"
timeout /t 3 /nobreak >nul
echo 2. Khoi dong Cloudflare Public Tunnel...
start "TaskFlow Tunnel" cmd /k "cloudflared.exe tunnel --url http://localhost:3000 --no-autoupdate"
echo.
echo Da khoi dong he thong thanh cong!
pause

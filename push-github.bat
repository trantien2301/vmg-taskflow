@echo off
title Day Ma Nguon Len GitHub De Deploy Render
color 0A
echo ========================================================
echo        DAY MA NGUON TASKFLOW PRO LEN GITHUB
echo ========================================================
echo.
echo Buoc 1: Vao https://github.com/new de tao Repository moi (vi du dat ten la: vmg-taskflow)
echo Buoc 2: Dan link repository (dang https://github.com/ten-user/vmg-taskflow.git) vao ben duoi:
echo.
set /p REPO_URL="Nhap link GitHub repository cua ban: "

if "%REPO_URL%"=="" (
    echo Ban chua nhap link GitHub. Vui long chay lai!
    pause
    exit /b
)

echo.
echo Dang day ma nguon len GitHub...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo ========================================================
echo DA DAY CODE LEN GITHUB THANH CONG!
echo Bay gio ban chi can vao https://dashboard.render.com/select-repo?type=web
echo Chon repository vua day len va bam Deploy de hoan tat!
echo ========================================================
pause

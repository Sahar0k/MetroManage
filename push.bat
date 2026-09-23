@echo off
chcp 65001 >nul
setlocal
title MetroManage sync to GitHub

rem Батник лежит в корне проекта - путь берём от него, кириллица в коде не нужна
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=chore: sync %date% %time%"

echo [1/4] Репозиторий: %cd%
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Эта папка - не git-репозиторий.
    pause
    exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Нет remote origin. Добавьте: git remote add origin https://github.com/Sahar0k/MetroManage.git
    pause
    exit /b 1
)

echo [2/4] Изменения к отправке:
git status --short

echo [3/4] Коммит: %MSG%
git add -A
git commit -m "%MSG%"
if errorlevel 1 echo [ИНФО] Новых изменений нет - коммит пропущен.

echo [4/4] Пуш на GitHub, ветка main...
git push origin main
if errorlevel 1 (
    echo [ОШИБКА] Пуш не прошёл. Проверьте сеть и учётку: git remote -v
    pause
    exit /b 1
)

echo.
echo [ГОТОВО] Проект на GitHub: https://github.com/Sahar0k/MetroManage
endlocal
pause
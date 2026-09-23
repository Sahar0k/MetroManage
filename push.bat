@echo off
chcp 65001 >nul
setlocal
title MetroManage sync to GitHub

rem Батник лежит в корне проекта - путь берём от него, кириллица в коде не нужна
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=chore: sync %date% %time%"

echo [1/5] Репозиторий: %cd%
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

echo [2/5] Изменения к отправке:
git status --short

echo [3/5] Коммит: %MSG%
git add -A
git commit -m "%MSG%"
if errorlevel 1 echo [ИНФО] Новых изменений нет - коммит пропущен.

echo [4/5] Проверка имени ветки...
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
if /i not "%BRANCH%"=="main" (
    git show-ref --verify --quiet refs/heads/main
    if errorlevel 1 (
        echo [ИНФО] Локальная ветка "%BRANCH%" - переименовываю в main...
        git branch -m main
    ) else (
        echo [ОШИБКА] Вы на ветке "%BRANCH%", но локально уже есть main. Разберитесь вручную: git checkout main
        pause
        exit /b 1
    )
)

echo [5/5] Пуш на GitHub, ветка main...
git push -u origin main
if errorlevel 1 (
    echo [ОШИБКА] Пуш не прошёл. Проверьте сеть и учётку: git remote -v
    pause
    exit /b 1
)

echo.
echo [ГОТОВО] Проект на GitHub: https://github.com/Sahar0k/MetroManage
endlocal
pause
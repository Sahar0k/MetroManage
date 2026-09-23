@echo off
chcp 65001 >nul
title MetroManage Server (Port 3000)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$projectPath = 'D:\Projects\Метрологическая система';" ^
    "if (-not (Test-Path -LiteralPath $projectPath)) {" ^
    "    Write-Host '[ОШИБКА] Папка проекта не найдена!' -ForegroundColor Red;" ^
    "    Read-Host 'Нажмите Enter для выхода';" ^
    "    exit 1;" ^
    "};" ^
    "Set-Location -LiteralPath $projectPath;" ^
    "$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue;" ^
    "if ($busy) {" ^
    "    $pids = @();" ^
    "    foreach ($c in $busy) { if ($pids -notcontains $c.OwningProcess) { $pids += $c.OwningProcess } };" ^
    "    Write-Host ('[ИНФО] Порт 3000 занят, убиваю PID: ' + ($pids -join ', ')) -ForegroundColor Yellow;" ^
    "    foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue };" ^
    "    $i = 0;" ^
    "    while ((Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) -and $i -lt 6) { Start-Sleep -Milliseconds 500; $i++ };" ^
    "    Write-Host '[ИНФО] Порт освобождён. Перезапускаю сервер...' -ForegroundColor Green;" ^
    "} else {" ^
    "    Write-Host '[ИНФО] Порт 3000 свободен.' -ForegroundColor Green;" ^
    "};" ^
    "if (-not (Test-Path node_modules)) {" ^
    "    Write-Host '[ИНФО] Установка зависимостей...' -ForegroundColor Yellow;" ^
    "    npm install;" ^
    "};" ^
    "npm run dev -- --open"

pause
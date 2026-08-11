@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM ImmortalVoyageGame private settings backup tool.
REM This script contains file names only. Never put secret values in this file.

set "ROOT=%~dp0..\"
set "TARGET=%ROOT%_private\"

if not exist "%TARGET%" mkdir "%TARGET%"

echo ========================================
echo  ImmortalVoyageGame private backup
echo ========================================
echo Source: %ROOT%
echo Target: %TARGET%
echo.

REM ---- PRIVATE FILE WHITELIST ----
REM Add future root-level private files here using:
REM call :BackupFile "filename"
call :BackupFile ".dev.vars"
call :BackupFile ".env"
call :BackupFile ".env.local"
call :BackupFile ".env.development"
call :BackupFile ".env.production"
REM --------------------------------

echo.
echo Backup finished.
echo Only whitelisted files were copied.
echo Folder: %TARGET%
echo.
pause
exit /b 0

:BackupFile
if exist "%ROOT%%~1" (
    copy /Y "%ROOT%%~1" "%TARGET%%~1" >nul
    echo [COPIED] %~1
) else (
    echo [SKIP]   %~1
)
exit /b 0

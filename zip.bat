@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===================================================
echo   FluxSnip - Store Package Build Pipeline (.zip)
echo ===================================================
echo.

echo [1/2] Running tests (npm test)...
call npm test
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Tests failed with exit code %ERRORLEVEL%. Aborting zip packaging.
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] All unit tests passed!
echo.

echo [2/2] Building production bundle and creating ZIP (npm run zip)...
call npm run zip
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Packaging failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   Store package created successfully!
echo   Output file: .output\fluxsnip-0.1.0-chrome.zip
echo ===================================================
echo.

pause

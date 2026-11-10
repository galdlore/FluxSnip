@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===================================================
echo   FluxSnip - Store Package Build Pipeline (.zip)
echo ===================================================
echo.

REM Clean up any previous zip files in .output
if exist ".output\*.zip" (
    echo Cleaning up previous zip packages...
    del /q ".output\*.zip" >nul 2>&1
)

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

REM Find the newly generated zip file in .output
set "GENERATED_ZIP="
for %%F in (.output\*.zip) do (
    set "GENERATED_ZIP=%%~nxF"
)

echo.
echo ===================================================
echo   Store package created successfully!
if defined GENERATED_ZIP (
    echo   Output file: .output\!GENERATED_ZIP!
) else (
    echo   Output folder: .output\
)
echo ===================================================
echo.

pause

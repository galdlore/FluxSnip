@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   FluxSnip - Automated Test and Build Pipeline
echo ===================================================
echo.

echo [1/2] Running tests (npm test)...
call npm test
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Tests failed with exit code %ERRORLEVEL%. Aborting build.
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] All unit tests passed!
echo.

set "PROCEED=Y"
set /p PROCEED="Do you want to proceed to build production bundle? (Y/n): "
if /i not "%PROCEED%"=="Y" (
    echo.
    echo [CANCELLED] Build cancelled by user.
    exit /b 0
)

echo.
echo [2/2] Building production bundle (npm run build)...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Build failed with exit code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   Build finished successfully!
echo   Output folder: .output\chrome-mv3
echo ===================================================
echo.

pause

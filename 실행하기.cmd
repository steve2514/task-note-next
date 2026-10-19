@echo off
setlocal
cd /d "%~dp0"
set "TASK_NODE=node"
set "TASK_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.mjs"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "TASK_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\next\package.json" (
    if exist "%TASK_PNPM%" (
        "%TASK_NODE%" "%TASK_PNPM%" install --frozen-lockfile
    ) else (
        call npx --yes pnpm@10.11.0 install --frozen-lockfile
    )
    if errorlevel 1 goto error
)
echo Open http://127.0.0.1:3000/ after the server is ready.
echo Keep this window open. Press Ctrl+C to stop the server.
"%TASK_NODE%" node_modules\next\dist\bin\next dev --hostname 127.0.0.1
if errorlevel 1 goto error
exit /b 0
:error
echo Startup failed. Node.js 24.x is required. See README.md.
pause
exit /b 1

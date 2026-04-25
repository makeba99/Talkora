@echo off
REM ====================================================================
REM  Vextorn AI Tutor - One-click Sesame CSM deploy to Modal (Windows)
REM
REM  HOW TO USE:
REM    1) Open this file in Notepad
REM    2) Replace the TWO placeholder values below with YOUR values
REM    3) Save the file
REM    4) Double-click deploy.bat (or run it from this folder in cmd)
REM ====================================================================

REM --- EDIT THIS: paste your NEW Hugging Face token (starts with hf_) ---
set HF_TOKEN=PUT_YOUR_NEW_HF_TOKEN_HERE

REM --- Leave this alone unless you want to set your own shared password ---
set AUTO_GENERATE_SHARED_TOKEN=yes

REM ====================================================================
REM  Below this line you don't need to change anything.
REM ====================================================================

echo.
echo === Step 1/5: checking Python and Modal CLI ===
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python is not installed or not in PATH.
  echo Install Python 3.10+ from https://python.org and try again.
  pause
  exit /b 1
)

python -m pip show modal >nul 2>nul
if errorlevel 1 (
  echo Modal CLI not found - installing...
  python -m pip install --upgrade modal
  if errorlevel 1 (
    echo [ERROR] Failed to install modal. Check your internet connection.
    pause
    exit /b 1
  )
)

echo.
echo === Step 2/5: validating your HF token ===
if "%HF_TOKEN%"=="PUT_YOUR_NEW_HF_TOKEN_HERE" (
  echo [ERROR] You forgot to edit deploy.bat with your Hugging Face token.
  echo Open deploy.bat in Notepad, replace PUT_YOUR_NEW_HF_TOKEN_HERE
  echo with your actual token, save, and run again.
  pause
  exit /b 1
)
if not "%HF_TOKEN:~0,3%"=="hf_" (
  echo [ERROR] HF_TOKEN does not look like a valid token ^(should start with hf_^).
  pause
  exit /b 1
)

echo.
echo === Step 3/5: logging into Modal ===
echo A browser window will open. Click "Approve" then come back here.
echo Press any key to continue...
pause >nul
python -m modal token new
if errorlevel 1 (
  echo [ERROR] Modal login failed.
  pause
  exit /b 1
)

echo.
echo === Step 4/5: uploading secrets to Modal ===
python -m modal secret create hf-token HF_TOKEN=%HF_TOKEN% --force
if errorlevel 1 (
  echo [ERROR] Failed to upload HF token to Modal.
  pause
  exit /b 1
)

echo Generating a random shared password between Vextorn and CSM...
for /f "delims=" %%i in ('python -c "import secrets; print(secrets.token_hex(24))"') do set SHARED=%%i
python -m modal secret create vextorn-csm-token SESAME_CSM_TOKEN=%SHARED% --force
if errorlevel 1 (
  echo [ERROR] Failed to upload shared token to Modal.
  pause
  exit /b 1
)

echo.
echo === Step 5/5: deploying to Modal (this takes 1-3 minutes) ===
python -m modal deploy modal_app.py
if errorlevel 1 (
  echo [ERROR] Deploy failed. See message above.
  pause
  exit /b 1
)

echo.
echo ====================================================================
echo  SUCCESS - copy these TWO values into Railway Variables tab:
echo ====================================================================
echo.
echo   SESAME_CSM_URL    =  ^<the https://...modal.run URL printed above^>
echo   SESAME_CSM_TOKEN  =  %SHARED%
echo.
echo  After pasting both into Railway, the AI Tutor will use Sesame CSM.
echo ====================================================================
echo.
pause

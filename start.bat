@echo off
rem Starts Market Screener: double-click this file.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to run Market Screener. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
node scripts\launch.mjs %*
if errorlevel 1 pause

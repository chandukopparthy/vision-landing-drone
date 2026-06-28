@echo off
title AegisNode Drone Command Server
echo -------------------------------------------------------------
echo  AegisNode Drone Command Dashboard launcher
echo  Starting local HTTP server on port 8888...
echo -------------------------------------------------------------
echo.

:: Start the default browser
echo Opening dashboard at http://localhost:8888 ...
start "" http://localhost:8888

:: Start Python HTTP Server
python -m http.server 8888

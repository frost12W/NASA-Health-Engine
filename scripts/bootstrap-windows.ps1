# PREPARE THE LOCAL PYTHON RUNTIME USED BY THE DESKTOP APP.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = "C:\Users\toaster123\AppData\Local\Programs\Python\Python313\python.exe"
if (-not (Test-Path $python)) {
    throw "Python 3.13 was not found at $python. Point HEALTH_ENGINE_PYTHON at the bundled interpreter."
}
$venv = Join-Path $root "python-worker\.venv"
& $python -m venv $venv
& (Join-Path $venv "Scripts\python.exe") -m pip install --upgrade pip
& (Join-Path $venv "Scripts\python.exe") -m pip install -r (Join-Path $root "python-worker\requirements.txt")
Write-Host "Local vision runtime is ready. The desktop app can run without a network."

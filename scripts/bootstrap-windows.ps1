# PREPARE THE LOCAL PYTHON RUNTIME USED BY THE DESKTOP APP.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$minimum = [version]"3.13"

# THE INTERPRETER IS FOUND ON THE COMPUTER THAT RUNS THIS SCRIPT.
# A PATH THAT IS TRUE ON ONE COMPUTER IS NOT A DEFAULT FOR ANOTHER.
function Find-Python {
    if ($env:HEALTH_ENGINE_PYTHON) {
        if (Test-Path $env:HEALTH_ENGINE_PYTHON) { return $env:HEALTH_ENGINE_PYTHON }
        throw "HEALTH_ENGINE_PYTHON points at $env:HEALTH_ENGINE_PYTHON, and that file does not exist."
    }

    # THE PY LAUNCHER KNOWS WHICH VERSIONS ARE INSTALLED. IT ALSO WRITES TO STDERR FOR A
    # VERSION IT DOES NOT HAVE, AND THAT MUST NOT STOP THE SEARCH.
    $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($launcher) {
        $previous = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            foreach ($request in @("-3.13", "-3")) {
                $found = & $launcher.Source $request -c "import sys; print(sys.executable)" 2>$null
                if ($LASTEXITCODE -eq 0 -and $found -and (Test-Path $found)) { return $found }
            }
        } finally {
            $ErrorActionPreference = $previous
        }
    }

    # THE STORE ALIAS OF python.exe IS A PLACEHOLDER, NOT AN INTERPRETER.
    $onPath = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($onPath -and $onPath.Source -notlike "*\WindowsApps\*") { return $onPath.Source }

    $roots = @("$env:LOCALAPPDATA\Programs\Python", "$env:ProgramFiles\Python", "C:\Python")
    foreach ($base in $roots) {
        if (-not (Test-Path $base)) { continue }
        $candidates = Get-ChildItem $base -Directory -Filter "Python3*" -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending
        foreach ($candidate in $candidates) {
            $executable = Join-Path $candidate.FullName "python.exe"
            if (Test-Path $executable) { return $executable }
        }
    }

    throw "Python was not found. Install Python $minimum or newer, or set HEALTH_ENGINE_PYTHON to the interpreter path."
}

$venv = Join-Path $root "python-worker\.venv"
$venvPython = Join-Path $venv "Scripts\python.exe"

# A RUNTIME THAT ALREADY ANSWERS IS KEPT. THIS SCRIPT ONLY PREPARES WHAT IS MISSING.
$working = $false
if (Test-Path $venvPython) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $venvPython -c "import sys" 2>$null
        $working = $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $previous
    }
}

if ($working) {
    Write-Host "Using the existing runtime at $venv"
} else {
    $python = Find-Python
    $version = & $python -c "import sys; print('%d.%d' % sys.version_info[:2])"
    if ([version]$version -lt $minimum) {
        throw "Python $version was found at $python. Version $minimum or newer is needed."
    }
    Write-Host "Using Python $version at $python"
    & $python -m venv $venv
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $root "python-worker\requirements.txt")
Write-Host "Local vision runtime is ready. The desktop app can run without a network."

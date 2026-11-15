param(
    [switch]$Silent,
    [string]$Prefix
)

$installer = Join-Path $PSScriptRoot "HE-Installer.exe"
if (-not (Test-Path -LiteralPath $installer)) {
    Write-Error "HE-Installer.exe is not next to this script."
    exit 1
}

$arguments = @()
if ($Silent) { $arguments += "--silent" }
if ($Prefix) { $arguments += @("--prefix", $Prefix) }

$process = Start-Process -FilePath $installer -ArgumentList $arguments -Wait -PassThru -NoNewWindow
exit $process.ExitCode

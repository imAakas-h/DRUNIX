$ErrorActionPreference = 'Stop'

$wslDistributions = @()
try {
  $wslDistributions = @(& wsl.exe --list --quiet 2>$null) | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ }
} catch {
  $wslDistributions = @()
}

if (-not ($wslDistributions -match '^Ubuntu')) {
  Write-Host 'Installing WSL2 Ubuntu. Windows may require a reboot and first-run Ubuntu setup.'
  & wsl.exe --install --distribution Ubuntu
  if ($LASTEXITCODE -ne 0) { throw 'WSL installation did not complete. Reboot if requested, then rerun this script.' }
  Write-Host 'After Ubuntu first-run setup, rerun this script to install Docker Desktop.'
  return
}

if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
  throw 'winget is required to install Docker Desktop. Install/update App Installer, then rerun.'
}

if (-not (Get-Command docker.exe -ErrorAction SilentlyContinue)) {
  & winget.exe install --id Docker.DockerDesktop --exact --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop installation failed. Install it from https://www.docker.com/products/docker-desktop/ and rerun.' }
}

Write-Host 'Enable Docker Desktop > Settings > Resources > WSL Integration for Ubuntu.'
Write-Host 'Then, in Ubuntu, run: bash /mnt/d/Desktop/DRUNIX/scripts/bootstrap-ubuntu.sh'
Write-Host 'If this repository is not at D:\Desktop\DRUNIX, adjust that path.'

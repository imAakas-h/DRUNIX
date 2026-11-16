# RASID / Drunix setup (Windows + WSL2)

## What is and is not installed here

The current workspace has Git, Node.js 24.14.0 and npm 11.9.0. WSL/Ubuntu is not installed, and Docker and Go are not available. No Drunix network was deployed or tested from this machine.

RASID's Node application requires Node.js 22.9 or newer. The official [`npci/drunix`](https://github.com/npci/drunix) source currently declares Go 1.26.1; the RASID chaincode itself declares Go 1.21. Install Go 1.26.1 to build the current Drunix source and to build/test RASID chaincode.

## 1. Install WSL2 Ubuntu and Docker Desktop

From an elevated PowerShell terminal in the repository:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-windows.ps1
```

The script installs Ubuntu when WSL has no Ubuntu distribution, then asks you to rerun it to install Docker Desktop through `winget`. Reboot if Windows requests it. Start Docker Desktop and enable **Settings → Resources → WSL Integration → Ubuntu**. Do not install a second Docker daemon inside Ubuntu.

Verify in PowerShell:

```powershell
wsl.exe --list --verbose
docker.exe --version
docker.exe compose version
```

## 2. Install Linux development dependencies

In the Ubuntu terminal, using the existing Windows checkout:

```bash
cd /mnt/d/Desktop/DRUNIX
bash scripts/bootstrap-ubuntu.sh
source ~/.bashrc
```

The script installs Git, jq, build tools, Go 1.26.1 and Node.js 24.14.0. It downloads Go and Node only from their official distribution sites and verifies published SHA-256 checksums. Then verify Docker Desktop integration and tool versions:

```bash
git --version
go version
node --version
npm --version
jq --version
docker version
docker compose version
```

If the checkout is not `D:\Desktop\DRUNIX`, replace `/mnt/d/Desktop/DRUNIX` with its WSL path. For better Go/Docker performance, a Linux-filesystem checkout under `$HOME` is preferable; never put private keys in the Git worktree.

## 3. Install RASID dependencies

From the RASID root in Ubuntu:

```bash
npm ci
npm --prefix web ci
npm --prefix web run build
```

For development-only operation:

```bash
npm run dev
```

Open `http://localhost:3000`. This is the in-memory Development Mode, not Drunix. To use the dashboard selector, set `LEDGER_ALLOWED_MODES=dev,drunix` in `.env`; a server-side allowlist controls which modes the Operator can select.

## Official Drunix references

- [NPCI Drunix repository](https://github.com/npci/drunix)
- [Official Drunix test-network guide](https://github.com/npci/drunix/blob/main/drunix-network/test-network/README.md)
- [Drunix architecture changes](https://github.com/npci/drunix/blob/main/docs/drunix-arch.md)

The official sample is a local two-organization test network. It is not a production or consortium endpoint. See [DRUNIX_DEPLOYMENT.md](./DRUNIX_DEPLOYMENT.md), [DRUNIX_CONFIGURATION.md](./DRUNIX_CONFIGURATION.md), and [DRUNIX_TESTING.md](./DRUNIX_TESTING.md) before deploying or supplying identities.

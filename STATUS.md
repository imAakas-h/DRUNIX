# DRUNIX / RASID Simulation Demo Status

## Current objective

The judge demo is a **local blockchain simulation**, not a real-time Fabric deployment. The existing React app, Express API, and RASID business rules are retained. The demo launcher forces simulation mode and an isolated `data/demo/` store; it does not use or reset Fabric, YugabyteDB, Docker resources, certificates, or identities.

## Simulation architecture

```text
React frontend
  -> Express API + existing role authorization
  -> RASID simulation engine (mirrors the existing Go rules)
  -> simulated organization endorsements and ordering
  -> persistent local SHA-256 hash-linked blocks in data/demo/simulation-ledger.json
```

Every explorer/transaction label must make clear that IDs, endorsements, ordering, blocks, commits, and network status are simulated. The local ledger uses stable key-sorted JSON serialization and SHA-256 to link blocks and transaction payloads. Integrity verification detects changes to transaction/block data and broken previous-hash links. This is a single-machine simulation, not a distributed or production-grade cryptographic ledger.

## Delivery checklist

| Area | Status |
|---|---|
| Existing React and Express application | **COMPLETED AND VERIFIED** — preserved and extended |
| Existing RASID lifecycle and role rules | **COMPLETED AND VERIFIED** — existing development-engine tests plus simulation workflow tests |
| Separate persistent simulation ledger | **COMPLETED AND VERIFIED** — persistence, hash linkage, and tamper detection covered by `test/simulation.test.js` |
| Simulated organizations / transactions | **COMPLETED AND VERIFIED** — named initiators and simulated endorsements/order metadata appear in blocks |
| Receivable lifecycle and validation | **COMPLETED AND VERIFIED** — guided API covers registration, acceptance, discount, transfer, release, and settlement |
| Sample receivables and historical blocks | **COMPLETED AND VERIFIED** — startup seeds multiple lifecycle states on a fresh demo store |
| Blockchain Explorer | **COMPLETED AND VERIFIED** — blocks, transactions, hash relationships, data, and verification UI |
| Guided judge scenario | **COMPLETED AND VERIFIED** — creates a fresh six-operation receivable lifecycle |
| Safe reset | **COMPLETED AND VERIFIED** — Operator-only; resets only the demo ledger and restores samples; application audit history is retained |
| Backend and simulation API tests | **COMPLETED AND VERIFIED** — `npm test` passes 7/7, including lifecycle, duplicate/invalid operations, persistence, reset isolation, and hash tamper detection |
| Go chaincode tests | **COMPLETED AND VERIFIED** — `go test ./...` passes in WSL |
| Frontend production build | **COMPLETED AND VERIFIED** — `npm run build:web` succeeds |
| Existing frontend browser regressions | **COMPLETED AND VERIFIED** — Playwright passes 16/16 |
| Browser simulation smoke | **COMPLETED AND VERIFIED** — login, guided lifecycle, Explorer, and hash verification passed against the simulation server |
| Real Fabric / CCAAS / Yugabyte deployment | **OUT OF SCOPE** — intentionally not started or changed for this demo |

## Start and login

From the project root:

```powershell
$env:PORT = '3187'
npm run build:web
npm run start:demo
```

Open `http://localhost:3187`. Port 3000 is currently occupied by the existing Docker/WSL listener; omit the `PORT` override and use `http://localhost:3000` if it is free. Default demo login: **Platform Operator** / **rasid-demo**. If `RASID_DEMO_PASSWORD` is set in the local environment, that configured password is used. Do not put network credentials in demo configuration.

Optional split frontend:

```powershell
npm run start:demo
npm --prefix web run dev
```

Open `http://localhost:5173`; Vite proxies `/api` requests to `http://localhost:3000`.

The simulation store defaults to `data/demo/simulation-ledger.json`. Set `SIMULATION_DATA_DIR` to choose another local demo directory. **Reset demo data** never removes existing files; it reinitializes only the selected simulation ledger file. It does not modify the real Fabric/Yugabyte ledger or Docker resources.

## Five-minute judge walkthrough

1. Introduce DRUNIX as a receivables-financing workflow and point out the persistent **DEMO MODE · SIMULATION** banner.
2. Explain the simulated architecture: React → Node API → RASID rule mirror → simulated organizations/ordering → local block ledger.
3. Use **Run guided demo** on the Blockchain Explorer. It registers and validates a receivable, records acceptance, discounts it, transfers a position, releases a portion, and settles it.
4. Open Receivables and the generated unit to show its final status, positions, and transaction history. The seed data also includes pending/accepted/discounted/transferred/settled examples.
5. In Blockchain Explorer, open the recent blocks and transactions. Show the simulated initiator/endorser labels, operation data, transaction hash, block hash, and previous-block link.
6. Click **Verify ledger integrity** and show the result. Optionally use the Operator-only reset to restore the initial sample state.

## Validation commands

```powershell
npm test
wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Desktop/DRUNIX/chaincode/rasid && go test ./..."
npm run build:web
npm run test:e2e
```

These validate local code and simulation only. The existing Playwright regression suite uses the development engine; the guided simulation browser smoke was run separately against the persistent simulation server. None of these are evidence of a live Fabric deployment or transaction.

## Historical network notes

An earlier Fabric attempt and database/ledger recovery blocker are documented in the setup/deployment material. They are intentionally not part of this demo objective. Do not recover, reset, redeploy, or modify that network or its data for the judge simulation.

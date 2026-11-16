# RASID
### Verifiable Position Ledger for Discounted Factoring Units

**One receivable. One source of truth. Every position verifiable.**

> **Judge demo: local blockchain simulation only.** `npm run start:demo` runs the existing React/Express application against a persistent local simulation ledger. It does not connect to, deploy, repair, or submit transactions to Hyperledger Fabric, Drunix, KeyDB, or YugabyteDB. Explorer blocks, endorsements, ordering, transaction IDs, and commits are explicitly simulated.

### Start the simulation

Requires Node.js 22.9+ and npm. Docker, WSL, Go, Fabric certificates, and a live network are not required for the demo.

```powershell
$env:PORT = '3187'
npm run build:web
npm run start:demo
```

Open [http://localhost:3187](http://localhost:3187). Port 3187 avoids the existing Docker/WSL listener on port 3000 in the current development environment; if port 3000 is free, the `$env:PORT` line can be omitted and the app opens at `http://localhost:3000`. Sign in as **Platform Operator** with password **`rasid-demo`** (unless `RASID_DEMO_PASSWORD` is explicitly set in the local environment). Sample receivables are seeded on first start and are stored under `data/demo/`; the app never reads or resets Fabric/Yugabyte ledger data. Use **Blockchain Explorer → Run guided demo** to register, accept, discount, transfer, release, and settle a fresh sample receivable. **Reset demo data** is restricted to the Operator and resets only this local simulation store. The existing application audit log is not erased by demo reset.

To run the Vite UI separately, start the backend with `npm run start:demo`, then in another PowerShell window run `$env:RASID_API_TARGET = 'http://localhost:3187'; npm --prefix web run dev` and open [http://localhost:5173](http://localhost:5173). The proxy target defaults to port 3000 when `RASID_API_TARGET` is unset.

The **Blockchain Explorer** shows simulated blocks and transactions, organization labels, transaction data, previous/current SHA-256 hashes, and a hash-chain integrity check. This demonstrates blockchain concepts; it is not a cryptographically distributed or live Hyperledger Fabric ledger.

Rasid is designed as a blockchain-powered post-discount position ledger for establishing, tracking, and verifying ownership of discounted factoring units. The judge demo mirrors existing RASID rules locally; it does not demonstrate a live Fabric runtime.

The project includes **Hyperledger Fabric v2.5-model Go chaincode for Drunix** and a separate Fabric Gateway adapter. The local simulation mirrors role checks, transfer rules, replay protection, and MVCC-style concurrency behavior; simulated results are not actual Fabric validation.

The application combines a Node.js backend and role-based web console with selectable ledger implementations. The judge-demo launcher forces the isolated local simulation and does not connect through the Fabric Gateway.

---

## 01 — Project Status

> **Development transparency:** The application and development-engine components have been tested. Real Drunix deployment, integration, and performance verification are still pending.

| Component | Current status |
|---|---|
| Go ownership rules | Tested |
| Chaincode formatting | Verified |
| Chaincode real Fabric compilation | Pending |
| Chaincode deployment on Drunix | Pending |
| Fabric Gateway adapter | Configuration validation, TLS identity checks and commit-status handling implemented; live network still untested |
| Backend-controlled environment selector | Implemented; server allowlist and Operator authorization enforced |
| Network status panel | Implemented; reports backend query/auth status and observed commit metadata |
| Express API | Dev engine tests passed |
| React web console | 16/16 Playwright tests passed |
| Double-sale concurrency test | 20/20 on dev engine |
| Drunix integration suite | Ready, not executed |
| Benchmark on Drunix | Pending |
| External integrations | Simulated |

**Implementation evidence**

- Go rules tests: `reports/go-rules-test.txt`
- API/configuration tests: 5/5 on the development engine
- Frontend tests: 16/16 across three consecutive runs
- Concurrency tests: 20/20 on the development engine

**Important:** Development-engine results are not evidence of successful Drunix deployment.

### Network Connection Indicators

| Indicator | Meaning |
|---|---|
| DEV MODE — NOT DRUNIX | Running with the local development ledger |
| CONNECTED | Backend `WhoAmI` query succeeded against the configured Drunix chaincode as the logged-in identity |
| CONFIGURATION REQUIRED / AUTHENTICATION FAILED / CHAINCODE UNAVAILABLE / DISCONNECTED | Backend reports the actual setup or connection failure; no dev fallback |

Drunix mode never silently falls back to the development engine.

---

## 02 — Core Capabilities

### Permissioned Ownership Management
- Maintain verifiable positions for factoring participants.
- Enforce ownership and transfer restrictions on-chain.
- Derive transaction roles from certificate Common Names.
- Prevent browser-submitted role impersonation.

### Secure Position Transfers
- Transfer factoring positions between authorized financiers.
- Validate available balances before committing transfers.
- Reject transfers that exceed the holder's available position.
- Record accepted actions through on-chain audit events.

### Double-Sale Attack Prevention
Rasid demonstrates a same-state concurrent double-sale attack.

Two transfer proposals are endorsed against the same pre-transfer state before submission. Both attempt to spend the same position.

Because both transactions read and write the same position key, Fabric's MVCC validation rejects the conflicting transaction at commit time.

**No application-level locking is used.**

### Replay Protection
- Every request carries a unique `requestRef`.
- Reused transaction references are rejected.
- Settlement references cannot be reused.
- Accepted actions are recorded on-chain.

### Auditability
- Accepted actions generate on-chain audit events.
- Rejected attempts are preserved in an append-only application audit log.
- Transaction outcomes distinguish chaincode rejection, commit-time rejection, and API-level rejection.

---

## 03 — Technology Stack

| Layer | Technology |
|---|---|
| Blockchain | Hyperledger Fabric v2.5 model |
| Smart contract | Go chaincode |
| Blockchain integration | Fabric Gateway |
| Backend | Node.js, Express |
| Frontend | React 19, Vite |
| Styling | Tailwind CSS 3 |
| Routing | React Router |
| Icons | Lucide |
| Testing | Go testing, Node.js tests, Playwright |
| Runtime | Docker, Linux / WSL2 |
| Ledger modes | Local simulation (demo default) / development test engine / Drunix (separate, not used by demo) |

### System Architecture

```text
             ROLE-BASED WEB CONSOLE
                  React 19
                      |
                      v
               EXPRESS API SERVER
                 Node.js
                      |
             +--------+--------+
             |                 |
             v                 v
       AUTH & AUDIT       FABRIC GATEWAY
                               |
                               v
                     DRUNIX FABRIC NETWORK
                               |
                 +-------------+-------------+
                 |                           |
                 v                           v
              ORG 1                        ORG 2
                 |                           |
             Peer Nodes                  Peer Nodes
                 |                           |
                 +-------------+-------------+
                               |
                               v
                       RASID CHAINCODE
                            Go
                               |
                               v
                    POSITION & AUDIT STATE
```

*The architecture illustrates the intended Drunix deployment. Actual network integration remains unverified.*

---

## 04 — Role-Based Access

Rasid uses seven enrolled identities.

| Identity | Responsibility |
|---|---|
| OPERATOR | Operational actions and participant registration |
| FINANCIER_A | Factoring position ownership and transfers |
| FINANCIER_B | Receives and manages transferred positions |
| FINANCIER_C | Test identity for concurrent transfer validation |
| FINANCIER_D | Test identity for concurrent transfer validation |
| INSURER | Insurance-related workflow access |
| AUDITOR | Audit and verification access |

**Identity security:** The chaincode derives the caller's role from the Common Name (CN) of the transaction certificate. The browser cannot choose or override a transaction role.

**Organisational clarification:** FINANCIER_C and FINANCIER_D are test identities enrolled within the two existing organisations. They are not separate Fabric organisations.

The sample network provides Admin and User1 identities per organisation. Additional identities must be enrolled through the network CA or Fabric CA.

---

## 05 — The Attack Lab: Demonstrating Double-Sale Prevention

The demo walks through a complete factoring lifecycle and deliberately attempts to violate the ownership rules.

### Demonstration Workflow

**01. Register**

Register a factoring unit using the simulated verification and buyer-acceptance workflow.

**02. Discount**

Assign 100% of the initial factoring position to FINANCIER_A.

**03. Re-discount**

Transfer 60% of FINANCIER_A's position to FINANCIER_B.

**04. Launch the Attack**

Create two simultaneous proposals:

- FINANCIER_A → FINANCIER_C
- FINANCIER_A → FINANCIER_D

Both proposals attempt to use the same available position.

**05. Break the Rules**

Submit both proposals after endorsement against the same pre-transfer state.

Fabric's commit-time MVCC validation should reject the conflicting transaction.

**06. Settle**

Execute the simulated payment workflow, reject settlement replay, and generate a CERSAI-ready record.

Use **New Run ID** to repeat the experiment with a fresh factoring unit.

### Why the Attack Fails

Both transfer transactions read and write:

`POS~<fu>~FINANCIER_A`

After the first transaction commits, the second transaction's read version no longer matches the committed state.

Fabric therefore identifies an MVCC read conflict and invalidates the second transaction.

This is a ledger-level concurrency safeguard, not an application-level lock.

### Transaction Outcome Classification

| Outcome | Explanation |
|---|---|
| Committed | Transaction successfully committed |
| Rejected by chaincode | Ownership or business rule failed during endorsement |
| Rejected at commit | MVCC or other commit-time validation failure |
| Rejected by API | Request validation or authorization failed |
| Failed simulated check | External simulated verification failed |

---

## 06 — Getting Started

### Prerequisites

- Node.js 22.9+ and npm for the local simulation.
- Go is needed only for the optional chaincode unit tests.

Docker, WSL2, Fabric, and YugabyteDB are not required to run the judge demo.

### Step 1 — Install Dependencies

```bash
npm ci
npm --prefix web ci
```

### Step 2 — Build the Web Console

```bash
npm run build:web
```

The React application is built into `web/dist` and served through Express.

If `web/dist` does not exist, Express falls back to the legacy static console in `public/`.

### Step 3 — Start the Local Simulation

```bash
npm run dev
```

This starts the same local simulation as `npm run start:demo`; it does not connect to the live Fabric network.

Open:

`http://localhost:3000`

The simulation data is kept separately under `data/demo/`.

### Step 4 — Run Tests

```bash
npm test
wsl.exe -d Ubuntu -- bash -lc "cd /mnt/d/Desktop/DRUNIX/chaincode/rasid && go test ./..."
npm run build:web
npm run test:e2e
```

If Playwright cannot locate Chromium automatically, configure `PW_CHROMIUM_PATH`.

### Optional — Run Vite Separately

```bash
cd web
npm run dev
```

Vite runs on port `5173` and proxies `/api` requests to Express on port `3000`.

---

## 07 — Drunix Network Deployment

**No network deployment has been run from this workspace.** The official NPCI repository is [`npci/drunix`](https://github.com/npci/drunix); use its own test-network guide, not generic Fabric `test-network` instructions. Follow [DRUNIX_SETUP.md](./DRUNIX_SETUP.md) and [DRUNIX_DEPLOYMENT.md](./DRUNIX_DEPLOYMENT.md).

---

## 08 — Identity & Environment Configuration

The checked-in identity template contains environment-variable references only. It is not a certificate or a valid network configuration. Follow [DRUNIX_CONFIGURATION.md](./DRUNIX_CONFIGURATION.md) to create the ignored local files and obtain seven distinct, network-issued identities.

`npm start` and `npm run start:demo` load the local `.env` but force the isolated local simulation mode; they never connect to or fall back to a real Fabric network. `npm run seed` is a separate network-oriented utility and is not part of the demo workflow.

---

## 09 — Drunix Verification Suite

Run the sandbox-only real-network procedures in [DRUNIX_TESTING.md](./DRUNIX_TESTING.md) and [test/drunix.smoke.md](./test/drunix.smoke.md). The suite uses unique identifiers and actual Gateway commit status. No Drunix result is claimed until it has been run against the intended network.

---

## 10 — External Integrations & Simulation Boundaries

Rasid currently includes simulated integrations for:

| Integration | Current implementation |
|---|---|
| Invoice verification | Simulated |
| Duplicate invoice checking | Simulated |
| Payment processing | Simulated |
| Insurance policy | Simulated |
| CERSAI workflow | Simulated |

These components demonstrate the intended workflow and API interactions. They must not be represented as live external integrations.

The settlement process produces a CERSAI-ready record; this does not mean that a live CERSAI submission has occurred.

---

## 11 — Repository Structure

```text
rasid/
│
├── chaincode/
│   └── rasid/
│       ├── main.go
│       └── rules/
│
├── server/
│   ├── index.js
│   ├── ledger-fabric.js
│   ├── ledger-dev.js
│   ├── adapters.js
│   └── seed.js
│
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── lib/
│   └── e2e/
│
├── public/
├── scripts/
│   ├── seed.js
│   ├── verify-concurrency.js
│   └── benchmark.js
│
├── test/
│   ├── api.test.js
│   └── drunix.smoke.md
│
├── docs/
│   └── API.md
│
├── reports/
│
├── STATUS.md
├── identities.example.json
└── .env.example
```

### Financial & Transaction Integrity

- All monetary values are represented as integer paise.
- Every request includes a unique `requestRef`.
- Replayed request references are rejected.
- Settlement references cannot be reused.
- Accepted transactions produce on-chain audit events.
- Rejected attempts are retained in the append-only application audit log.

---

## 12 — Troubleshooting

| Issue | Recommended action |
|---|---|
| Configuration required | Verify every identity variable in `.env`, local `identities.json`, issued credential files, TLS roots, `CHANNEL`, and `CHAINCODE` |
| Drunix unreachable | Check the official Drunix network containers, client-accessible Gateway endpoint, host alias and TLS root; do not disable TLS verification |
| UNKNOWN_IDENTITY | Run `npm run seed` and verify the certificate CN |
| Unexpected concurrency result | Review `test/drunix.smoke.md`, especially item 5 |
| Go dependency errors | Run `go mod tidy` with network access |
| Chromium not found | Set `PW_CHROMIUM_PATH` |

---

## 13 — Current Verification Roadmap

- [x] Implement pure Go ownership rules.
- [x] Test ownership rules.
- [x] Implement Express API and development ledger.
- [x] Implement React role-based console.
- [x] Complete frontend Playwright testing.
- [x] Verify development-engine double-sale scenarios.
- [x] Implement Fabric Gateway adapter.
- [ ] Compile chaincode against real Fabric dependencies.
- [ ] Deploy `rasid` on Drunix.
- [ ] Enrol all seven identities.
- [ ] Run real-network integration tests.
- [ ] Verify MVCC conflict handling on Drunix.
- [ ] Measure real-network p50/p95 performance.
- [ ] Verify state persistence after network restart.

---

## RASID

**Trust every position. Verify every transfer. Reject every conflicting claim.**

A verifiable ownership ledger for a more transparent factoring ecosystem.

*Built with Go, Hyperledger Fabric, Node.js, React, and Drunix.*

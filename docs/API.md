# RASID API (Express)

All routes except `/api/health` and `/api/login` require a signed session token in the `Authorization: Bearer <token>` header. Development mode uses the configured demo password. Drunix mode requires distinct server-side `RASID_PASSWORD_<IDENTITY>` values and a `SESSION_SECRET` of at least 32 characters. Mutations carry a unique `requestRef`; the chaincode refuses reused references. Money is integer paise.

| Method & path | Roles | Purpose |
|---|---|---|
| `POST /api/login` `{identity,password}` | – | Session token; Drunix uses per-identity passwords |
| `GET /api/health` | – | App liveness (not ledger status) |
| `GET /api/network/health` | all | Backend ledger check. Drunix evaluates `WhoAmI` using the authenticated identity; returns status, peer/identity/chaincode state, actual network metadata and last successful commit if available |
| `GET /api/network/modes` | all | Active server mode and server-configured allowlist |
| `POST /api/network/mode` `{mode}` | OPERATOR | Switches the process-wide active ledger only if the requested mode is allowed by `LEDGER_ALLOWED_MODES`; Drunix status is independently checked |
| `GET /api/metrics` | all | Measured propose→commit latency (p50/p95, sample count) since start |
| `GET /api/receivables` | all | Units with positions, read from the ledger |
| `GET /api/receivables/:id` | all | One unit: `{fu, positions, allocatedPaise, unallocatedPaise}` |
| `POST /api/receivables` | OPERATOR | Register (runs SIMULATED invoice/duplicate check first) |
| `POST /api/receivables/:id/accept` | OPERATOR | Buyer acceptance |
| `POST /api/receivables/:id/discount` | FINANCIER | Take 100% of the unit |
| `POST /api/receivables/:id/transfers` (alias `/transfer`) `{toHolderId,amountPaise,requestRef}` | FINANCIER | Move part of own position |
| `POST /api/receivables/:id/release` `{amountPaise,requestRef}` | FINANCIER | Release part of own position |
| `POST /api/receivables/:id/settle` `{paymentRef?}` | OPERATOR | SIMULATED payment, then ledger release; `paymentRef` replays a reference |
| `GET /api/receivables/:id/audit` | not INSURER | `{onChain, attempts}`; financiers see own attempts only |
| `GET /api/receivables/:id/cersai` | all | SIMULATED filing-ready record |
| `GET /api/receivables/:id/exposure` | INSURER, AUDITOR, OPERATOR | Holdings + SIMULATED policy cover |
| `GET /api/audit/recent` | all | Latest application-log attempts (role-filtered) |
| `GET /api/audit/verify` | AUDITOR, OPERATOR | Hash-chain check of the append-only log |
| `POST /api/demo/step/:n` `{fuId}` (n=1..6) | OPERATOR, AUDITOR | Demo runner; step 4 = same-state double sale |
| `POST /api/demo/concurrency-run` | OPERATOR, AUDITOR | Attack only, on an existing unit |

Mutation response (HTTP 200 committed, 409 rejected at commit, 422 rejected by chaincode/API/precheck):
`{ts, actor, action, fuId, requestRef, txId, blockNumber, outcome, reasonCode, message, seq, prevHash, hash}` where `outcome` is one of `ACCEPTED | REJECTED_CHAINCODE | REJECTED_COMMIT | REJECTED_API | REJECTED_PRECHECK | ERROR`.

Reason codes: INSUFFICIENT_POSITION, NOT_A_HOLDER, OVER_ALLOCATION, INVALID_AMOUNT, INVALID_LIFECYCLE, REPLAYED_REFERENCE, ROLE_NOT_AUTHORISED, UNKNOWN_IDENTITY, RECIPIENT_NOT_ELIGIBLE, FU_EXISTS, FU_NOT_FOUND, INVALID_REQUEST, plus the network's own validation code for commit-time rejections (e.g. MVCC_READ_CONFLICT).

Network `status` values are `CONNECTED`, `CONNECTING` (frontend transition only), `DISCONNECTED`, `CONFIGURATION REQUIRED`, `AUTHENTICATION FAILED`, and `CHAINCODE UNAVAILABLE`. A mode selection alone never produces `CONNECTED`. Development responses do not report a block number.

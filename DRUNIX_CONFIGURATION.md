# RASID Drunix configuration

## Backend-controlled environment selection

The backend reads `.env` through Node's `--env-file-if-exists` support (Node.js 22.9+). Copy the example and identity template:

```powershell
Copy-Item .env.example .env
Copy-Item identities.example.json identities.json
```

In Ubuntu:

```bash
cp .env.example .env
cp identities.example.json identities.json
chmod 600 .env identities.json
```

Both local files are ignored by Git. The identity template contains only references to environment variable names; blank values are intentionally incomplete and do not represent valid certificates. Fill `.env` only with values issued or confirmed by the network operator. Never check in `.env`, `identities.json`, private keys, client certificates or TLS roots.

Relevant settings:

| Variable | Required value |
|---|---|
| `LEDGER_MODE` | Server startup mode: `dev` or `drunix`; example is `drunix`. |
| `LEDGER_ALLOWED_MODES` | Server-side selector allowlist, e.g. `dev,drunix`. Only an authenticated Operator can change the active, process-wide mode. |
| `DRUNIX_NETWORK_NAME` | Operator-supplied network label; optional and otherwise shown as unreported. |
| `CHANNEL` / `CHAINCODE` | Actual deployed channel and chaincode definition names. |
| `IDENTITIES_FILE` | Local identity reference file; default `./identities.json`. |
| `SESSION_SECRET` | Random session-signing secret (at least 32 characters). Required for Drunix and production. |
| `RASID_PASSWORD_<IDENTITY>` | Unique RASID login password of at least 32 characters for each identity in Drunix mode; do not reuse one password across roles. |
| `RASID_DEMO_PASSWORD` | Development-only shared password; never use as a production credential. |

Generate a session secret locally and place it in `.env` using a protected editor:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

In production, set `NODE_ENV=production` and use distinct, high-entropy identity passwords. Prefer an operating-system secret manager/secret mount over `.env` files for a deployed service.

## Per-identity network material

The seven identities are `OPERATOR`, `FINANCIER_A`, `FINANCIER_B`, `FINANCIER_C`, `FINANCIER_D`, `INSURER`, and `AUDITOR`. Each identity needs its own issued membership certificate and matching private key, plus the endpoint/connection details approved for it. For each identity, set these environment variables, replacing `<IDENTITY>` with the uppercase name above:

```text
DRUNIX_<IDENTITY>_MSP_ID
DRUNIX_<IDENTITY>_CERT_PATH
DRUNIX_<IDENTITY>_KEY_PATH
DRUNIX_<IDENTITY>_PEER_ENDPOINT
DRUNIX_<IDENTITY>_HOST_ALIAS
DRUNIX_<IDENTITY>_TLS_CERT_PATH
```

The certificate and key paths may point to a specific issued file or a standard single-file Fabric `signcerts` / `keystore` directory. The adapter verifies the X.509 certificate, expiration, certificate/private-key match and TLS root before creating a Gateway. TLS verification remains enabled; do not set insecure roots, disable validation or invent a TLS hostname.

`PEER_ENDPOINT` must be the real client-accessible Drunix peer Gateway endpoint for that identity. `HOST_ALIAS` must match the TLS certificate name used by the network. The TLS certificate path is the peer TLS trust root delivered by the network. Sample-network ports are not production values.

In the current official test-network `scripts/envVar.sh`, peer index 0 is the lite peer (`localhost:7051` / `localhost:9051`) and peer index 1 is the committing peer (`localhost:7061` / `localhost:9061`). The sample names `Org1MSP` and `Org2MSP` and those ports are valid only when confirmed against the exact checked-out test-network port mappings and Gateway service. Do not copy them into a consortium deployment.

The Certificate Authority issues and enrolls identities; RASID does not enroll users. Obtain the actual CA name/endpoint and enrollment process from the network operator, use the official Drunix CA/cryptogen instructions for the chosen network, and keep CA registrar secrets out of RASID configuration. Distinct participant certificates/Common Names are required; do not reuse an organization admin certificate for every role.

The Fabric Gateway client uses the peer endpoint for proposal/evaluation and asks the peer Gateway to submit and track commits. No direct orderer endpoint is required by this adapter. If a target network requires a different supported Gateway topology, obtain and follow that network's instructions rather than adding an assumed orderer address.

## Environment behavior and diagnostics

- The browser can request a mode switch, but the server enforces the Operator role and `LEDGER_ALLOWED_MODES`.
- Drunix mode never falls back to dev. Missing config is `CONFIGURATION REQUIRED`; rejected identity is `AUTHENTICATION FAILED`; missing chaincode is `CHAINCODE UNAVAILABLE`; transport failures are `DISCONNECTED`.
- `CONNECTED` is returned only after the backend has successfully evaluated `WhoAmI` against the configured chaincode as the requesting session identity.
- The dashboard's last observed commit block and transaction come only from the Gateway's successful commit-status response. A connection check does not create a probe transaction.
- `CHANNEL`, `CHAINCODE`, network label and peer/identity data are read server-side. No private key, identity certificate or secret is sent to the frontend.

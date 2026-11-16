# RASID Drunix validation

## Separate development checks from network evidence

Development tests use the in-memory local mirror and are not blockchain evidence:

```powershell
npm test
npm run test:chaincode
npm --prefix web run build
npm run test:e2e
```

In Ubuntu, compile/test the complete chaincode against its declared Fabric contract API dependency (this downloads Go modules if needed):

```bash
cd /mnt/d/Desktop/DRUNIX/chaincode/rasid
go mod tidy
go test ./...
```

Run Go tests separately from network integration. Do not call a development test a Drunix result.

## Real Drunix integration tests

Use an isolated, approved Drunix test network—not production—because the tests submit transactions and create factoring units. Ensure the official network is running, the `rasid` chaincode is deployed, all seven real identities and their passwords are configured, and the Operator bootstrap has been authorized.

From the RASID root, with `.env` selecting the real network:

```powershell
npm run seed
npm run test:drunix
npm run verify:concurrency -- 20
npm run benchmark -- 50
```

The integration test command fails if the network is unavailable or seeding fails; it does not skip the test and fall back to dev. It exercises registration/duplicate rejection, query, acceptance, discounting, transfer and ownership checks, unauthorized transfer rejection, audit records, settlement/replay protection and commit-time concurrency conflicts. Successful mutations require Gateway commit status, not merely an endorsement response.

Alternatively, run the Go commands from Ubuntu and the Node commands from PowerShell or Ubuntu. `.env` values are loaded by `npm start`, `npm run seed`, `npm run test:drunix`, `npm run verify:concurrency`, and `npm run benchmark`.

## Manual checks

Follow [test/drunix.smoke.md](./test/drunix.smoke.md) against the test network. Confirm:

1. `/api/network/health` reports `CONNECTED` only after a real `WhoAmI` chaincode evaluation.
2. The network panel displays actual channel/chaincode, peer/authentication state and a real commit block only after a committed transaction.
3. Each mutation has a transaction ID and accepted/rejected commit outcome returned by the network.
4. Transfer rules, unauthorized role rejection, duplicate registration, replay protection, settlement and on-chain audit behavior match the existing Go contract.
5. A repeated same-state double sale yields the actual network validation result; do not assume the dev engine's MVCC message/code proves Drunix behavior.

The local connection status does not submit a synthetic write. Transaction submission is verified through `npm run seed`, the real-network integration suite or an approved business transaction.

## Completion evidence

Do not mark deployment or a test as successful unless the actual network command completed and the returned commit status was successful. Keep generated `reports/*drunix*` separate from dev reports, preserve the network configuration/commit metadata, and update [STATUS.md](./STATUS.md) only with results observed on the network.

No Drunix network or credentials were available in the current Windows environment, so live connectivity, chaincode deployment, certificate authentication and transaction commit tests remain unrun.

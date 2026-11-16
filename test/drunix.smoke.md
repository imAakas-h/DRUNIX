# Drunix smoke checklist (run against the REAL network; not automated here)

Status: NOT RUN. Complete [DRUNIX_SETUP.md](../DRUNIX_SETUP.md), [DRUNIX_DEPLOYMENT.md](../DRUNIX_DEPLOYMENT.md) and [DRUNIX_CONFIGURATION.md](../DRUNIX_CONFIGURATION.md) first.

1. `cd chaincode/rasid && go mod tidy && go test ./...` — the chaincode compiles against the actual Go module dependencies.
2. Deploy the existing `rasid` chaincode with the official `npci/drunix` test-network procedure. Use an isolated test network, not production.
3. Configure seven distinct network-issued identities and run `npm run seed`. Confirm bootstrap/registration commit statuses; a failed registration is a failed setup.
4. `GET /api/network/health` reports `status: "CONNECTED"`, authenticated identity, peer connected and chaincode available. Selecting Drunix alone must not show this state.
5. Register and query a fresh factoring unit; then accept and discount it. Each successful mutation must report the real Gateway commit status.
6. Transfer ownership and query resulting positions. Attempt an unauthorized transfer and confirm rejection by the chaincode/API role policy.
7. Demo steps 1–3: registration, acceptance, discount and transfer all commit; positions A ₹1,92,000 / B ₹2,88,000.
8. Demo step 4: exactly one transaction commits and one is rejected at commit; record the actual network validation code.
   If both commit or both fail, STOP: confirm both proposals read `POS~<fu>~FINANCIER_A` and the network endorsement policy.
9. Demo step 5: verify the insufficient-position, non-holder, invalid-lifecycle, replayed-reference and unauthorized-role rejections.
10. Demo step 6: settlement commits, replay is rejected, all positions are zero, and on-chain audit events are queryable.
11. Restart the network and confirm positions and audit trail are unchanged.
12. Record measured p50/p95 and sample size; do not infer Drunix performance from development-engine runs.

Run the automated sequence with `npm run test:drunix` only against an isolated test network. Do not treat Development Mode outputs or simulated external adapters as Drunix evidence.

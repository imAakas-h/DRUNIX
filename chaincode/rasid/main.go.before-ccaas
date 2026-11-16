// Rasid position contract (Hyperledger Fabric v2.5 programming model, as used by Drunix).
//
// Key layout (all values JSON):
//
//	PART~<cn>            Participant, keyed by the X.509 Common Name of the caller's certificate
//	PARTID~<id>          participant id -> cn
//	FU~<fuId>            FactoringUnit
//	POS~<fuId>~<holder>  Position (integer paise). Every transfer reads AND writes the seller's key,
//	                     so two conflicting sales of one slice collide in Drunix MVCC validation.
//	REQ~<ref>            request reference already used (replay protection)
//	SETTLE~<ref>         settlement reference already used (one-time release)
//	AUD~<fuId>~<txId>    on-chain audit event for each committed business action
//
// The caller's role and holder id are derived from the network identity, never from arguments.
package main

import (
	"encoding/json"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"rasid/chaincode/rules"
)

type Contract struct{ contractapi.Contract }
type Ctx = contractapi.TransactionContextInterface

type Participant struct {
	CN   string `json:"cn"`
	ID   string `json:"id"`
	Role string `json:"role"`
	MSP  string `json:"msp"`
}

type FactoringUnit struct {
	FuID             string `json:"fuId"`
	Buyer            string `json:"buyer"`
	Currency         string `json:"currency"`
	OutstandingPaise int64  `json:"outstandingPaise"`
	Status           string `json:"status"`
	EvidenceHash     string `json:"evidenceHash"`
	RegisteredBy     string `json:"registeredBy"`
	UpdatedAt        string `json:"updatedAt"`
}

type Position struct {
	FuID          string `json:"fuId"`
	HolderID      string `json:"holderId"`
	AmountPaise   int64  `json:"amountPaise"`
	ReleasedPaise int64  `json:"releasedPaise"`
}

type AuditEvent struct {
	TxID    string `json:"txId"`
	FuID    string `json:"fuId"`
	Action  string `json:"action"`
	Actor   string `json:"actor"`
	Details string `json:"details"`
	At      string `json:"at"`
}

// ---------- helpers ----------

func put(ctx Ctx, key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(key, b)
}

func get(ctx Ctx, key string, out any) (bool, error) {
	b, err := ctx.GetStub().GetState(key)
	if err != nil || b == nil {
		return false, err
	}
	return true, json.Unmarshal(b, out)
}

func now(ctx Ctx) string {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return ""
	}
	return time.Unix(ts.GetSeconds(), int64(ts.GetNanos())).UTC().Format(time.RFC3339Nano)
}

func callerCN(ctx Ctx) (string, error) {
	cert, err := ctx.GetClientIdentity().GetX509Certificate()
	if err != nil {
		return "", err
	}
	return cert.Subject.CommonName, nil
}

func actor(ctx Ctx) (*Participant, error) {
	cn, err := callerCN(ctx)
	if err != nil {
		return nil, err
	}
	var p Participant
	ok, err := get(ctx, "PART~"+cn, &p)
	if err != nil {
		return nil, err
	}
	msp, _ := ctx.GetClientIdentity().GetMSPID()
	if !ok || p.MSP != msp {
		return nil, rules.Fail("UNKNOWN_IDENTITY", "identity %q is not a registered participant", cn)
	}
	return &p, nil
}

func claim(ctx Ctx, prefix, ref string) error {
	if strings.TrimSpace(ref) == "" || strings.Contains(ref, "~") {
		return rules.Fail("INVALID_REQUEST", "a unique reference is required")
	}
	var x map[string]any
	if ok, err := get(ctx, prefix+"~"+ref, &x); err != nil {
		return err
	} else if ok {
		return rules.Fail("REPLAYED_REFERENCE", "reference %q was already used", ref)
	}
	return put(ctx, prefix+"~"+ref, map[string]string{"txId": ctx.GetStub().GetTxID(), "at": now(ctx)})
}

func loadFU(ctx Ctx, id string) (*FactoringUnit, error) {
	var fu FactoringUnit
	ok, err := get(ctx, "FU~"+id, &fu)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, rules.Fail("FU_NOT_FOUND", "factoring unit %q does not exist", id)
	}
	return &fu, nil
}

func posKey(fu, holder string) string { return "POS~" + fu + "~" + holder }

func loadPos(ctx Ctx, fu, holder string) (*Position, error) {
	var p Position
	ok, err := get(ctx, posKey(fu, holder), &p)
	if err != nil || !ok {
		return nil, err
	}
	return &p, nil
}

func audit(ctx Ctx, fu, action, who, details string) error {
	tx := ctx.GetStub().GetTxID()
	return put(ctx, "AUD~"+fu+"~"+tx, AuditEvent{tx, fu, action, who, details, now(ctx)})
}

func validID(s string) bool { return strings.TrimSpace(s) != "" && !strings.Contains(s, "~") }

// ---------- participants ----------

// BootstrapOperator binds the caller as the platform operator. It works exactly once.
func (c *Contract) BootstrapOperator(ctx Ctx, id string) error {
	var x map[string]any
	if ok, err := get(ctx, "BOOT", &x); err != nil {
		return err
	} else if ok {
		return rules.Fail("ALREADY_BOOTSTRAPPED", "operator already bound")
	}
	cn, err := callerCN(ctx)
	if err != nil {
		return err
	}
	msp, _ := ctx.GetClientIdentity().GetMSPID()
	if err := put(ctx, "BOOT", map[string]string{"cn": cn}); err != nil {
		return err
	}
	return c.store(ctx, Participant{cn, id, rules.RoleOperator, msp})
}

func (c *Contract) store(ctx Ctx, p Participant) error {
	if err := put(ctx, "PART~"+p.CN, p); err != nil {
		return err
	}
	return ctx.GetStub().PutState("PARTID~"+p.ID, []byte(p.CN))
}

// RegisterParticipant is operator-only. cn is the Common Name in the participant's certificate.
func (c *Contract) RegisterParticipant(ctx Ctx, cn, id, role, msp string) error {
	a, err := actor(ctx)
	if err != nil {
		return err
	}
	if err := rules.RequireRole(a.Role, rules.RoleOperator); err != nil {
		return err
	}
	switch role {
	case rules.RoleFinancier, rules.RoleInsurer, rules.RoleAuditor, rules.RoleOperator:
	default:
		return rules.Fail("INVALID_REQUEST", "unknown role %q", role)
	}
	if !validID(cn) || !validID(id) {
		return rules.Fail("INVALID_REQUEST", "cn and id are required")
	}
	return c.store(ctx, Participant{cn, id, role, msp})
}

func (c *Contract) WhoAmI(ctx Ctx) (*Participant, error) { return actor(ctx) }

// ---------- lifecycle ----------

func (c *Contract) RegisterFactoringUnit(ctx Ctx, fuID, buyer string, outstandingPaise int64, evidenceHash, ref string) error {
	a, err := actor(ctx)
	if err != nil {
		return err
	}
	if err := rules.RequireRole(a.Role, rules.RoleOperator); err != nil {
		return err
	}
	if err := claim(ctx, "REQ", ref); err != nil {
		return err
	}
	if !validID(fuID) || strings.TrimSpace(buyer) == "" {
		return rules.Fail("INVALID_REQUEST", "fuId and buyer are required")
	}
	if err := rules.CheckAmount(outstandingPaise); err != nil {
		return err
	}
	var existing FactoringUnit
	if ok, err := get(ctx, "FU~"+fuID, &existing); err != nil {
		return err
	} else if ok {
		return rules.Fail("FU_EXISTS", "factoring unit %q is already registered", fuID)
	}
	fu := FactoringUnit{fuID, buyer, "INR", outstandingPaise, rules.Registered, evidenceHash, a.ID, now(ctx)}
	if err := put(ctx, "FU~"+fuID, fu); err != nil {
		return err
	}
	return audit(ctx, fuID, "REGISTER", a.ID, "outstandingPaise="+itoa(outstandingPaise))
}

func (c *Contract) AcceptFactoringUnit(ctx Ctx, fuID, ref string) error {
	a, err := actor(ctx)
	if err != nil {
		return err
	}
	if err := rules.RequireRole(a.Role, rules.RoleOperator); err != nil {
		return err
	}
	if err := claim(ctx, "REQ", ref); err != nil {
		return err
	}
	fu, err := loadFU(ctx, fuID)
	if err != nil {
		return err
	}
	if !rules.CanTransition(fu.Status, rules.Accepted) {
		return rules.Fail("INVALID_LIFECYCLE", "cannot accept a unit in status %s", fu.Status)
	}
	fu.Status, fu.UpdatedAt = rules.Accepted, now(ctx)
	if err := put(ctx, "FU~"+fuID, fu); err != nil {
		return err
	}
	return audit(ctx, fuID, "ACCEPT", a.ID, "buyer acceptance recorded")
}

// DiscountFactoringUnit: the calling financier takes 100% of the outstanding amount.
func (c *Contract) DiscountFactoringUnit(ctx Ctx, fuID, ref string) error {
	a, err := actor(ctx)
	if err != nil {
		return err
	}
	if err := rules.RequireRole(a.Role, rules.RoleFinancier); err != nil {
		return err
	}
	if err := claim(ctx, "REQ", ref); err != nil {
		return err
	}
	fu, err := loadFU(ctx, fuID)
	if err != nil {
		return err
	}
	if !rules.CanTransition(fu.Status, rules.Discounted) {
		return rules.Fail("INVALID_LIFECYCLE", "cannot discount a unit in status %s", fu.Status)
	}
	fu.Status, fu.UpdatedAt = rules.Discounted, now(ctx)
	if err := put(ctx, "FU~"+fuID, fu); err != nil {
		return err
	}
	if err := put(ctx, posKey(fuID, a.ID), Position{fuID, a.ID, fu.OutstandingPaise, 0}); err != nil {
		return err
	}
	return audit(ctx, fuID, "DISCOUNT", a.ID, "initial position "+itoa(fu.OutstandingPaise))
}

func (c *Contract) TransferPosition(ctx Ctx, fuID, toID string, amountPaise int64, ref string) error {
	a, err := actor(ctx)
	if err != nil {
		return err
	}
	if err := rules.RequireRole(a.Role, rules.RoleFinancier); err != nil {
		return err
	}
	if err := claim(ctx, "REQ", ref); err != nil {
		return err
	}
	fu, err := loadFU(ctx, fuID)
	if err != nil {
		return err
	}
	if !rules.CanMove(fu.Status) {
		return rules.Fail("INVALID_LIFECYCLE", "positions cannot move in status %s", fu.Status)
	}
	if toID == a.ID {
		return rules.Fail("INVALID_REQUEST", "cannot transfer to yourself")
	}
	var toCN []byte
	if toCN, err = ctx.GetStub().GetState("PARTID~" + toID); err != nil {
		return err
	}
	var to Participant
	if ok, err := get(ctx, "PART~"+string(toCN), &to); err != nil {
		return err
	} else if !ok || to.Role != rules.RoleFinancier {
		return rules.Fail("RECIPIENT_NOT_ELIGIBLE", "%q is not a registered financier", toID)
	}
	from, err := loadPos(ctx, fuID, a.ID) // read + write of the same key => MVCC conflict on double sale
	if err != nil {
		return err
	}
	if from == nil {
		return rules.Fail("NOT_A_HOLDER", "caller holds no position in %s", fuID)
	}
	dest, err := loadPos(ctx, fuID, toID)
	if err != nil {
		return err
	}
	if dest == nil {
		dest = &Position{FuID: fuID, HolderID: toID}
	}
	nf, nt, err := rules.Transfer(from.AmountPaise, dest.AmountPaise, amountPaise, fu.OutstandingPaise)
	if err != nil {
		return err
	}
	from.AmountPaise, dest.AmountPaise = nf, nt
	if err := put(ctx, posKey(fuID, a.ID), from); err != nil {
		return err
	}
	if err := put(ctx, posKey(fuID, toID), dest); err != nil {
		return err
	}
	if fu.Status == rules.Discounted { // first transfer only; later transfers leave FU untouched
		fu.Status, fu.UpdatedAt = rules.Partial, now(ctx)
		if err := put(ctx, "FU~"+fuID, fu); err != nil {
			return err
		}
	}
	return audit(ctx, fuID, "TRANSFER", a.ID, itoa(amountPaise)+" paise to "+toID)
}

// ReleasePosition: a holder releases part or all of its own position.
func (c *Contract) ReleasePosition(ctx Ctx, fuID string, amountPaise int64, ref string) error {
	a, err := actor(ctx)
	if err != nil {
		return err
	}
	if err := rules.RequireRole(a.Role, rules.RoleFinancier); err != nil {
		return err
	}
	if err := claim(ctx, "REQ", ref); err != nil {
		return err
	}
	fu, err := loadFU(ctx, fuID)
	if err != nil {
		return err
	}
	if !rules.CanMove(fu.Status) {
		return rules.Fail("INVALID_LIFECYCLE", "positions cannot be released in status %s", fu.Status)
	}
	p, err := loadPos(ctx, fuID, a.ID)
	if err != nil {
		return err
	}
	if p == nil {
		return rules.Fail("NOT_A_HOLDER", "caller holds no position in %s", fuID)
	}
	left, err := rules.Release(p.AmountPaise, amountPaise)
	if err != nil {
		return err
	}
	p.AmountPaise, p.ReleasedPaise = left, p.ReleasedPaise+amountPaise
	if err := put(ctx, posKey(fuID, a.ID), p); err != nil {
		return err
	}
	return audit(ctx, fuID, "RELEASE", a.ID, itoa(amountPaise)+" paise released")
}

// SettleReceivable releases every active position once, against a unique settlement reference.
func (c *Contract) SettleReceivable(ctx Ctx, fuID, settlementRef string) error {
	a, err := actor(ctx)
	if err != nil {
		return err
	}
	if err := rules.RequireRole(a.Role, rules.RoleOperator); err != nil {
		return err
	}
	if err := claim(ctx, "SETTLE", settlementRef); err != nil {
		return err
	}
	fu, err := loadFU(ctx, fuID)
	if err != nil {
		return err
	}
	if !rules.CanTransition(fu.Status, rules.Settled) {
		return rules.Fail("INVALID_LIFECYCLE", "cannot settle a unit in status %s", fu.Status)
	}
	positions, err := listPositions(ctx, fuID)
	if err != nil {
		return err
	}
	var released int64
	for i := range positions {
		released += positions[i].AmountPaise
		positions[i].ReleasedPaise += positions[i].AmountPaise
		positions[i].AmountPaise = 0
		if err := put(ctx, posKey(fuID, positions[i].HolderID), positions[i]); err != nil {
			return err
		}
	}
	fu.Status, fu.UpdatedAt = rules.Settled, now(ctx)
	if err := put(ctx, "FU~"+fuID, fu); err != nil {
		return err
	}
	return audit(ctx, fuID, "SETTLE", a.ID, "released "+itoa(released)+" paise, ref "+settlementRef)
}

// ---------- queries ----------

func listPositions(ctx Ctx, fuID string) ([]Position, error) {
	prefix := "POS~" + fuID + "~"
	it, err := ctx.GetStub().GetStateByRange(prefix, prefix+"\U0010ffff")
	if err != nil {
		return nil, err
	}
	defer it.Close()
	out := []Position{}
	for it.HasNext() {
		kv, err := it.Next()
		if err != nil {
			return nil, err
		}
		var p Position
		if err := json.Unmarshal(kv.Value, &p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

func (c *Contract) GetFactoringUnit(ctx Ctx, fuID string) (*FactoringUnit, error) {
	if _, err := actor(ctx); err != nil {
		return nil, err
	}
	return loadFU(ctx, fuID)
}

func (c *Contract) GetPositions(ctx Ctx, fuID string) ([]Position, error) {
	if _, err := actor(ctx); err != nil {
		return nil, err
	}
	return listPositions(ctx, fuID)
}

func (c *Contract) ListFactoringUnits(ctx Ctx) ([]FactoringUnit, error) {
	if _, err := actor(ctx); err != nil {
		return nil, err
	}
	it, err := ctx.GetStub().GetStateByRange("FU~", "FU~\U0010ffff")
	if err != nil {
		return nil, err
	}
	defer it.Close()
	out := []FactoringUnit{}
	for it.HasNext() {
		kv, err := it.Next()
		if err != nil {
			return nil, err
		}
		var fu FactoringUnit
		if err := json.Unmarshal(kv.Value, &fu); err != nil {
			return nil, err
		}
		out = append(out, fu)
	}
	return out, nil
}

func (c *Contract) GetAuditTrail(ctx Ctx, fuID string) ([]AuditEvent, error) {
	if _, err := actor(ctx); err != nil {
		return nil, err
	}
	prefix := "AUD~" + fuID + "~"
	it, err := ctx.GetStub().GetStateByRange(prefix, prefix+"\U0010ffff")
	if err != nil {
		return nil, err
	}
	defer it.Close()
	out := []AuditEvent{}
	for it.HasNext() {
		kv, err := it.Next()
		if err != nil {
			return nil, err
		}
		var e AuditEvent
		if err := json.Unmarshal(kv.Value, &e); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].At < out[j].At })
	return out, nil
}

func itoa(n int64) string { b, _ := json.Marshal(n); return string(b) }

func main() {
	cc, err := contractapi.NewChaincode(&Contract{})
	if err != nil {
		log.Panicf("create chaincode: %v", err)
	}
	if err := cc.Start(); err != nil {
		log.Panicf("start chaincode: %v", err)
	}
}

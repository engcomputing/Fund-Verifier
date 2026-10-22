# Fund-Verifier

**Fund-Verifier is a prototype for making jointly owned fund withdrawals more convenient through transparent, multi-party digital approval.**

#### Vision & originality

Fund-Verifier proposes a digital workflow for co-owned bank funds. Instead of coordinating every co-owner's visit to a branch, a requester submits the transaction details and each required co-owner reviews the same request and records an independent decision. The distinctive idea is to digitize authorization—not remove it.

#### Trust constraint insight

Shared money is difficult to access remotely because banks must prevent unauthorized withdrawals and verify that the right people consented to the exact transaction. Fund-Verifier explores how explicit, transaction-specific approvals and a traceable decision history could reduce in-person coordination without weakening the account's authorization rules.

#### Value & impact

Co-owners, families, and small businesses could benefit from less scheduling friction and clearer records. For example, if three family members jointly own funds but live in different cities, they could review a withdrawal request remotely rather than coordinating a single branch visit—where the bank's policies and applicable rules permit digital authorization.

#### Why TideCloak matters

TideCloak is the intended trust layer for authenticating participants and supporting verifiable identity and access decisions. A production integration would pair it with server-side authorization and bank-controlled transaction checks. **This prototype does not yet make live TideCloak calls**; its approval workflow uses synthetic data and simulated decisions, so it does not claim to provide production-grade authentication.

#### Prototype & storytelling

The demo lets judges create a withdrawal request, inspect its amount and purpose, record two independent demo approvals, track the request status, cancel a pending request, and review or export the session activity log. Look for how the request moves through the approval workflow. No camera-based Face ID, live identity verification, bank connection, or money transfer is implemented.

## Setup

1. Open `index.html` in a modern browser.
2. Use the fictional sample data to create a withdrawal request and try the approval, cancellation, activity-log, and CSV-export interactions.
3. Treat all data and decisions as a demonstration only; do not use it for real financial or identity decisions.

## Production considerations

A real deployment would require authenticated co-owner accounts, server-side enforcement of the account mandate, transaction-bound approvals, replay protection, durable tamper-resistant audit records, privacy and biometric safeguards if facial verification is added, and integration approved by a regulated banking partner.

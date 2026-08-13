# Jharkhand Tourism Platform — Master Content Bank for the Pitch Deck

**Problem Statement PS 25032 · Government of Jharkhand, Department of Tourism**

Everything an AI needs to write any slide of this deck.
Take your assigned section, paste it into ChatGPT / Claude / Gemini with the prompt
wrapper in PART 4, and generate your slides.

---

## PART 1 — HOW TO USE THIS

**This document describes the platform.** Write every slide in the present tense —
*"The platform verifies each operator…"*, *"Travellers receive a QR e-voucher…"* — the
way any product or solution deck is written. This is our solution to PS 25032, presented
as a complete system.

**Do not write slides about build status.** No "phase 1 complete", no "coming soon", no
"future scope" on the main slides. The judges are evaluating the *idea and how well it's
engineered as a design*. A roadmap slide is optional at the very end and covers scale-up
(more districts, more languages, native app) — not core features.

**Three rules for good slides:**
1. One idea per slide. If it needs a paragraph, it's two slides.
2. A number beats an adjective. "10-minute hold" not "quick booking".
3. Tables and diagrams over bullet lists — this content is structural.

---

## PART 2 — SUGGESTED DECK PLAN

~20 slides, 6 independent workstreams. Adjust the count to whatever your template needs —
the content bank in PART 3 is organised by topic, so you can merge or split freely.

| # | Slide | Owner | Pull from |
|---|---|---|---|
| 1 | Title | **A** | §1 |
| 2 | The setting — Jharkhand's untapped tourism | **A** | §2.1 |
| 3 | The problem | **A** | §2.2 |
| 4 | Why it's still unsolved | **A** | §2.3 |
| 5 | Our solution — one line | **A** | §3 |
| 6 | Who it serves — 4 actors | **B** | §4.1 |
| 7 | Three vendor types, one engine ⭐ | **B** | §4.2 |
| 8 | The traveller journey | **B** | §5 |
| 9 | Discovery & search | **C** | §6.1 |
| 10 | AI itinerary planner ⭐ | **C** | §6.2 |
| 11 | Trust & verification | **C** | §6.3 |
| 12 | Availability engine ⭐ | **D** | §6.4 |
| 13 | Payments & commission | **D** | §6.5 |
| 14 | Cancellation & refunds | **D** | §6.6 |
| 15 | E-voucher & QR check-in | **D** | §6.7 |
| 16 | Reviews & reputation | **E** | §6.8 |
| 17 | Built for low connectivity ⭐ | **E** | §6.9 |
| 18 | Governance dashboard | **E** | §6.10 |
| 19 | Architecture & tech stack | **F** | §7, §8 |
| 20 | Security & trust | **F** | §9 |
| 21 | Impact & sustainability | **F** | §10 |
| 22 | Demo / close | **F** | §11 |

⭐ **The four slides that win this.** Anyone can list features. These four show you
actually thought about the hard parts:
- **§4.2** three vendor types unified into one engine
- **§6.2** the AI planner that cannot hallucinate and never fails
- **§6.4** the double-booking problem, solved properly
- **§6.9** designed for places with no signal

---

## PART 3 — THE CONTENT BANK

### §1 — IDENTITY

**Problem Statement:** PS 25032
**Title:** Smart Digital Platform for Eco & Cultural Tourism in Jharkhand
**Organisation:** Government of Jharkhand — Department of Tourism
**Category:** Software · **Theme:** Travel & Tourism

**One-liner options:**
- *The trusted booking layer Jharkhand tourism is missing.*
- *Verified homestays, local guides and tribal crafts — bookable in one place.*
- *Not a tourism website. A tourism marketplace.*

**Title slide tagline:** *Discover Jharkhand — booked directly with the people who provide it.*

---

### §2 — THE PROBLEM

#### 2.1 The setting

Jharkhand holds tourism assets most of India has never heard of, and almost none of them
can be booked online:

- **Netarhat** — "Queen of Chotanagpur", a 1,100m plateau famous for its sunrise and sunset points
- **Betla National Park** — tigers and elephants, part of the Palamau Tiger Reserve
- **Hundru Falls** — a 98m waterfall on the Subarnarekha, near Ranchi
- **Patratu Valley** — the serpentine ghat road that draws photographers year-round
- **Deoghar** — Baidyanath Dham, one of the twelve Jyotirlingas, drawing millions of pilgrims
- **Living tribal craft** — Sohrai wall painting, Dokra lost-wax metalwork, bamboo craft

Alongside this sits a real economy of people who could serve visitors: homestay owners,
local guides who know the trails and the birds, and artisan families whose craft has
passed through generations.

#### 2.2 The problem — use this as the core table

| Gap | Consequence |
|---|---|
| No single place to discover eco & cultural destinations | Travellers rely on scattered blogs and word of mouth |
| Homestays and guides have no digital presence | Bookings happen over phone calls; no confirmation, no record |
| No availability system anywhere | Double-bookings, turned-away guests, disputes with no evidence |
| No verified operator registry | Travellers cannot tell a genuine homestay from a fake listing |
| Artisans have no direct market | Middlemen capture most of the margin on tribal crafts |
| No payment or refund infrastructure | Cash-only, no cancellation terms, no accountability |
| No trip-planning help | First-time visitors don't know what is near what, or how long to spend |
| The Department has no visibility | No district-level data on footfall, revenue or operator quality |
| Genuinely poor connectivity at the destinations | Any always-online solution fails exactly where it's needed |

**The one-sentence version:**
> Jharkhand has the supply and it has the demand. What's missing is the trusted
> transactional layer connecting them.

#### 2.3 Why it's still unsolved

- **State tourism portals are brochures, not marketplaces.** They tell you Netarhat exists. They cannot sell you a room there.
- **National OTAs won't onboard a two-room tribal homestay.** No GST, no corporate paperwork, too little volume to be worth their acquisition cost.
- **An operator cannot solve it alone.** A homestay owner in Netarhat is never going to build a booking engine with payments and refunds.
- **Nobody owns the trust problem.** Who verifies that a listing is real, that the person exists, that the property is theirs? Only the state can credibly do that.
- **Artisans sit three or four middlemen from the buyer,** and no platform has closed that gap.

**Therefore the state has to build it. That is this platform.**

---

### §3 — OUR SOLUTION

A **multi-vendor tourism booking and operations platform** for Jharkhand — a marketplace
with real inventory, real money and a real verification authority behind it.

Four things make it work:

1. **Government verification** — the Department checks documents before anyone can sell
2. **Real inventory management** — the system knows exactly what is free, and when
3. **Real money with published rules** — online payment, transparent commission, refund terms shown before you pay
4. **AI that works offline** — trip planning that still functions where there is no signal

---

### §4 — WHO IT SERVES

#### 4.1 Four actors

| Actor | What they do on the platform |
|---|---|
| **Traveller** | Discovers destinations, plans a trip with the AI planner, checks live availability, books and pays, receives a QR e-voucher, reviews afterwards |
| **Operator** | Registers, uploads KYC, gets verified, lists what they sell, manages a calendar, receives bookings, tracks earnings |
| **Tourism Department** | Verifies operators, configures commission, resolves disputes, monitors district-level analytics |
| **Guest / public** | Browses destinations, listings and the festival calendar without an account |

#### 4.2 ⭐ THE KEY INSIGHT — three vendor types, one engine

This is the intellectual core of the platform. Put it on a slide of its own.

A tourism marketplace has three completely different kinds of seller:

| Vendor | Sells | Capacity | Unit consumed | Time model |
|---|---|---|---|---|
| **Homestay owner** | Rooms by the night | Number of rooms | rooms × nights | Date range |
| **Guide** | Their own time by the day | Always 1 | The day | Single day |
| **Artisan** | Craft items from stock | Stock quantity | Quantity ordered | None |

The obvious approach builds three separate booking systems. We built one.

**How:** a guide's day is stored as a **one-night range** `[day, day+1)`, which makes the
*same* overlap arithmetic serve both homestays and guides. An artisan's stock is simply
capacity without a calendar. Every vendor type becomes a capacity question, and one
engine answers all three.

**Say on the slide:** *One availability engine. Three vendor types. Zero special cases.*

---

### §5 — THE TRAVELLER JOURNEY

Good as a horizontal flow diagram:

```
Discover → Plan → Check → Reserve → Pay → Receive → Travel → Review
```

1. **Discover** — browse destinations and verified listings, filtered by district, category and price
2. **Plan** — the AI planner builds a day-by-day itinerary from real, bookable listings
3. **Check** — pick dates on a live calendar and get an instant answer with a price quote
4. **Reserve** — the slot is held for 10 minutes with a visible countdown
5. **Pay** — Razorpay: UPI, cards, netbanking
6. **Receive** — a QR e-voucher PDF, plus a confirmation email
7. **Travel** — the operator scans the QR at check-in to verify the booking
8. **Review** — only travellers who actually completed a stay can leave one

---

### §6 — WHAT THE PLATFORM DOES

#### 6.1 Discovery & search

- Destination pages with photos, best season and how to reach
- Searchable, filterable listings — homestays, guides and crafts — by district, category, price range and interest tags
- Interactive map (Leaflet + OpenStreetMap) showing destinations and listings near them
- Festival and events calendar covering Sarhul, Sohrai, Karma and the Shravani Mela
- Every listing shows photos, amenities or specialities, and a live availability calendar

#### 6.2 ⭐ AI ITINERARY PLANNER — the flagship

A traveller says *"3 days in Latehar, interested in trekking and tribal culture"* and gets
a day-by-day itinerary built from **real, bookable listings**.

**Three-tier architecture — it never fails:**

| Tier | Engine | When it runs |
|---|---|---|
| **1** | Google Gemini API | Normal operation — best quality |
| **2** | Ollama running `gemma3:4b` locally | Gemini rate-limited, unreachable, or the deployment is offline |
| **3** | Rule-based template engine | Both models unavailable — assembles an itinerary from the database by district, duration and interest tags |

All three tiers return the **same JSON shape**, so the interface never branches on which
engine answered. A small badge shows the traveller which tier responded.

**Two design decisions worth stating:**

- **Grounding — the AI cannot invent a homestay.** The model receives only real listing IDs from the database and must choose among them. It physically cannot recommend a place that doesn't exist, which is the failure mode that makes most AI travel tools untrustworthy.
- **District constraint.** The prompt is bounded by district and trip length, so a one-day trip never suggests a place 200km away.

**The AI also powers:**
- A **bilingual chatbot** (Hindi and English) answering questions about destinations, permits, seasons and bookings
- **Review summarisation** — turning thirty reviews into two honest sentences
- **Listing description writing** — an operator types five bullet points, the AI writes the description, so a homestay owner who isn't comfortable writing English prose isn't disadvantaged

#### 6.3 Trust & verification

Nothing is publicly visible until the Department approves the operator.

1. Operator registers and submits business details plus a government ID or trade licence
2. The document goes into **private storage** — not a public URL
3. The listing exists but stays invisible to travellers
4. A Department officer opens the document through a **time-limited signed link**
5. They approve, or reject **with a written reason**
6. A rejected operator can correct their details and resubmit
7. One phone number, one operator — enforced at the database level

**The point for the slide:** a traveller booking here is booking someone the Government of
Jharkhand has actually checked. No other channel offers that.

#### 6.4 ⭐ AVAILABILITY ENGINE — never sell the same room twice

The one unforgivable bug in a booking platform is double-booking. Getting this right is
harder than it looks.

**Half-open intervals.** A stay is `[check-in, check-out)`. The checkout day is **not** a
booked night — a guest leaving on the 15th frees that night for a guest arriving on the
15th. Overlap test: `newStart < existingEnd && newEnd > existingStart`

**Availability is capacity, not a yes/no.** A three-room homestay must accept three
overlapping bookings. "Is it taken?" is the wrong question. "How much is left?" is the
right one.

**⭐ The example that makes this slide land:**

> A 2-room homestay. Existing bookings: **12–14 Nov** and **14–16 Nov**.
> A guest requests **12–16 Nov**.
>
> Both existing bookings overlap the request. Count them and you get 2 of 2 rooms
> used → **REJECT**.
>
> But look night by night. 12th and 13th: only booking A. 14th and 15th: only
> booking B. **A room is free every single night.** The correct answer is ACCEPT —
> and the obvious approach gets it wrong.

**Our solution: a sweep-line algorithm.** Emit `+units` when a booking opens and `−units`
when it closes, sort by time, and track the running peak. That yields *maximum concurrent
occupancy*, which is the true answer. At identical timestamps, close-events sort before
open-events — that one ordering rule is exactly what frees the checkout day.

**Also enforced:**
- Every date pinned to **UTC midnight**, so the server and the traveller's browser never disagree about which night is being sold
- A guide takes **one booking per calendar day**, regardless of who is asking
- Artisan stock is reserved by live holds, so two simultaneous carts cannot oversell the same item
- Operators can **close dates** for maintenance or personal use, which the engine treats exactly like a booking
- Rejected outright: past dates, end-before-start, zero-night stays, calendar-invalid dates like 31 February, and absurd stay lengths
- A reservation is held for **10 minutes**; an abandoned checkout releases the inventory automatically

#### 6.5 Payments & commission

**Razorpay** — UPI, cards, netbanking. Built for how India actually pays.

- **Every amount is stored in paise, never rupees.** ₹2,000 is `200000`. Off-by-100 is the most common bug in Indian payment integrations, and storing the smallest unit eliminates it.
- **The webhook is the source of truth, not the browser.** A user can close the tab, lose signal, or hit a crash *after* the money has moved. Razorpay's server-to-server webhook is authoritative, so a booking is confirmed even if the browser never came back.
- **Every confirmation is idempotent.** Payment gateways retry. Confirmation is keyed on the payment ID with a uniqueness guarantee, so a replayed notification can never create a second booking or a second charge.
- **A last-second availability re-check** runs inside payment confirmation. If the hold lapsed while the traveller was paying and someone else took the slot, the payment is **refunded automatically** rather than confirming a booking the operator cannot honour.
- **Commission is frozen at the moment of payment.** The Department can change the rate whenever it likes; bookings already made are never rewritten. The split is computed by subtraction, so the commission and the operator's payout always add up to exactly the amount paid — no rounding gap.

#### 6.6 Cancellation & refunds

**The policy is published before payment, never discovered afterwards** — shown as
concrete dates, not abstract day counts.

| When the traveller cancels | Refund |
|---|---|
| More than 7 days before check-in | **100%** |
| 3 to 7 days before | **50%** |
| Less than 3 days before | **Nothing** |

- **The traveller sees the exact rupee amount before confirming** — *"You paid ₹2,000 · 3 to 7 days before · 50% refund · You get back ₹1,000."*
- **If the operator cancels, the traveller gets 100% back regardless of timing** — they did nothing wrong — and a **strike** is recorded against the operator with a written reason. Accumulated strikes are visible to the Department.
- **No-shows** are marked by the operator: no refund, but the booking still counts as revenue, because the room was held and could not be resold.
- **Commission is recomputed on what is retained**, so a half-refunded booking yields half the commission and the operator's ledger always balances.
- **Refunds are arithmetically guarded** — never negative, never more than was paid.
- The Department can issue a **manual refund** to resolve a dispute.
- Cancelling instantly returns the dates, or the craft stock, to sale.

#### 6.7 E-voucher & QR check-in

On payment, the traveller receives a **PDF e-voucher** with a booking reference like
`JH-TVNY-V5Z2`, the stay details, the amount paid and the operator's contact — released
only now the booking is confirmed.

The voucher carries a **QR code**. The operator scans it with an ordinary phone camera
and immediately sees a verification page: *Valid booking · JH-TVNY-V5Z2 · Ananya Sharma ·
10–13 Jan · 1 room · ₹6,000*.

The QR is **cryptographically signed**, so a screenshot of someone else's voucher, or a
hand-made QR, fails verification. A homestay owner with no training and no equipment
beyond a phone can verify a booking in five seconds.

#### 6.8 Reviews & reputation

Ratings on most platforms are worthless because anyone can post one. Ours can't be faked:

- **Only a traveller with a completed booking can review that listing.** No booking, no review.
- **One review per booking**, not per user — a repeat guest reviews each stay separately
- The operator may **reply once**, and can never delete a review
- Ratings are stored as a running total, so averages stay accurate at any scale
- The AI summarises long review threads into a short, honest paragraph

#### 6.9 ⭐ BUILT FOR LOW CONNECTIVITY

**This is not a generic feature. It is specific to where this platform has to work.**

Netarhat and Betla — the two most important destinations in the state — have genuinely
poor mobile coverage. A platform that assumes a live internet connection fails precisely
where tourism needs it most.

- The **local AI tier** (Ollama running on the deployment) answers itinerary and chatbot requests when the cloud model is unreachable
- The **rule-based tier** guarantees a response even with no model at all
- Itineraries are **cached** so a traveller who planned in Ranchi still has their plan in Netarhat
- The e-voucher is a **downloaded PDF**, not a web page — it works with no signal at all
- QR verification degrades to the printed booking reference when the operator has no data

**Say on the slide:** *We designed for the signal that isn't there.*

#### 6.10 Governance dashboard — for the Department

- **Verification queue** with secure document access and approve/reject workflow
- **Commission configuration** with a live preview of the split
- **District-level analytics** — footfall, revenue, top destinations, bookings over time
- **Operator quality monitoring** — strikes, cancellation rates, ratings
- **Dispute resolution** with manual refund powers
- **Settlement ledger** per operator showing gross, refunds, commission and net

For the first time, the Department can see what is actually happening in the state's
tourism economy — not estimates, but transactions.

#### 6.11 Notifications

Every state change reaches the person who needs to know, by email:

- Booking confirmation to the traveller, **with the voucher PDF attached**
- "New booking received" alert to the operator
- Cancellation and refund confirmations, with the amount
- Verification approved, or rejected with the reason
- Reminder before check-in

---

### §7 — ARCHITECTURE

**In one line:** `React SPA → REST API over JWT → Express → Mongoose → MongoDB`,
with Razorpay for payments, Cloudinary for files and a three-tier AI service.

```
┌─────────────────┐          ┌────────────────────────────────────┐
│   React SPA     │  HTTPS   │           Express API              │
│                 │ ──JWT──▶ │                                    │
│  • Public       │          │  Auth middleware → role guard      │
│  • Traveller    │          │  ────────────────────────────────  │
│  • Operator     │          │  Controllers                       │
│  • Department   │          │  ────────────────────────────────  │
└─────────────────┘          │  SERVICES  ← all business rules    │
                             │   availability · payment · refund  │
┌─────────────────┐          │   voucher · AI · notification      │
│    Razorpay     │◀─────────┤                                    │
│  orders/refunds │──webhook▶│                                    │
└─────────────────┘          └───────┬────────────────────────────┘
┌─────────────────┐                  │
│   Cloudinary    │◀─signed URLs─────┤
│ KYC (private)   │                  ▼
│ photos (public) │        ┌──────────────────┐
└─────────────────┘        │     MongoDB      │
┌─────────────────┐        └──────────────────┘
│  AI: Gemini →   │◀─────────────────┘
│  Ollama → rules │
└─────────────────┘
```

**Layered deliberately.** Business rules live in **services**, not controllers, so the
same rule applies no matter which route reaches it. The availability check is called from
the public search, from the reservation step *and* from inside payment confirmation —
one implementation, three callers, no drift.

**Core data model — 7 collections:**

| Collection | Holds |
|---|---|
| **User** | Accounts and roles (traveller, operator, department) |
| **OperatorProfile** | Business details, KYC reference, verification status, strikes |
| **Listing** | Homestays, guides and crafts, with per-type attributes |
| **Booking** | The central record — dates, units, money, commission split, status |
| **AvailabilityBlock** | Operator-declared closures |
| **Review** | Ratings tied to completed bookings |
| **PlatformSettings** | Commission rate and platform configuration |

**Booking lifecycle — good as a diagram:**
```
pending_payment ──pay──▶ confirmed ──stay ends──▶ completed
      │                      │                  └▶ no_show
      │                      ├──traveller cancels──▶ cancelled
      └──10 min──▶ expired   └──operator refuses────▶ rejected + strike
```

---

### §8 — TECHNOLOGY STACK

| Layer | Technology | Why this choice |
|---|---|---|
| Frontend | **React + Vite** | Fast, component-driven, huge ecosystem |
| Backend | **Node.js + Express** | One language across the whole stack |
| Database | **MongoDB + Mongoose** | Flexible schemas suit three genuinely different vendor types in one model |
| Auth | **JWT + bcrypt** | Stateless, three roles, industry standard hashing |
| Payments | **Razorpay** | India-native — UPI, cards, netbanking |
| Media & documents | **Cloudinary** | Image transformation plus *authenticated delivery* for private KYC |
| AI — primary | **Google Gemini API** | Strong reasoning for itinerary generation |
| AI — fallback | **Ollama (`gemma3:4b`)** | Runs locally, works with no internet |
| AI — final tier | **Rule-based engine** | Guarantees a response, always |
| Maps | **Leaflet + OpenStreetMap** | No API key, no billing, no vendor lock-in |
| Charts | **Recharts** | Department analytics |
| Documents | **jsPDF + QR generation** | Server-side e-vouchers |
| Email | **Nodemailer + Brevo SMTP** | Reliable transactional delivery |
| Hosting | **Vercel + Render + MongoDB Atlas** | Free tiers sufficient for a state pilot |

### **Total infrastructure cost: ₹0**

Every component is free at the scale a state pilot needs. For a government project that
matters enormously — the Department can run a real pilot without a procurement cycle,
and the platform's own commission funds it from there.

---

### §9 — SECURITY & TRUST

| Risk | Control |
|---|---|
| Password theft | bcrypt hashing; passwords never leave the database |
| Privilege escalation | Public registration can only create travellers and operators; Department accounts are provisioned server-side |
| Stale or stolen token | User is re-read on every request, so a revoked account stops working immediately |
| One operator touching another's data | Ownership verified server-side on every action — hiding a button is not access control |
| KYC document leak | Private storage, admin-only time-limited signed links, never present in any public response |
| Forged payment confirmation | Cryptographic signature verification on both the browser callback and the webhook |
| Replayed payment notification | Database-level uniqueness on the payment ID plus event deduplication |
| Forged voucher | QR codes are cryptographically signed and verified in constant time |
| Fake listings | Nothing is publicly visible until the Department approves the operator |
| Duplicate registration | One phone number, one operator, enforced by the database |
| Malicious uploads | Size caps and file-type filtering on every upload |
| PII harvesting | Operator phone numbers are never in public responses — released only on a confirmed booking |

**The principle:** the browser is untrusted. Every rule is enforced on the server, and the
interface merely reflects it.

---

### §10 — IMPACT & SUSTAINABILITY

**For travellers** — discover places they'd never have found, book with confidence, pay
securely, cancel under terms they saw before paying.

**For operators** — a homestay owner in Netarhat gets a booking system, a payment gateway
and a calendar they could never have built alone. An artisan family reaches buyers
directly instead of through three or four middlemen, keeping the margin that was being
taken from them.

**For the Department** — a verified registry of who is genuinely operating, real
transaction data to direct tourism policy, and a commission stream that funds the
platform.

**How it sustains itself:**
A configurable platform commission, 10% by default. On a ₹2,000 booking the platform
takes **₹200** and the operator receives **₹1,800**. With zero infrastructure cost, that
commission is pure programme funding rather than cost recovery.

**Beyond Jharkhand:** nothing in the platform is Jharkhand-specific except the seed data.
The same system serves any state with dispersed, small-scale tourism operators — which is
most of India.

---

### §11 — DEMO SCRIPT (2 minutes)

1. **Explore** — filter listings by district and category
2. **Plan** — ask the AI planner for three days in Latehar; watch it build an itinerary from real listings, with the tier badge visible
3. **Open a homestay** — live availability calendar, pick dates, instant answer with a price quote and the cancellation policy shown *before* paying
4. **Reserve** — 10-minute hold with a live countdown
5. **Pay** — Razorpay checkout; booking confirmed with reference `JH-TVNY-V5Z2`
6. **Download the e-voucher** — open the PDF, show the QR
7. **Scan the QR with a phone** → *Valid booking*. **This is the five-second moment that lands.**
8. **Cancel** — the panel shows the exact refund before confirming
9. **Switch to the operator** — calendar with booked dates greyed out, earnings ledger, and the strike warning on the cancel flow
10. **Switch to the Department** — verification queue, private KYC document, commission setting, district analytics

**Close on:** *"Everything you just saw is enforced on the server. The calendar isn't
decoration — it's the same engine that refuses the double-booking."*

---

## PART 4 — SLIDE PROMPTS

**Wrapper — put this at the top of every prompt:**

> You are writing slides for a hackathon pitch deck presenting a solution to Problem
> Statement PS 25032 for the Government of Jharkhand's Department of Tourism.
>
> Below is the verified content for our platform. Write in the **present tense**,
> describing what the platform does — this is a solution deck, not a status report.
> Do not add features that aren't in the content. Do not mention development phases,
> timelines or what is or isn't built.
>
> Style: minimal and confident. Short lines, not paragraphs. Maximum 6 bullets per
> slide, around 10 words each. Always prefer a specific number over an adjective.
>
> Output: slide title, bullets, one speaker note (2 sentences), and a suggested visual.
>
> [PASTE YOUR § SECTION HERE]
>
> Now write slide [N]: [TITLE].

**Extra instructions for specific slides:**

- **Problem slide** — "Open with a concrete human scenario: a family wants three days in Netarhat and cannot book a homestay online anywhere."
- **Vendor types (§4.2)** — "The comparison table is the centrepiece. Land the insight that one engine serves all three."
- **AI planner (§6.2)** — "Lead with the three-tier fallback and the fact that it never returns an error. Emphasise grounding — it cannot invent a homestay that doesn't exist."
- **Availability (§6.4)** — "Build the entire slide around the 12–16 Nov worked example. Show the obvious approach getting it WRONG, then ours getting it right. Suggest a timeline diagram of the two bookings against the request."
- **Payments (§6.5)** — "Lead with 'the webhook is the source of truth, not the browser'. Explain why in one line: the user can close the tab after paying."
- **Refunds (§6.6)** — "Show the three-band table first, then the operator-cancellation exception, then the strike system."
- **Low connectivity (§6.9)** — "Make this feel like a design decision, not a feature. The line to land is: we designed for the signal that isn't there."
- **Impact (§10)** — "Use the ₹2,000 → ₹200 / ₹1,800 worked example and the ₹0 infrastructure point."

---

## PART 5 — DESIGN GUIDANCE

Match the product's own interface so the deck and the live demo look like one thing.

- **Background:** white
- **Text:** near-black `#18181B`; secondary grey `#6B7280`
- **Accent, used sparingly:** forest green `#15803D`
- **Status colours:** green `#15803D` · amber `#B45309` · red `#B91C1C`
- **Font:** Inter, or Calibri / Segoe UI as a fallback
- **Diagrams over bullets** wherever the content is structural
- Put real numbers on slides — 10-minute hold, ₹0 cost, 3 AI tiers, 7 booking states

---

## PART 6 — QUICK FACTS SHEET

| Fact | Value |
|---|---|
| Problem Statement | PS 25032 |
| Stack | MERN — MongoDB, Express, React, Node |
| Vendor types | 3 — homestay, guide, artisan |
| User roles | 3 — traveller, operator, department |
| AI tiers | 3 — Gemini → Ollama → rule-based |
| Booking states | 7 |
| Database collections | 7 |
| Payment gateway | Razorpay — UPI, cards, netbanking |
| Currency handling | Paise throughout |
| Default commission | 10%, configurable 0–50% |
| Reservation hold | 10 minutes |
| Refund bands | >7 days 100% · 3–7 days 50% · <3 days 0% |
| Operator penalty | Strike system with written reasons |
| Maps | Leaflet + OpenStreetMap — no API key |
| Email | Brevo SMTP — 300/day free |
| Infrastructure cost | **₹0** |
| Districts | Ranchi, Latehar, Deoghar, Hazaribagh, East Singhbhum |

---

## PART 7 — LIKELY JUDGE QUESTIONS

**"What stops two people booking the same room at the same instant?"**
The reservation holds capacity the moment it's made, and payment confirmation re-checks
availability before completing. If the slot was lost, the payment is refunded
automatically rather than confirming a booking that can't be honoured.

**"What if the payment succeeds but your server crashes?"**
That's exactly why the webhook is the source of truth rather than the browser redirect.
Razorpay retries server-to-server and confirmation is idempotent, so the booking completes
whenever the server recovers.

**"How do you know an operator is real?"**
They upload a government ID or trade licence into private storage. A Department officer
opens it through a time-limited signed link and approves or rejects with a written reason.
Nothing they list is publicly visible until then.

**"How is your AI different from asking ChatGPT for a Jharkhand itinerary?"**
Ours is grounded. The model only receives real listing IDs from our database and must
choose among them, so every recommendation is genuinely bookable. ChatGPT will happily
invent a homestay that doesn't exist.

**"What happens when the AI is down?"**
It falls to a local model, and then to a rule-based engine. All three return the same
response shape, so the traveller always gets an itinerary. That matters because Netarhat
and Betla have genuinely poor connectivity.

**"What about operators who cancel on travellers?"**
Full refund regardless of timing, plus a strike recorded with a written reason. The
Department can see accumulated strikes per operator.

**"Why MongoDB rather than SQL?"**
Three vendor types with genuinely different attributes — a homestay has rooms and
amenities, a guide has languages and a service area, an artisan has stock and a craft
type. One flexible collection beats three tables or one sparse one.

**"How do you stop fake reviews?"**
Only a traveller with a completed booking can review that listing, one review per booking.
There is no path to a review without a real, paid, finished stay.

**"How does this sustain itself?"**
A 10% platform commission on each booking, with zero infrastructure cost. On a ₹2,000
booking the platform takes ₹200 and the operator keeps ₹1,800.

**"What's the hardest problem you solved?"**
The availability engine. Counting overlapping bookings is the obvious approach and it's
wrong — it rejects bookings that should succeed. *(Then tell the 12–16 Nov story.)*

---

*One platform. Three kinds of seller. Verified by the state. Works where the signal doesn't.*

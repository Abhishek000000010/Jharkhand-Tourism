# Smart Digital Platform for Eco & Cultural Tourism in Jharkhand

**Problem Statement ID:** PS 25032
**Organisation:** Government of Jharkhand — Department of Tourism
**Category:** Software
**Theme:** Travel & Tourism

---

## 1. Problem Statement

Jharkhand has genuine tourism assets — Netarhat, Betla National Park, Hundru Falls, Patratu Valley, Deoghar — along with a living tribal craft tradition (Sohrai painting, Dokra metalwork, bamboo work) and a network of local guides and homestay owners. Almost none of it is bookable online.

The gaps as they exist today:

| Gap | Consequence |
|---|---|
| No single place to discover eco & cultural destinations | Tourists rely on scattered blogs and word of mouth |
| Homestays and guides have no digital presence | Bookings happen over phone calls; no confirmation, no record |
| No availability system | Double-bookings, no-shows, disputes with no evidence |
| No verified operator registry | Tourists cannot tell a real homestay from a fake listing |
| Artisans have no direct market | Middlemen capture most of the margin on tribal crafts |
| No payment or refund infrastructure | Cash-only, no cancellation policy, no accountability |
| Department has no visibility | No district-level data on footfall, revenue, or operator quality |
| Poor connectivity at the destinations themselves | Any solution that assumes always-on internet fails on the ground |

**In one line:** the state has the supply and the demand, but no trusted transactional layer connecting them.

---

## 2. The Solution

A **multi-vendor tourism booking and operations platform** — not a brochure website, not a media archive. It is a marketplace with real inventory, real money, and a real verification authority.

The whole system follows from four kinds of users:

### 2.1 Tourists
Discover destinations, search verified homestays / guides / crafts, plan an itinerary with AI assistance, book and pay online, receive a QR e-voucher, and review what they actually experienced.

### 2.2 Operators (three distinct vendor types)

| Vendor type | Sells | Inventory unit | Booking rule |
|---|---|---|---|
| **Homestay owner** | Rooms | Room × night | A room booked 12–15 Nov cannot be resold for overlapping nights |
| **Guide** | Their own time | Guide × day | One guide, one booking per day — no exceptions |
| **Artisan** | Physical craft products | Stock quantity | Stock decrements on confirmed order |

Each has different availability logic. That difference is the technical core of the project.

### 2.3 Tourism Department Admin
Verifies operators against uploaded ID and property documents, configures platform commission, handles disputes and refunds, and monitors district-level analytics.

### 2.4 Guest / Public
Browses destinations, the festival calendar, and public listings without an account.

---

## 3. Modules

### Public Site
- Destination pages with photos, best season, how to reach
- Searchable listings — homestays, guides, crafts — filtered by district, price, type, interest
- **AI itinerary planner** — the flagship feature
- Festival & event calendar
- Interactive map of destinations and nearby listings

### Tourist Account
- My bookings with status timeline
- QR e-voucher (downloadable PDF)
- Craft cart and orders
- Reviews on completed bookings
- Saved trips / wishlist

### Operator Portal
- Onboarding with document upload
- Listing management (create / edit / deactivate)
- Availability calendar with manual date blocking
- Incoming bookings — accept / reject
- Earnings and settlement ledger

### Admin Portal
- Operator verification queue with approve / reject + reason
- Commission configuration
- Dispute and refund handling
- District-level analytics dashboard

---

## 4. Technology Stack — All Free

Every component below is free at the tier we need. Nothing in this project requires a paid plan.

### Core — MERN

| Tech | Role | Cost |
|---|---|---|
| **MongoDB Atlas** | Database | Free tier (M0, 512 MB) — flexible schemas suit three different vendor types |
| **Express.js** | REST API server | Open source |
| **React** (Vite) | Frontend SPA | Open source |
| **Node.js** | Runtime | Open source |
| **Mongoose** | ODM / schema validation | Open source |

### Payments

| Tech | Role | Cost |
|---|---|---|
| **Razorpay** | Booking payments, craft orders, refunds via API, webhooks | Free **test mode** — full API, no real money |

### Media & Files

| Tech | Role | Cost |
|---|---|---|
| **Cloudinary** | Homestay photos, destination galleries, product images, operator KYC docs | Free tier (25 credits/mo) — includes transformations for thumbnails and **authenticated delivery** for private KYC documents |

### Email

| Tech | Role | Cost |
|---|---|---|
| **Nodemailer** | Mail sending library | Open source |
| **Brevo SMTP** | SMTP relay | Free tier — 300 emails/day, more than enough |

### AI — Three-Tier Fallback

| Tier | Tech | Role | Cost |
|---|---|---|---|
| **Tier 1** | **Google Gemini API** | Itinerary generation, chatbot, review summarisation, auto-writing listing descriptions | Free tier with generous rate limits |
| **Tier 2** | **Ollama (`gemma3:4b`)** | Same features, runs locally when Gemini is rate-limited or offline | Free, runs on local hardware |
| **Tier 3** | **Rule-based engine** | Template itinerary assembled from DB by district + duration + interest tags | No cost — pure logic |

All three tiers return the **same JSON shape**, so the UI never branches on which tier answered.

**Why this matters for Jharkhand specifically:** Netarhat and Betla have genuinely poor connectivity. The local-model fallback and cached itineraries are a real design decision for the deployment environment, not a demo gimmick.

### Maps & Visualisation

| Tech | Role | Cost |
|---|---|---|
| **Leaflet** | Map rendering | Open source |
| **OpenStreetMap** | Map tiles | Free — no API key, no billing |
| **Recharts** | Operator earnings charts, admin analytics | Open source |

### Documents & Auth

| Tech | Role | Cost |
|---|---|---|
| **jsPDF** | Booking voucher PDF generation | Open source |
| **qrcode** | QR code on voucher — operator scans at check-in | Open source |
| **JWT (jsonwebtoken)** | Stateless auth across three roles | Open source |
| **bcrypt** | Password hashing | Open source |

### Hosting (Free Tier)

| Tech | Role | Cost |
|---|---|---|
| **Vercel** | React frontend | Free hobby tier |
| **Render** | Node/Express API | Free tier |
| **MongoDB Atlas** | Database | Free M0 cluster |

**Total infrastructure cost: ₹0.**

---

## 5. Development Phases

The project is built in **testable increments**. Each phase produces something that can be clicked through and verified before the next phase begins. No phase depends on work from a later phase.

---

### Phase 0 — Project Skeleton
**Goal:** both halves of the app running and talking to each other.

- Folder structure — `client` (React + Vite), `server` (Node + Express)
- MongoDB Atlas connection, environment configuration
- Express server with a health-check route
- React app boots, calls the health check, displays connection status
- Base styling / UI library setup

**Test:** run both dev servers; the browser shows a live successful ping to the backend.

---

### Phase 1 — Authentication & Roles
**Goal:** three separate kinds of user that cannot access each other's areas.

- `User` schema with a role field — `tourist` / `operator` / `admin`
- Registration and login, JWT issue and verification, bcrypt password hashing
- Role-based route-guard middleware on the server
- Protected route wrappers on the client

**Design decision:** one account = one role. A person wanting to be both tourist and operator registers twice. Simpler, and avoids an entire class of permission bugs.

**Design decision:** public registration can only create `tourist` and `operator`. Admin is a government role, so it is created out-of-band:

```bash
npm run seed:admin --prefix server
```

Credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `server/.env`.

**Test:** register one account of each role, log in as each, confirm a tourist token is rejected by an operator-only endpoint and vice versa. Also confirm that posting `role: "admin"` to the register endpoint still produces a tourist.

---

### Phase 2 — Operator Onboarding & Verification
**Goal:** only real, department-approved operators can appear on the platform.

- Operator profile schema — business details, contact, district, document references
- Cloudinary upload for KYC documents using **authenticated delivery / signed URLs**
- Operator submits → status becomes `pending`
- Admin verification queue — approve, or reject with a written reason
- Rejected operators can edit and resubmit
- Duplicate registration blocked by unique index on phone / property

**Security rule:** KYC documents must never be publicly accessible and must never appear in any public API response.

**Test:** submit as an operator, see the request in the admin queue, approve one and reject another with a reason, confirm the rejected operator can resubmit, and confirm the KYC document URL is not accessible without authorisation.

---

### Phase 3 — Listings
**Goal:** the three vendor types can list what they sell, and the public can find it.

- Homestay schema — rooms, per-night rate, amenities, photos
- Guide schema — languages, specialities (trekking, birding, tribal culture), service area, day rate
- Artisan product schema — craft type, price, stock quantity, photos
- Full CRUD from the operator portal
- **Listings from a `pending` operator exist in the database but never appear publicly**
- Public search and filter — by district, type, price range, interest tags

**Test:** create listings as both a verified and a pending operator; confirm only the verified operator's listings are publicly visible; confirm search and filters return correct results.

---

### Phase 4 — Availability Engine
**Goal:** the platform can never sell the same thing twice. This is the technical heart of the project.

**Core design decision — availability is capacity, not a boolean.** A listing's `rooms`
field is a count of interchangeable rooms, so a 3-room homestay must accept 3 overlapping
bookings. All three vendor types therefore run through one engine:

| Category | Capacity | Unit consumed | Dates |
|---|---|---|---|
| Homestay | `rooms` | rooms × nights | half-open range |
| Guide | `1` | the day | single day, stored as `[day, day + 1)` |
| Artisan | `stockQuantity` | quantity ordered | none |

Storing a guide's day as a one-night range means the *same* overlap arithmetic covers
homestays and guides, with no special-casing.

- Date-range availability model per room, all dates pinned to **UTC midnight** so server and browser agree on which night is being sold
- **Overlap detection:** `newStart < existingEnd && newEnd > existingStart`
- **Max-concurrent sweep, not a naive overlap count.** Counting overlapping bookings over-rejects: in a 2-room homestay, bookings of 12th–14th and 14th–16th both overlap a 12th–16th request but never coincide, so a room is free every night. A sweep-line over open/close events gives the true peak.
- **Checkout day is not a blocked night** — a guest leaving on 15 Nov frees that night for a guest arriving 15 Nov. Falls out of sorting close-events before open-events at equal timestamps.
- Guide: one confirmed booking per calendar day, regardless of tourist
- Artisan: stock reserved by live holds, so two simultaneous carts cannot oversell
- Operator manual date blocks (personal use, maintenance) consume full capacity, and the engine refuses to block over live bookings
- Server-side validation — past dates, end-before-start, zero-night stays, calendar-invalid dates (31 Feb), over-long stays, and non-integer quantities all rejected
- Holds carry a 10-minute expiry and **release themselves at query time** — an abandoned checkout frees inventory with no cron required
- Money stored in **paise** from this phase onward, snapshotted at booking time

**Key file:** `server/services/availabilityService.js` is the single source of truth.
Phase 5 must call `checkAvailability()` again inside the payment-confirm step, because
two tourists can both pass the check and only one can win.

**Test the failure cases explicitly:**
- Book 12–15 Nov, then attempt 14–16 Nov → must be rejected
- Book 12–15 Nov, then attempt 15–17 Nov → must be **accepted**
- Book a guide for a day, then attempt a second booking that day as a different tourist → must be rejected
- Attempt to order more artisan stock than exists → must be rejected
- Submit a booking with dates in the past via the API directly → must be rejected

---

### Phase 5 — Booking & Payment
**Goal:** money moves correctly, and the system survives things going wrong mid-transaction.

- Razorpay order creation and checkout integration, with an existing order **reused** when a tourist reopens the payment sheet
- **Webhook is the source of truth** — never the browser redirect, because the confirm API can crash after a successful payment. Both paths funnel into one idempotent `confirmBookingPaid()`, so it does not matter which arrives first.
- Webhook mounted with `express.raw()` **ahead of `express.json()`** — the signature is an HMAC over the exact bytes Razorpay sent, so verifying against a re-serialised object would fail on any key-order or whitespace difference
- Last-second availability re-check inside the payment-confirm step. If the hold lapsed while the tourist was paying and someone else legitimately took the slot, the money is **refunded** rather than confirming a booking the operator cannot honour.
- 10-minute slot hold on abandoned or failed payment. Inventory frees itself at query time; an in-process sweeper additionally reconciles the stored status every minute.
- Commission split — platform percentage and operator amount both stored **at booking time**, because the commission rate may change later. The operator payout is derived by **subtraction**, guaranteeing `commission + payout === amount` with no rounding gap.
- **Idempotent** confirm and refund handlers keyed on the Razorpay payment ID — a unique sparse index makes a replayed webhook lose at the database rather than in application logic. Webhook deliveries are additionally deduplicated by event id.
- All currency handled in **paise, not rupees** — off-by-100 is the single most common bug in Indian payment integrations
- Voucher generation — jsPDF document with an embedded QR code. The QR carries an **HMAC**, so scanning proves the server issued the voucher; it resolves to a small verification page an operator can read on their phone.

**Works without a Razorpay account.** With `RAZORPAY_KEY_ID` blank the whole payment
layer falls back to a local mock gateway, exactly like the Cloudinary fallback. The mock
endpoint hard-refuses to run whenever real credentials are present.

**Test:** complete a full pay → confirm → voucher flow; replay the same webhook twice and confirm no duplicate booking or double refund; abandon a payment and confirm the slot auto-releases after the hold window.

**Webhook setup (for real Razorpay):** the webhook must reach your server from the
internet, so during development expose it with a tunnel and register that URL under
Settings → Webhooks in the Razorpay dashboard, subscribing to `payment.captured` and
`payment.failed`. Put the secret you chose into `RAZORPAY_WEBHOOK_SECRET` — without it,
incoming webhooks are rejected rather than trusted.

---

### Phase 6 — Cancellation & Refund Policy
**Goal:** every cancellation path has a defined, visible, correct financial outcome.

- Refund policy engine, shown to the tourist **before** payment as concrete dates rather than day counts:
  - More than 7 days before check-in → **100% refund**
  - 3 to 7 days before → **50% refund**
  - Less than 3 days before → **no refund**
- The policy lives in `server/services/refundService.js` as **data**, so the terms quoted before payment and the money moved afterwards come from one source and cannot drift apart
- Operator rejects an already-confirmed booking → **full refund regardless of the policy** (the traveller did nothing wrong) plus a **strike** recorded against the operator, with an audit trail of reasons
- Tourist no-show → operator marks it; no refund, but it still counts as operator revenue. Only allowed once the stay has actually started.
- Refund arithmetic guards — a refund can never be negative, never exceed the amount actually paid, and repeated calls clamp to what remains un-refunded
- Partial refunds issued through the Razorpay refunds API, with `refund.processed` webhooks reconciling refunds initiated from the Razorpay dashboard
- **Commission is recomputed on the retained amount.** A half-refunded booking yields half the commission, preserving `commissionPaise + operatorPayoutPaise === amountPaise − refundedPaise`. The whole operator ledger therefore balances: `gross − refunded === commission + earnings`.
- Cancelling or rejecting puts the dates (or craft stock) straight back on sale

**Craft orders sit outside the time-based bands.** A craft order has no check-in date to
count down to, and the model has no dispatch or delivery state, so there is no point at
which one stops being refundable — they are treated as fully refundable and labelled as
such. Adding fulfilment states is the honest prerequisite for a stricter policy.

**Test:** cancel a booking in each of the three windows and verify the exact refund amount; have an operator reject a confirmed booking and verify the auto-refund and strike; mark a no-show and verify it appears as revenue.

---

### Phase 7 — Transactional Email
**Goal:** every state change notifies the person who needs to know.

- Booking confirmation to tourist, with voucher PDF attached
- "New booking received" alert to the operator
- Cancellation and refund confirmation
- Verification approved / rejected notice to the operator, including the rejection reason
- Failures queued and retried — an email outage must never fail a booking

**Test:** trigger each of the five events and confirm the correct email arrives with the correct content and attachment.

---

### Phase 8 — AI Itinerary Planner & Chatbot
**Goal:** the flagship feature, and it must never return an error.

- `askAI()` abstraction implementing the three-tier fallback chain
- **Grounding** — the model receives only real listing IDs pulled from the database and is forced to select from them, so it cannot invent a homestay that does not exist
- District constraint in the prompt — a one-day trip must not suggest a place 200 km away
- Malformed JSON handling — strip markdown fences, parse inside try/catch, fall through to the next tier on failure
- Streaming / loading state, since the local model takes 10–20 seconds
- **Visible tier badge** in the UI showing which engine answered
- Multilingual chatbot — Hindi and English
- Review summarisation and auto-written listing descriptions from operator bullet points

**Test:** force each tier individually — remove the Gemini key, then stop Ollama — and confirm the feature degrades gracefully with an identical response shape and a correct tier badge each time.

---

### Phase 9 — Reviews & Ratings
**Goal:** ratings that cannot be faked.

- A review can only be written by a tourist with a **completed** booking for that specific listing
- **One review per booking**, not per user — a repeat guest can review each stay
- Operator may reply once; operators can never delete a review
- Store `ratingSum` and `ratingCount` and update them on write, rather than averaging across all reviews on every read

**Test:** attempt to review a listing never booked (must fail), a booking not yet completed (must fail), and a completed booking (must succeed); confirm the average rating updates correctly and a second review on the same booking is rejected.

---

### Phase 10 — Dashboards, Analytics & Map
**Goal:** operators and the department can see what is happening.

- Operator earnings dashboard — bookings over time, gross revenue, commission deducted, net settlement (Recharts)
- Admin analytics — district-level bookings, revenue, top destinations, operator counts by status
- Leaflet + OpenStreetMap destination map with nearby listings
- Settlement ledger with status — **simulated, not a real bank payout**, and labelled as such

**Test:** verify every chart against known seeded booking data.

---

### Phase 11 — Seed Data & Demo Preparation
**Goal:** the platform looks real, and the demo runs without surprises.

- Seed 15 genuine Jharkhand listings across all three vendor types, with real destinations and realistic pricing
- Seed destinations, festival calendar, and sample completed bookings so reviews and analytics have data
- Full end-to-end rehearsal of the demo path
- Edge-case sanity pass across all previous phases

---

## 6. Cross-Cutting Rules

These apply in every phase and are non-negotiable.

### Authorisation
- Operator A must never read, edit, or cancel Operator B's bookings — **ownership is checked on every mutation**, on the server, not just hidden in the UI
- Role middleware protects every endpoint; a tourist token hitting an operator route is rejected
- Hiding a button is not access control

### Data Integrity
- All financial amounts stored in paise
- Commission percentages and split amounts frozen at transaction time
- Suspended or deactivated operators keep their existing confirmed bookings valid — only *new* bookings are blocked

### Files
- Cloudinary `public_id` stored alongside every upload, so a failed database write can be cleaned up instead of leaving an orphaned image
- Client-side image compression plus a server-side size cap
- KYC documents behind authenticated delivery, never in a public response

### Resilience
- Payment webhooks are idempotent
- The AI feature always returns a valid response through some tier
- Email failure never blocks a transaction

---

## 7. Explicitly Out of Scope

Stated honestly rather than faked:

- **Real bank settlements** to operators — the ledger and status are simulated
- **Real-time chat** between tourist and operator
- **Native mobile app** — the web app is responsive instead
- **Full multilingual translation** beyond Hindi and English
- **Live payment mode** — Razorpay runs in test mode throughout

---

## 8. Repository Layout

```
JHK Tourism/
├── client/          React + Vite frontend
│   └── public/images/destinations/   Harvested destination photos
├── server/          Node + Express API
│   ├── data/        Districts gazetteer, curation rules, harvested destinations
│   └── scripts/     Harvest + seeding utilities
├── docs/            Phase notes, API reference, demo script
└── README.md
```

### Destinations vs listings

The two are separate collections, and the distinction matters:

| | `Destination` | `Listing` |
|---|---|---|
| What it is | A place to visit — waterfall, temple, dam, hill | Inventory an operator sells |
| Who owns it | Nobody; it is public geography | A verified operator |
| Bookable | No | Yes |
| Has a price | No | Yes |
| Source | Harvested from Wikipedia, curated | Created in the operator portal |

Keeping places out of `Listing` is deliberate. An earlier seed pushed Wikipedia
articles about waterfalls into `Listing` with a random `homestay`/`guide` label, a
random price and `district: "Jharkhand"` — which made Hundru Falls a homestay at
₹1,819 a night and left the district filter matching nothing.

#### Refreshing the destination data

The pipeline is four steps, in order:

```bash
npm run harvest:destinations --prefix server
node server/scripts/mergeSupplements.js
node server/scripts/repairImages.js
npm run seed:destinations --prefix server
```

1. **harvest** — crawls the Jharkhand category tree on Wikipedia two levels
   deep, resolves each page's district (an explicit "X district" in the lead
   beats the coordinate lookup, which can only snap to the nearest
   headquarters), classifies it by type, applies the curation rules in
   `server/data/curation.js`, and downloads a 1200px photo.
2. **mergeSupplements** — adds the hand-curated places in
   `server/data/supplementalDestinations.js` that the crawl cannot reach.
3. **repairImages** — searches Wikimedia Commons for anything still
   unillustrated, then **drops every destination that still has no
   photograph**. A card with no image looks broken, and a place nobody has
   photographed for Commons is a marginal one; a wrong photo is worse than
   either, so matches are accepted only when the filename names the place.
4. **seed:destinations** — upserts on `slug` and retires anything no longer in
   the file, so it is safe to re-run.

The result is **82 destinations across 22 districts, every one with a real
photograph**. Raising that number means adding entries to
`supplementalDestinations.js` with an `imageSearch` term, or dropping photos
into `client/public/images/destinations/` named after the slug.

### Running locally

```bash
cd server && npm install && cp .env.example .env && npm run dev
```

```bash
cd client && npm install && npm run dev
```

Then create the admin account once:

```bash
npm run seed:admin --prefix server
```

Optional development data — one approved operator plus a listing of each vendor type,
which is the minimum needed to exercise the availability engine by hand:

```bash
npm run seed:demo --prefix server
```

The server refuses to start if `JWT_SECRET` or `MONGO_URI` is missing, rather than
signing tokens with `undefined`. Cloudinary credentials are optional in development —
leave them blank and uploads fall back to local mock placeholders.

Visit `/system` in the client for a live API + database connectivity check.

---

## 9. Phase Status

| Phase | Name | Status |
|---|---|---|
| 0 | Project Skeleton | **Complete** |
| 1 | Authentication & Roles | **Complete** |
| 2 | Operator Onboarding & Verification | **Complete** |
| 3 | Listings | **Complete** |
| 4 | Availability Engine | **Complete** |
| 5 | Booking & Payment | **Complete** |
| 6 | Cancellation & Refund Policy | **Complete** |
| 7 | Transactional Email | **Complete** |
| 8 | AI Itinerary Planner & Chatbot | **Complete** |
| 9 | Reviews & Ratings | **Complete** |
| 10 | Dashboards, Analytics & Map | Not started |
| 11 | Seed Data & Demo Preparation | Not started |

Each phase is tested and signed off before the next begins.

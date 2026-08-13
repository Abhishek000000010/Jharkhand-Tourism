import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

dotenv.config();

/**
 * Additive demo data for the operator analytics dashboard.
 *
 * Unlike `seed:demo`, this NEVER clears a collection. Everything it writes hangs
 * off dedicated guest accounts on the @seed.test domain, which is what makes
 * removal exact: delete those users and everything that references them, and the
 * database is back exactly as it was.
 *
 *   node scripts/seedAnalyticsDemo.js                      seed
 *   node scripts/seedAnalyticsDemo.js --remove             undo
 *   node scripts/seedAnalyticsDemo.js --operator=a@b.test  pick a different host
 */

const SEED_DOMAIN = '@seed.test';
const DEFAULT_OPERATOR = 'homestay@demo.test';
const PASSWORD = 'demo1234';
const COMMISSION_PERCENT = 10;

const MS_DAY = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const REMOVE = args.includes('--remove');
const operatorEmail = (args.find(a => a.startsWith('--operator=')) || '').split('=')[1] || DEFAULT_OPERATOR;

// Deterministic pseudo-randomness, so re-running produces the same dashboard
// instead of a different-looking demo every time.
let rngState = 20260813;
const rnd = () => {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
};
const pick = (list) => list[Math.floor(rnd() * list.length)];
const between = (min, max) => min + Math.floor(rnd() * (max - min + 1));

const utc = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date, days) => new Date(date.getTime() + days * MS_DAY);

const GUESTS = [
  'Priya Kachhap', 'Arjun Mahto', 'Sneha Toppo', 'Rohit Bedia', 'Kavita Munda', 'Imran Ansari',
];

const COMMENTS = [
  'Spotless rooms and the home-cooked food was the highlight. Would come back.',
  'Very warm hosts. The morning view over the valley is worth the trip alone.',
  'Simple, clean and honest. Exactly what was described in the listing.',
  'Great location for exploring the area. Hot water in the mornings was appreciated.',
  'Comfortable stay. Wifi was patchy but everything else was excellent.',
  'The family looked after us properly. Felt like staying with relatives.',
];

const REPLIES = [
  'Thank you so much — you are welcome back any time.',
  'Grateful for the kind words. Do visit again in the winter, the valley is beautiful then.',
  'Thanks for staying with us! We have since improved the wifi.',
];

const ENQUIRIES = [
  'Namaste, is parking available for one car?',
  'Do you serve vegetarian dinner? We are a family of four.',
  'Is the homestay reachable by road during monsoon?',
  'Can we check in late, around 10pm?',
  'Are children welcome? We have a 6 year old.',
  'How far is the nearest waterfall from your place?',
];

const HOST_REPLIES = [
  'Namaste! Yes, free parking for two cars right outside.',
  'Of course — all our meals are vegetarian and home-cooked.',
  'Yes, the road is metalled the whole way. No trouble even in the rains.',
];

const connect = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI);
};

const remove = async () => {
  const guests = await User.find({ email: new RegExp(`${SEED_DOMAIN}$`) }).select('_id').lean();
  const guestIds = guests.map(g => g._id);

  if (guestIds.length === 0) {
    console.log('Nothing to remove — no seeded guests found.');
    return;
  }

  const conversations = await Conversation.find({ tourist: { $in: guestIds } }).select('_id').lean();
  const conversationIds = conversations.map(c => c._id);

  const [messages, convos, reviews, bookings, users] = await Promise.all([
    Message.deleteMany({ conversation: { $in: conversationIds } }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    Review.deleteMany({ tourist: { $in: guestIds } }),
    Booking.deleteMany({ tourist: { $in: guestIds } }),
    User.deleteMany({ _id: { $in: guestIds } }),
  ]);

  // Reviews carried ratings into the listing aggregates; recompute rather than
  // decrement, so the totals are correct even if this is run twice.
  const listings = await Listing.find({}).select('_id').lean();
  for (const listing of listings) {
    const remaining = await Review.find({ listing: listing._id }).select('rating').lean();
    await Listing.findByIdAndUpdate(listing._id, {
      ratingSum: remaining.reduce((total, r) => total + r.rating, 0),
      ratingCount: remaining.length,
    });
  }

  console.log({
    guests: users.deletedCount,
    bookings: bookings.deletedCount,
    reviews: reviews.deletedCount,
    conversations: convos.deletedCount,
    messages: messages.deletedCount,
  });
};

const seed = async () => {
  const operator = await User.findOne({ email: operatorEmail, role: 'operator' });
  if (!operator) throw new Error(`No operator found with email ${operatorEmail}`);

  // Seed across ALL their homestays, not a handful: occupancy divides by the whole
  // portfolio's capacity, so leaving most listings empty makes the headline number
  // look broken even though it is arithmetically right.
  const listings = await Listing.find({ operator: operator._id, category: 'homestay', isActive: true })
    .sort('createdAt')
    .lean();

  if (listings.length === 0) throw new Error('That operator has no active homestay listings to seed against');

  // Reuse guests across runs so re-seeding tops up rather than duplicating people.
  const guests = [];
  for (let i = 0; i < GUESTS.length; i += 1) {
    const email = `guest${i + 1}${SEED_DOMAIN}`;
    // eslint-disable-next-line no-await-in-loop
    let guest = await User.findOne({ email });
    // eslint-disable-next-line no-await-in-loop
    if (!guest) guest = await User.create({ name: GUESTS[i], email, password: PASSWORD, role: 'tourist' });
    guests.push(guest);
  }

  const today = utc(new Date());
  const bookings = [];
  let counter = 0;

  const ref = () => `JH-SEED-${String(++counter).padStart(4, '0')}`;

  const money = (listing, nights, units) => {
    const perUnit = listing.price * 100;
    return { perUnit, amount: perUnit * nights * units };
  };

  const split = (amountPaise, refundedPaise) => {
    const net = Math.max(0, amountPaise - refundedPaise);
    const commissionPaise = Math.round((net * COMMISSION_PERCENT) / 100);
    return { commissionPaise, operatorPayoutPaise: net - commissionPaise };
  };

  /**
   * Walk a cursor forward through the window placing non-overlapping stays.
   *
   * Laying bookings down sequentially rather than at random dates is what keeps
   * the seed inside each listing's real room capacity — an overlapping pile would
   * make the availability engine and the occupancy figures disagree.
   */
  const layDown = (listing, windowStart, windowEnd, decide) => {
    let cursor = addDays(windowStart, between(0, 4));

    while (cursor < windowEnd) {
      const nights = between(1, 4);
      const checkOut = addDays(cursor, nights);
      if (checkOut > windowEnd) break;

      const units = Math.min(listing.rooms || 1, between(1, 2));
      const { perUnit, amount } = money(listing, nights, units);
      // Only the first four guests ever book. The last two exist purely to ask
      // questions, so the enquiry-to-booking rate isn't a meaningless 100%.
      const guest = pick(guests.slice(0, 4));
      const { status, refundedPaise, paidAt } = decide(cursor);

      bookings.push({
        tourist: guest._id,
        listing: listing._id,
        operator: operator._id,
        category: 'homestay',
        checkIn: cursor,
        checkOut,
        units,
        pricePerUnitPaise: perUnit,
        amountPaise: amount,
        commissionPercent: COMMISSION_PERCENT,
        ...split(amount, refundedPaise),
        refundedPaise,
        status,
        paidAt,
        razorpayPaymentId: `pay_seed_${counter + 1}`,
        bookingRef: ref(),
        guestName: guest.name,
        guestPhone: `+91 9${between(100000000, 999999999)}`,
        ...(refundedPaise > 0 ? { cancelledAt: cursor, cancelledBy: 'tourist', cancellationReason: 'Change of plans' } : {}),
      });

      // A gap between stays — a homestay that is 100% full every night reads as fake.
      cursor = addDays(checkOut, between(1, 5));
    }
  };

  // ---- Fourteen months of history ----
  // Deliberately longer than the dashboard's longest range: with only six months
  // seeded, a six-month view compares against an empty period and every delta
  // comes out as a nonsensical +400%.
  for (const listing of listings) {
    for (let monthsAgo = 14; monthsAgo >= 1; monthsAgo -= 1) {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo + 1, 1));

      layDown(listing, start, end, (checkIn) => {
        const roll = rnd();
        if (roll < 0.12) {
          // Half-refunded late cancellation — keeps the ledger's refund column honest
          return { status: 'cancelled', refundedPaise: 0, paidAt: addDays(checkIn, -between(3, 20)) };
        }
        if (roll < 0.18) return { status: 'no_show', refundedPaise: 0, paidAt: addDays(checkIn, -between(3, 20)) };
        return { status: 'completed', refundedPaise: 0, paidAt: addDays(checkIn, -between(2, 25)) };
      });
    }

    // ---- The next 45 days, which is what the heatmap and arrivals show ----
    layDown(listing, today, addDays(today, 45), (checkIn) => ({
      status: 'confirmed',
      refundedPaise: 0,
      paidAt: addDays(checkIn, -between(4, 30)),
    }));
  }

  // Cancellations refund half under the policy; apply it after the fact so the
  // split maths above stays in one place.
  for (const booking of bookings) {
    if (booking.status === 'cancelled') {
      booking.refundedPaise = Math.round(booking.amountPaise / 2);
      Object.assign(booking, split(booking.amountPaise, booking.refundedPaise));
    }
  }

  const created = await Booking.insertMany(bookings);

  // ---- Reviews on most completed stays; some deliberately left unanswered ----
  const completed = created.filter(b => b.status === 'completed');
  const reviewDocs = [];

  completed.forEach((booking, index) => {
    if (rnd() > 0.7) return;

    reviewDocs.push({
      booking: booking._id,
      tourist: booking.tourist,
      listing: booking.listing,
      operator: operator._id,
      rating: rnd() < 0.72 ? 5 : between(3, 4),
      comment: COMMENTS[index % COMMENTS.length],
      // Roughly a third go unanswered so the attention queue has something real in it
      ...(rnd() < 0.65 ? { operatorReply: REPLIES[index % REPLIES.length] } : {}),
    });
  });

  const reviews = await Review.insertMany(reviewDocs);

  for (const listing of listings) {
    const own = reviews.filter(r => String(r.listing) === String(listing._id));
    const existing = await Review.find({ listing: listing._id }).select('rating').lean();
    await Listing.findByIdAndUpdate(listing._id, {
      ratingSum: existing.reduce((total, r) => total + r.rating, 0),
      ratingCount: existing.length,
      // `own` is only used to make the intent obvious in logs
      ...(own.length ? {} : {}),
    });
  }

  // ---- Enquiries, some of which converted and some still waiting on a reply ----
  let threads = 0;
  let unanswered = 0;

  for (let i = 0; i < 12; i += 1) {
    const guest = guests[i % guests.length];
    const listing = listings[i % listings.length];

    // eslint-disable-next-line no-await-in-loop
    const existing = await Conversation.findOne({ listing: listing._id, tourist: guest._id });
    if (existing) continue;

    const askedAt = addDays(today, -between(2, 40));
    const body = ENQUIRIES[i % ENQUIRIES.length];
    const answered = rnd() < 0.6;

    // eslint-disable-next-line no-await-in-loop
    const conversation = await Conversation.create({
      listing: listing._id,
      tourist: guest._id,
      operator: operator._id,
      lastMessage: body,
      lastMessageAt: askedAt,
      lastSenderRole: 'tourist',
      unreadOperator: answered ? 0 : 1,
      unreadTourist: 0,
    });

    // eslint-disable-next-line no-await-in-loop
    await Message.create({
      conversation: conversation._id,
      sender: guest._id,
      senderRole: 'tourist',
      body,
      createdAt: askedAt,
      readAt: answered ? askedAt : null,
    });

    if (answered) {
      const reply = HOST_REPLIES[i % HOST_REPLIES.length];
      const repliedAt = addDays(askedAt, 1);

      // eslint-disable-next-line no-await-in-loop
      await Message.create({
        conversation: conversation._id,
        sender: operator._id,
        senderRole: 'operator',
        body: reply,
        createdAt: repliedAt,
      });

      conversation.lastMessage = reply;
      conversation.lastMessageAt = repliedAt;
      conversation.lastSenderRole = 'operator';
      // eslint-disable-next-line no-await-in-loop
      await conversation.save();
    } else {
      unanswered += 1;
    }

    threads += 1;
  }

  console.log({
    operator: operator.email,
    listings: listings.length,
    guests: guests.length,
    bookings: created.length,
    completed: completed.length,
    confirmedAhead: created.filter(b => b.status === 'confirmed').length,
    reviews: reviews.length,
    reviewsAwaitingReply: reviews.filter(r => !r.operatorReply).length,
    enquiries: threads,
    enquiriesUnanswered: unanswered,
  });
};

try {
  await connect();
  if (REMOVE) await remove();
  else await seed();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

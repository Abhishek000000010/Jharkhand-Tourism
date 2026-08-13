import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Listing from '../models/Listing.js';
import Destination from '../models/Destination.js';
import OperatorProfile from '../models/OperatorProfile.js';

/**
 * Everything the traveller's dashboard shows, in one round trip.
 *
 * The page used to assemble itself from /api/bookings/mine plus a listings URL
 * that does not exist, and then read prices off fields the Listing model has
 * never had — so the recommendations strip was permanently empty. One endpoint
 * that returns exactly what the page renders is easier to keep honest.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Money actually committed. A refund reduces what the traveller really spent. */
const netPaise = (b) => Math.max(0, (b.amountPaise || 0) - (b.refundedPaise || 0));

/** Nights for a stay, days for a guide, and zero for a craft order. */
const nightsOf = (b) => {
  if (b.category === 'artisan' || !b.checkIn || !b.checkOut) return 0;
  return Math.max(0, Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / DAY_MS));
};

/** Statuses where money changed hands and the trip counts as real. */
const PAID = ['confirmed', 'completed'];

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d) => d.toLocaleString('en-IN', { month: 'short' });

// @desc    Overview for the signed-in traveller
// @route   GET /api/tourist/dashboard
// @access  Private/Tourist
export const getTouristDashboard = async (req, res) => {
  try {
    const touristId = req.user.id;
    const now = new Date();

    const [bookings, reviews, districtNames] = await Promise.all([
      Booking.find({ tourist: touristId })
        .populate('listing', 'title category district images price')
        .sort('-createdAt')
        .lean(),
      Review.find({ tourist: touristId }).select('booking rating').lean(),
      Destination.distinct('district', { isActive: true }),
    ]);

    const reviewedBookingIds = new Set(reviews.map(r => String(r.booking)));

    const paid = bookings.filter(b => PAID.includes(b.status));
    const completed = bookings.filter(b => b.status === 'completed');

    // "Upcoming" means paid for and not yet started. A craft order has no
    // check-in date, so it is never a trip on the calendar.
    const upcoming = bookings
      .filter(b => b.status === 'confirmed' && b.checkIn && new Date(b.checkIn) >= now)
      .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));

    // --- Headline numbers -------------------------------------------------
    const spentPaise = paid.reduce((sum, b) => sum + netPaise(b), 0);
    const nights = paid.reduce((sum, b) => sum + nightsOf(b), 0);

    const visitedDistricts = [...new Set(paid.map(b => b.listing?.district).filter(Boolean))];

    const reviewable = completed.filter(b => !reviewedBookingIds.has(String(b._id)));

    // --- Things actually waiting on the traveller -------------------------
    // Ordered by urgency: an expiring hold loses the booking, a trip starting
    // tomorrow needs packing, a review can wait.
    const liveHolds = bookings.filter(
      b => b.status === 'pending_payment' && b.holdExpiresAt && new Date(b.holdExpiresAt) > now
    );
    const startingSoon = upcoming.filter(b => new Date(b.checkIn) - now <= 7 * DAY_MS);

    const attention = [];
    if (liveHolds.length) {
      attention.push({
        key: 'payment',
        label: `Finish paying for ${liveHolds.length} booking${liveHolds.length > 1 ? 's' : ''}`,
        count: liveHolds.length,
        link: '/bookings',
        urgent: true,
      });
    }
    if (startingSoon.length) {
      attention.push({
        key: 'soon',
        label: `${startingSoon.length} trip${startingSoon.length > 1 ? 's' : ''} starting within a week`,
        count: startingSoon.length,
        link: '/bookings',
      });
    }
    if (reviewable.length) {
      attention.push({
        key: 'review',
        label: `Review ${reviewable.length} completed trip${reviewable.length > 1 ? 's' : ''}`,
        count: reviewable.length,
        link: '/bookings',
      });
    }

    // --- Spend over the last six months -----------------------------------
    // Built from a fixed month window rather than from the bookings, so the
    // chart keeps its shape when a traveller has one booking or none.
    const series = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      series.push({ key: monthKey(d), label: monthLabel(d), paise: 0, trips: 0 });
    }
    const byMonth = new Map(series.map(s => [s.key, s]));
    for (const b of paid) {
      const bucket = byMonth.get(monthKey(new Date(b.createdAt)));
      if (bucket) {
        bucket.paise += netPaise(b);
        bucket.trips += 1;
      }
    }

    // --- Where the money went ---------------------------------------------
    const categories = ['homestay', 'guide', 'artisan'];
    const spendByCategory = categories.map(category => {
      const rows = paid.filter(b => b.category === category);
      return {
        category,
        paise: rows.reduce((sum, b) => sum + netPaise(b), 0),
        count: rows.length,
      };
    });

    // --- District progress -------------------------------------------------
    const visitCount = new Map();
    for (const b of paid) {
      const d = b.listing?.district;
      if (d) visitCount.set(d, (visitCount.get(d) || 0) + 1);
    }
    const districts = districtNames
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name, visits: visitCount.get(name) || 0 }));

    // --- What to look at next ----------------------------------------------
    // Highest rated first, and never something they have already booked —
    // recommending a stay the traveller is currently sitting in reads as broken.
    const approved = await OperatorProfile.find({ status: 'approved' }).select('user').lean();
    const bookedListingIds = bookings.map(b => b.listing?._id).filter(Boolean);

    const candidates = await Listing.find({
      isActive: true,
      operator: { $in: approved.map(p => p.user) },
      _id: { $nin: bookedListingIds },
    })
      .select('title category district price images ratingSum ratingCount')
      .lean();

    const recommendations = candidates
      .map(l => ({
        id: String(l._id),
        title: l.title,
        category: l.category,
        district: l.district,
        price: l.price,
        image: l.images?.[0] || null,
        rating: l.ratingCount > 0 ? Number((l.ratingSum / l.ratingCount).toFixed(1)) : null,
        ratingCount: l.ratingCount || 0,
      }))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.ratingCount - a.ratingCount)
      .slice(0, 4);

    const next = upcoming[0] || null;

    res.status(200).json({
      summary: {
        upcoming: upcoming.length,
        completed: completed.length,
        totalBookings: bookings.length,
        spentPaise,
        nights,
        districtsVisited: visitedDistricts.length,
        districtsTotal: districts.length,
        reviewsWritten: reviews.length,
        reviewsPending: reviewable.length,
      },
      nextTrip: next && {
        id: String(next._id),
        listingId: String(next.listing?._id || ''),
        title: next.listing?.title || 'Your trip',
        district: next.listing?.district || 'Jharkhand',
        category: next.category,
        checkIn: next.checkIn,
        checkOut: next.checkOut,
        nights: nightsOf(next),
        image: next.listing?.images?.[0] || null,
        // Calendar days, floored — a trip tomorrow morning should not read as
        // "in 0 days" just because it is less than 24 hours away.
        daysUntil: Math.max(0, Math.ceil((new Date(next.checkIn) - now) / DAY_MS)),
        bookingRef: next.bookingRef || null,
      },
      attention,
      upcomingTrips: upcoming.slice(0, 5).map(b => ({
        id: String(b._id),
        title: b.listing?.title || 'Booking',
        district: b.listing?.district || '',
        category: b.category,
        checkIn: b.checkIn,
        nights: nightsOf(b),
        amountPaise: netPaise(b),
      })),
      series: series.map(({ label, paise, trips }) => ({ label, paise, trips })),
      spendByCategory,
      districts,
      recommendations,
    });
  } catch (error) {
    console.error('getTouristDashboard Error:', error);
    res.status(500).json({ success: false, message: 'Could not load your dashboard' });
  }
};

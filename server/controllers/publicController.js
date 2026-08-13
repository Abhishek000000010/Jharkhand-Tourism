import Listing from '../models/Listing.js';
import OperatorProfile from '../models/OperatorProfile.js';

// @desc    Get public listings with filters
// @route   GET /api/public/listings
// @access  Public
export const getPublicListings = async (req, res) => {
  try {
    const { category, district, maxPrice, minPrice, search } = req.query;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));

    // 1. Find all APPROVED operators.
    // Only the `user` field is needed — selecting the whole document would pull
    // every operator's kycDocumentId into memory on a public, unauthenticated route.
    const approvedProfiles = await OperatorProfile.find({ status: 'approved' })
      .select('user')
      .lean();
    const approvedOperatorIds = approvedProfiles.map(p => p.user);

    // 2. Build listing query
    const query = {
      operator: { $in: approvedOperatorIds },
      isActive: true
    };

    if (category) query.category = category;
    if (district) query.district = district;

    // Guard against NaN from junk query strings, and support a price range
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      query.price = {};
      if (Number.isFinite(min)) query.price.$gte = min;
      if (Number.isFinite(max)) query.price.$lte = max;
    }

    if (search && search.trim()) {
      // Escape regex metacharacters so a user searching "c++" doesn't crash the query
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }

    const [listings, total] = await Promise.all([
      Listing.find(query)
        .populate('operator', 'name')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Listing.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: listings.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      listings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single public listing by ID
// @route   GET /api/public/listings/:id
// @access  Public
export const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('operator', 'name').lean();

    // Every failure below returns the same 404 so this route can't be used to
    // probe which listings exist but are hidden or belong to unverified operators.
    if (!listing || !listing.isActive) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Verify operator is approved
    const profile = await OperatorProfile.findOne({ user: listing.operator?._id, status: 'approved' }).lean();
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Append operator business info for public viewing.
    // contactPhone is deliberately NOT included: it is personal data, and handing it
    // out before a booking lets tourists bypass the platform entirely. It gets
    // released on the voucher once a booking is confirmed (Phase 5).
    const publicData = {
      ...listing,
      operatorDetails: {
        businessName: profile.businessName,
        district: profile.district,
      }
    };

    res.status(200).json({ success: true, listing: publicData });
  } catch (error) {
    // A malformed ObjectId throws a CastError — that's a bad request, not a server fault
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

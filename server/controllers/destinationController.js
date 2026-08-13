import Destination from '../models/Destination.js';
import Listing from '../models/Listing.js';
import OperatorProfile from '../models/OperatorProfile.js';
import { JHARKHAND_DISTRICTS } from '../data/districts.js';

/** Shared filter builder so the list route and the facet counts never drift apart. */
const buildQuery = ({ district, type, search }) => {
  const query = { isActive: true };
  if (district) query.district = district;
  if (type) query.type = type;
  if (search && search.trim()) {
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { description: { $regex: safe, $options: 'i' } },
    ];
  }
  return query;
};

// @desc    List destinations with filters
// @route   GET /api/public/destinations
// @access  Public
export const getDestinations = async (req, res) => {
  try {
    const { district, type, search } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    // A high ceiling is deliberate: the Explore page is meant to show the whole
    // state at once, and the entire dataset is only a few hundred documents.
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 60));

    const query = buildQuery({ district, type, search });

    const [destinations, total] = await Promise.all([
      Destination.find(query)
        .sort({ district: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Destination.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: destinations.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      destinations,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Districts and types actually present in the data, with counts
// @route   GET /api/public/destinations/facets
// @access  Public
//
// The filter dropdowns used to be a hardcoded list of five districts, most of
// which had nothing behind them. Driving them from the data means an option can
// never return an empty result set.
export const getDestinationFacets = async (req, res) => {
  try {
    const [districtAgg, typeAgg, listingDistricts] = await Promise.all([
      Destination.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$district', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Destination.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Listing.distinct('district', { isActive: true }),
    ]);

    // Union of districts that have destinations and districts that have
    // bookable listings, so one set of dropdowns serves both Explore tabs.
    const districtNames = new Set([
      ...districtAgg.map(d => d._id),
      ...listingDistricts,
    ]);

    res.status(200).json({
      success: true,
      districts: districtAgg.map(d => ({ name: d._id, count: d.count })),
      allDistricts: JHARKHAND_DISTRICTS
        .map(d => d.name)
        .filter(n => districtNames.has(n)),
      types: typeAgg.map(t => ({ name: t._id, count: t.count })),
      total: districtAgg.reduce((sum, d) => sum + d.count, 0),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Single destination, plus bookable listings near it
// @route   GET /api/public/destinations/:idOrSlug
// @access  Public
export const getDestinationById = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);

    const destination = await Destination.findOne(
      isObjectId ? { _id: idOrSlug } : { slug: idOrSlug }
    ).lean();

    if (!destination || !destination.isActive) {
      return res.status(404).json({ success: false, message: 'Destination not found' });
    }

    // Nearby inventory: same district, approved operators only — the same
    // visibility rule the public listings feed enforces.
    const approvedProfiles = await OperatorProfile.find({ status: 'approved' })
      .select('user')
      .lean();
    const approvedOperatorIds = approvedProfiles.map(p => p.user);

    const nearbyListings = await Listing.find({
      district: destination.district,
      isActive: true,
      operator: { $in: approvedOperatorIds },
    })
      .populate('operator', 'name')
      .limit(6)
      .lean();

    res.status(200).json({ success: true, destination, nearbyListings });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Destination not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

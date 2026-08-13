import OperatorProfile from '../models/OperatorProfile.js';
import EmailJob from '../models/EmailJob.js';
import cloudinary from '../config/cloudinary.js';
import { isMailConfigured } from '../config/mailer.js';
import { notifyOperatorDecision } from '../services/emailService.js';
import { pushOperatorDecision } from '../services/notificationService.js';
import { invalidateKnowledgeCache } from '../services/knowledgeService.js';

// @desc    Get all pending operator profiles
// @route   GET /api/admin/operators/pending
// @access  Private/Admin
export const getPendingOperators = async (req, res) => {
  try {
    // Defaults to the pending queue, but ?status=approved|rejected lets the admin
    // review past decisions instead of only ever seeing the inbox.
    const { status = 'pending' } = req.query;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status filter' });
    }

    const operators = await OperatorProfile.find({ status })
      .populate('user', 'name email')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: operators.length, operators });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify (approve/reject) an operator
// @route   PUT /api/admin/operators/:id/verify
// @access  Private/Admin
export const verifyOperator = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const profile = await OperatorProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Operator profile not found' });
    }

    profile.status = status;
    // Clear any previous reason on approval, so a re-approved operator doesn't
    // keep showing a stale rejection message on their status page.
    profile.rejectionReason = status === 'rejected' ? rejectionReason : '';

    await profile.save();

    // Approval is what makes an operator's listings public, so the assistant's
    // cached catalogue is wrong the moment this changes.
    invalidateKnowledgeCache();

    // Tell the operator either way — a rejection is useless to them if nobody says why
    await notifyOperatorDecision(profile, status, rejectionReason);
    await pushOperatorDecision(profile, status, rejectionReason);

    res.status(200).json({ success: true, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Recent transactional email, so a stuck message is visible rather than silent
// @route   GET /api/admin/emails
// @access  Private/Admin
export const getEmailQueue = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = ['pending', 'sent', 'failed'].includes(status) ? { status } : {};

    // The rendered HTML body is deliberately excluded — it is large and this is a
    // monitoring view, not a mail reader.
    const jobs = await EmailJob.find(filter)
      .select('type to subject status attempts lastError sentAt createdAt')
      .sort('-createdAt')
      .limit(50)
      .lean();

    const [pending, sent, failed] = await Promise.all([
      EmailJob.countDocuments({ status: 'pending' }),
      EmailJob.countDocuments({ status: 'sent' }),
      EmailJob.countDocuments({ status: 'failed' }),
    ]);

    res.status(200).json({
      success: true,
      counts: { pending, sent, failed },
      delivery: isMailConfigured() ? 'live' : 'local (SMTP not configured)',
      jobs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get secure signed URL for KYC document
// @route   GET /api/admin/operators/:id/kyc-url
// @access  Private/Admin
export const getSecureKycUrl = async (req, res) => {
  try {
    const profile = await OperatorProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Operator profile not found' });
    }

    if (!profile.kycDocumentId || profile.kycDocumentId.startsWith('mock_')) {
      return res.status(200).json({ success: true, url: 'https://placehold.co/800x600/1a1a2e/eee?text=Mock+KYC+Document' });
    }

    // Generate signed URL (expires in 1 hour)
    const url = cloudinary.url(profile.kycDocumentId, {
      type: 'authenticated',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600 
    });

    res.status(200).json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get admin analytics and metrics
// @route   GET /api/admin/analytics
// @access  Private/Admin
export const getAnalytics = async (req, res) => {
  try {
    const Booking = (await import('../models/Booking.js')).default;
    const User = (await import('../models/User.js')).default;

    const revenueStatuses = ['confirmed', 'completed', 'no_show'];
    const allBookings = await Booking.find({ status: { $in: revenueStatuses } }).populate('listing');
    
    let totalRevenue = 0; // gross
    let totalCommission = 0;
    let totalPayout = 0;
    const bookingsByDistrict = {};
    
    allBookings.forEach(b => {
      totalRevenue += (b.amountPaise / 100);
      totalCommission += (b.commissionPaise / 100);
      totalPayout += (b.operatorPayoutPaise / 100);
      
      if (b.listing && b.listing.district) {
        const d = b.listing.district;
        bookingsByDistrict[d] = (bookingsByDistrict[d] || 0) + 1;
      }
    });

    const districtChartData = Object.keys(bookingsByDistrict).map(key => ({
      name: key,
      value: bookingsByDistrict[key]
    }));

    // Operator counts by status
    const operators = await User.find({ role: 'operator' }).populate('operatorProfile');
    const operatorStats = { approved: 0, pending: 0, rejected: 0, suspended: 0 };
    
    // We should directly fetch from OperatorProfile, since the status is there
    const profiles = await OperatorProfile.find();
    profiles.forEach(p => {
      if (p.status) {
        operatorStats[p.status] = (operatorStats[p.status] || 0) + 1;
      }
    });
    
    const operatorChartData = [
      { name: 'Approved', count: operatorStats.approved },
      { name: 'Pending', count: operatorStats.pending },
      { name: 'Rejected', count: operatorStats.rejected }
    ];

    res.json({
      summary: {
        totalRevenue,
        totalCommission,
        totalPayout,
        totalBookings: allBookings.length
      },
      districtChartData,
      operatorChartData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

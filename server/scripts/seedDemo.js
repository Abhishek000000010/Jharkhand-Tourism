import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import OperatorProfile from '../models/OperatorProfile.js';
import Listing from '../models/Listing.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Destination from '../models/Destination.js';
import { DEMO_LISTINGS } from '../data/demoListings.js';

dotenv.config();


/**
 * Phase 11: Full Production-like Seed
 * Seeds a comprehensive demo environment representing genuine Jharkhand tourism:
 * - 4 Operators (across different districts and categories)
 * - 2 Tourists
 * - 15 Listings (Homestays, Guides, Artisans)
 * - Sample Bookings (Pending, Confirmed, Completed)
 * - Sample Reviews (attached to completed bookings)
 * 
 * npm run seed:demo
 */

const PASSWORD = 'demo1234';

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // 1. CLEAR ALL PREVIOUS DEMO DATA
    console.log('Clearing existing database collections...');
    await Review.deleteMany({});
    await Booking.deleteMany({});
    await Listing.deleteMany({});
    await OperatorProfile.deleteMany({});
    // Delete non-admins
    await User.deleteMany({ role: { $ne: 'admin' } });

    // 2. CREATE USERS
    console.log('Creating demo users...');
    
    // Operators
    const opHomestay = await User.create({ name: 'Ravi Oraon', email: 'homestay@demo.test', password: PASSWORD, role: 'operator' });
    const opGuide = await User.create({ name: 'Sanjay Munda', email: 'guide@demo.test', password: PASSWORD, role: 'operator' });
    const opArtisan1 = await User.create({ name: 'Geeta Devi', email: 'artisan1@demo.test', password: PASSWORD, role: 'operator' });
    const opArtisan2 = await User.create({ name: 'Karan Mahato', email: 'artisan2@demo.test', password: PASSWORD, role: 'operator' });

    // Tourists
    const tourist1 = await User.create({ name: 'Ananya Sharma', email: 'tourist1@demo.test', password: PASSWORD, role: 'tourist' });
    const tourist2 = await User.create({ name: 'Vikram Singh', email: 'tourist2@demo.test', password: PASSWORD, role: 'tourist' });

    // 3. CREATE OPERATOR PROFILES
    console.log('Creating operator profiles...');
    await OperatorProfile.create([
      { user: opHomestay._id, businessName: 'Jharkhand Heritage Stays', contactPhone: '9835012341', district: 'Ranchi', kycDocumentId: 'mock_kyc_1', status: 'approved' },
      { user: opGuide._id, businessName: 'Wild Trails Jharkhand', contactPhone: '9835012342', district: 'Latehar', kycDocumentId: 'mock_kyc_2', status: 'approved' },
      { user: opArtisan1._id, businessName: 'Sohrai Art Collective', contactPhone: '9835012343', district: 'Hazaribagh', kycDocumentId: 'mock_kyc_3', status: 'approved' },
      { user: opArtisan2._id, businessName: 'Tribal Metalworks', contactPhone: '9835012344', district: 'East Singhbhum', kycDocumentId: 'mock_kyc_4', status: 'approved' }
    ]);

    // 4. CREATE LISTINGS
    // Real marketplace inventory — homestays, guides and crafts that an operator
    // genuinely sells. Tourist places (waterfalls, temples, dams) are NOT listings;
    // they live in the Destination collection and are loaded by seed:destinations.
    const operatorsByKey = {
      homestay: opHomestay._id,
      guide: opGuide._id,
      artisan1: opArtisan1._id,
      artisan2: opArtisan2._id,
    };

    // Borrow a photograph from the referenced destination, where one exists.
    const referenced = DEMO_LISTINGS.map(l => l.imageFrom).filter(Boolean);
    const destinations = await Destination.find({ slug: { $in: referenced } })
      .select('slug images')
      .lean();
    const imageBySlug = new Map(destinations.map(d => [d.slug, d.images?.[0]]));

    console.log(`Creating ${DEMO_LISTINGS.length} marketplace listings...`);
    const listingsToInsert = DEMO_LISTINGS.map(({ operatorKey, imageFrom, imageFile, ...listing }) => {
      // `imageFile` is an explicit craft photograph; `imageFrom` borrows one
      // from a destination.
      const image = imageFile || (imageFrom ? imageBySlug.get(imageFrom) : null);
      return {
        ...listing,
        operator: operatorsByKey[operatorKey],
        images: image ? [image] : [],
      };
    });

    const listings = await Listing.insertMany(listingsToInsert);

    // 5. CREATE BOOKINGS & REVIEWS
    console.log('Generating sample bookings and reviews...');
    
    // Some dates for historical/future bookings
    const now = new Date();
    const lastMonth1 = new Date(now.getFullYear(), now.getMonth() - 1, 10);
    const lastMonth2 = new Date(now.getFullYear(), now.getMonth() - 1, 12);
    
    const lastWeek1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const lastWeek2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5);

    const future1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
    const future2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 12);

    const futurePending = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20);

    // Find specific categories to ensure valid bookings
    const homestays = listings.filter(l => l.category === 'homestay');
    const guides = listings.filter(l => l.category === 'guide');
    const artisans = listings.filter(l => l.category === 'artisan');
    
    // Bookings Array
    const bookingsData = [
      // 1. Completed Homestay Booking with Review
      {
        tourist: tourist1._id, listing: homestays[0]._id, operator: opHomestay._id,
        category: 'homestay', units: 1, pricePerUnitPaise: 250000,
        checkIn: lastMonth1, checkOut: lastMonth2, guestName: 'Ananya Sharma', guestPhone: '9999999991',
        status: 'completed',
        amountPaise: 500000, commissionPercent: 10, commissionPaise: 50000, operatorPayoutPaise: 450000,
        razorpayPaymentId: 'pay_demo_1', bookingRef: 'JHK-DEMO-001'
      },
      // 2. Completed Guide Booking with Review
      {
        tourist: tourist2._id, listing: guides[0]._id, operator: opGuide._id,
        category: 'guide', units: 1, pricePerUnitPaise: 150000,
        checkIn: lastWeek1, checkOut: lastWeek1, guestName: 'Vikram Singh', guestPhone: '9999999992',
        status: 'completed',
        amountPaise: 150000, commissionPercent: 10, commissionPaise: 15000, operatorPayoutPaise: 135000,
        razorpayPaymentId: 'pay_demo_2', bookingRef: 'JHK-DEMO-002'
      },
      // 3. Completed Artisan Order with Review
      {
        // The operator must be the one who actually owns artisans[0], or the
        // operator portal shows an order against a listing it cannot see.
        tourist: tourist1._id, listing: artisans[0]._id, operator: artisans[0].operator,
        category: 'artisan', units: 1, pricePerUnitPaise: 250000,
        guestName: 'Ananya Sharma', guestPhone: '9999999991',
        status: 'completed',
        amountPaise: 250000, commissionPercent: 10, commissionPaise: 25000, operatorPayoutPaise: 225000,
        razorpayPaymentId: 'pay_demo_3', bookingRef: 'JHK-DEMO-003'
      },
      // 4. Future Confirmed Booking
      {
        tourist: tourist2._id, listing: (homestays[1] || homestays[0])._id, operator: opHomestay._id,
        category: 'homestay', units: 2, pricePerUnitPaise: 180000,
        checkIn: future1, checkOut: future2, guestName: 'Vikram Singh', guestPhone: '9999999992',
        status: 'confirmed',
        amountPaise: 360000, commissionPercent: 10, commissionPaise: 36000, operatorPayoutPaise: 324000,
        razorpayPaymentId: 'pay_demo_4', bookingRef: 'JHK-DEMO-004'
      },
      // 5. Future Pending Payment Booking
      {
        tourist: tourist1._id, listing: (guides[1] || guides[0])._id, operator: opGuide._id,
        category: 'guide', units: 1, pricePerUnitPaise: 80000,
        checkIn: futurePending, checkOut: futurePending, guestName: 'Ananya Sharma', guestPhone: '9999999991',
        status: 'pending_payment', holdExpiresAt: new Date(Date.now() + 600000), // 10 minutes from now
        amountPaise: 80000, commissionPercent: 10, commissionPaise: 8000, operatorPayoutPaise: 72000,
        bookingRef: 'JHK-DEMO-005'
      }
    ];

    const savedBookings = await Booking.insertMany(bookingsData);

    // Reviews for the completed bookings
    await Review.insertMany([
      {
        listing: homestays[0]._id, tourist: tourist1._id, booking: savedBookings[0]._id, operator: opHomestay._id,
        rating: 5, comment: 'Absolutely breathtaking views down the valley. The host was wonderful and the food was exactly what we needed. Do get up early for the sunrise point — it is a five minute walk.'
      },
      {
        listing: guides[0]._id, tourist: tourist2._id, booking: savedBookings[1]._id, operator: opGuide._id,
        rating: 4, comment: 'Sanjay knows Betla like the back of his hand. We didn\'t see a tiger, but we saw plenty of elephants and bison. Great experience.'
      },
      {
        listing: artisans[0]._id, tourist: tourist1._id, booking: savedBookings[2]._id, operator: artisans[0].operator,
        rating: 5, comment: 'The colours are far richer in person than in the photographs — you can see the grain of the earth pigment. It is hanging in our living room now.'
      }
    ]);

    console.log('\n✅ Phase 11 Demo Data successfully seeded!');
    console.log('\n--- Test Accounts ---');
    console.log(`Homestay Operator: homestay@demo.test / ${PASSWORD}`);
    console.log(`Guide Operator:    guide@demo.test / ${PASSWORD}`);
    console.log(`Artisan Operator:  artisan1@demo.test / ${PASSWORD}`);
    console.log(`Tourist 1:         tourist1@demo.test / ${PASSWORD}`);
    console.log(`Tourist 2:         tourist2@demo.test / ${PASSWORD}`);
    console.log('---------------------\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Seed failed: ${error.message}`);
    process.exit(1);
  }
};

seed();

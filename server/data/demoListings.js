/**
 * Demo marketplace inventory.
 *
 * These are the things an operator actually sells. They are deliberately NOT
 * tourist places — the previous seed pushed Wikipedia articles about waterfalls
 * and temples into the Listing collection with a random price and a random
 * homestay/guide label, which is why Hundru Falls appeared as a homestay at
 * ₹1,819 per night. Places now live in the Destination collection.
 *
 * `operatorKey` maps to an operator created by scripts/seedDemo.js.
 *
 * `imageFrom` borrows a photograph from the named destination so the demo
 * marketplace is not a wall of grey placeholders. It is a seeding convenience
 * only — a real operator uploads their own photographs through the portal, and
 * a listing with no matching destination photo simply has none.
 */
export const DEMO_LISTINGS = [
  // ---- Homestays ----
  {
    operatorKey: 'homestay', category: 'homestay', district: 'Latehar',
    title: 'Netarhat Ridge Homestay',
    imageFrom: 'netarhat',
    description: 'A four-room family home on the Netarhat plateau, a ten-minute walk from the sunrise point. Home-cooked Jharkhandi meals, wood-fired water heating and a veranda that looks straight down the valley.',
    price: 2200, rooms: 4,
    amenities: ['Home-cooked meals', 'Hot water', 'Bonfire', 'Parking', 'Sunrise point walk'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'Latehar',
    title: 'Betla Forest Edge Cottage',
    imageFrom: 'betla-national-park',
    description: 'Two cottages on the buffer edge of Betla National Park, five minutes from the entry gate. Early breakfast is served before the morning safari and the owner arranges the forest department permits.',
    price: 2800, rooms: 2,
    amenities: ['Safari booking help', 'Early breakfast', 'Guided nature walk', 'Parking'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'Ranchi',
    title: 'Patratu Valley View Homestay',
    imageFrom: 'patratu-valley',
    description: 'Three rooms on the ghat road above Patratu lake, with a terrace built for the evening light over the water. A good base for Hundru and Jonha falls, both under two hours away.',
    price: 1900, rooms: 3,
    amenities: ['Lake view terrace', 'Home-cooked meals', 'Wi-Fi', 'Parking'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'Ranchi',
    title: 'Ranchi Old Town Heritage Rooms',
    imageFrom: 'jagannath-temple-ranchi',
    description: 'A restored 1940s bungalow near Pahari Mandir with high ceilings and a courtyard garden. Walking distance to the Sunday tribal craft market and a short drive to the state museum.',
    price: 1600, rooms: 5,
    amenities: ['Air conditioning', 'Wi-Fi', 'Breakfast', 'Airport pickup'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'Deoghar',
    title: 'Baidyanath Pilgrim Homestay',
    imageFrom: 'baidyanath-temple',
    description: 'Simple, spotless rooms a ten-minute walk from the Baidyanath Jyotirlinga temple. The family has hosted Shravani Mela pilgrims for three generations and can arrange early darshan queues.',
    price: 1100, rooms: 6,
    amenities: ['Vegetarian meals', 'Temple guidance', 'Luggage storage', 'Hot water'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'Hazaribagh',
    title: 'Canary Hill Homestay',
    imageFrom: 'hazaribagh-jheel',
    description: 'A quiet stone house below Canary Hill with a mahua tree in the yard. Hazaribagh Wildlife Sanctuary is a half-hour drive and the Sohrai painted villages of Bhelwara are close by.',
    price: 1750, rooms: 3,
    amenities: ['Sohrai village visit', 'Home-cooked meals', 'Bicycle hire', 'Parking'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'East Singhbhum',
    title: 'Dalma Hills Guesthouse',
    imageFrom: 'dalma-hills',
    description: 'Four rooms at the foot of the Dalma range outside Jamshedpur, popular with birders and with families walking the elephant sanctuary trail in winter.',
    price: 1450, rooms: 4,
    amenities: ['Trekking guide', 'Breakfast', 'Wi-Fi', 'Parking'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'West Singhbhum',
    title: 'Saranda Sal Forest Lodge',
    description: 'A basic forest lodge inside the sal belt of Saranda, run with the local village committee. No mobile signal for most of the drive in, which is rather the point.',
    price: 2400, rooms: 3,
    amenities: ['Full board', 'Solar power', 'Forest guide', 'Jeep transfer'],
  },
  {
    operatorKey: 'homestay', category: 'homestay', district: 'Dumka',
    title: 'Massanjore Lakeside Rooms',
    imageFrom: 'massanjore-dam',
    description: 'Rooms overlooking the Massanjore dam backwater in the Santhal Parganas, with a boat the owner takes guests out in at first light.',
    price: 1350, rooms: 4,
    amenities: ['Lake view', 'Boating', 'Meals on request', 'Parking'],
  },

  // ---- Guides ----
  {
    operatorKey: 'guide', category: 'guide', district: 'Latehar',
    title: 'Betla Wildlife Safari Guide',
    imageFrom: 'palamau-tiger-reserve',
    description: 'Fifteen years guiding inside Betla and the Palamau Tiger Reserve. Knows the waterhole rotations, the elephant herd movements and every fire line road in the core.',
    price: 1800, languages: ['Hindi', 'English', 'Nagpuri'],
    specialities: ['Wildlife safari', 'Bird watching', 'Photography support'],
    serviceArea: 'Betla National Park, Palamau Tiger Reserve, Netarhat',
  },
  {
    operatorKey: 'guide', category: 'guide', district: 'Ranchi',
    title: 'Ranchi Waterfall Circuit Guide',
    imageFrom: 'hundru-falls',
    description: 'A one-day loop covering Hundru, Jonha and Dassam falls with a vehicle, timed so you reach each one before the crowds. Includes the safe viewing points, which matter in monsoon.',
    price: 1500, languages: ['Hindi', 'English', 'Bengali'],
    specialities: ['Waterfall circuit', 'Day trips', 'Monsoon safety'],
    serviceArea: 'Ranchi, Khunti, Ramgarh',
  },
  {
    operatorKey: 'guide', category: 'guide', district: 'Ranchi',
    title: 'Tribal Village Walk — Munda Heartland',
    imageFrom: 'dassam-falls',
    description: 'A half-day walk through Munda villages near Khunti, visiting a sarna grove, a working blacksmith and a household that still paints Sohrai each harvest. Arranged with the village headman.',
    price: 1200, languages: ['Hindi', 'Mundari', 'English'],
    specialities: ['Tribal culture', 'Village walks', 'Craft demonstrations'],
    serviceArea: 'Khunti, Tamar, Ranchi rural',
  },
  {
    operatorKey: 'guide', category: 'guide', district: 'Hazaribagh',
    title: 'Sohrai & Khovar Art Trail Guide',
    imageFrom: 'hazaribagh-jheel',
    description: 'Takes visitors through the painted villages of the Hazaribagh valley and the rock art sites at Isco, explaining the harvest and marriage painting traditions from the women who paint them.',
    price: 1400, languages: ['Hindi', 'English'],
    specialities: ['Tribal art', 'Rock art', 'Heritage walks'],
    serviceArea: 'Hazaribagh, Barkagaon, Isco',
  },
  {
    operatorKey: 'guide', category: 'guide', district: 'Deoghar',
    title: 'Deoghar Temple Circuit Guide',
    imageFrom: 'baidyanath-temple',
    description: 'Covers Baidyanath Dham, Naulakha Mandir, Tapovan and Trikut ropeway in a day, with the ritual sequence explained and the queue timings that actually work during Shravan.',
    price: 900, languages: ['Hindi', 'English', 'Bengali'],
    specialities: ['Pilgrimage', 'Temple history', 'Festival navigation'],
    serviceArea: 'Deoghar, Basukinath, Trikut',
  },
  {
    operatorKey: 'guide', category: 'guide', district: 'East Singhbhum',
    title: 'Dalma Trek Leader',
    imageFrom: 'dalma-hills',
    description: 'Leads the Dalma ridge trek from the Makulakocha gate up to the Shiva temple, with an option to camp. Certified in wilderness first aid.',
    price: 1300, languages: ['Hindi', 'English', 'Santali'],
    specialities: ['Trekking', 'Camping', 'Elephant corridor safety'],
    serviceArea: 'Dalma Wildlife Sanctuary, Jamshedpur',
  },
  {
    operatorKey: 'guide', category: 'guide', district: 'Gumla',
    title: 'Netarhat & Lodh Falls Guide',
    imageFrom: 'lodh-falls',
    description: 'Runs the Netarhat–Lodh Falls stretch, including the descent to the base of Lodh, the highest waterfall in the state. Vehicle and permits included.',
    price: 1600, languages: ['Hindi', 'Kurukh', 'English'],
    specialities: ['Waterfalls', 'Plateau drives', 'Sunrise and sunset points'],
    serviceArea: 'Netarhat, Lodh Falls, Gumla, Latehar',
  },

  // ---- Artisans ----
  {
    operatorKey: 'artisan1', category: 'artisan', district: 'Hazaribagh',
    title: 'Sohrai Harvest Painting on Canvas',
    imageFile: '/images/listings/sohrai-painting.jpg',
    description: 'Hand-painted Sohrai work in natural earth pigments — ochre, kaolin and manganese black — on stretched canvas, in the cattle-and-harvest motif painted on village walls each Sohrai festival.',
    price: 1500, craftType: 'Sohrai Painting', stockQuantity: 12,
  },
  {
    operatorKey: 'artisan1', category: 'artisan', district: 'Hazaribagh',
    title: 'Khovar Marriage Art Panel',
    imageFile: '/images/listings/khovar-painting.jpg',
    description: 'A comb-cut Khovar panel in the black-and-white style used to decorate the bridal chamber, scratched through a lime overlay to the dark clay beneath.',
    price: 2200, craftType: 'Khovar Painting', stockQuantity: 6,
  },
  {
    operatorKey: 'artisan2', category: 'artisan', district: 'East Singhbhum',
    title: 'Dokra Brass Elephant',
    imageFile: '/images/listings/dokra-elephant.png',
    description: 'Cast by the lost-wax method the Malhar metalsmiths have used for generations. Each piece breaks its mould, so no two are identical.',
    price: 2500, craftType: 'Dokra Metalcraft', stockQuantity: 9,
  },
  {
    operatorKey: 'artisan2', category: 'artisan', district: 'East Singhbhum',
    title: 'Dokra Tribal Musician Set',
    imageFile: '/images/listings/dokra-musicians.jpg',
    description: 'A set of three brass figures playing the mandar, nagara and flute, in the elongated Dokra style. Roughly seven inches tall.',
    price: 4200, craftType: 'Dokra Metalcraft', stockQuantity: 4,
  },
  {
    operatorKey: 'artisan2', category: 'artisan', district: 'Seraikela-Kharsawan',
    title: 'Chhau Dance Mask — Ardhanarishvara',
    imageFile: '/images/listings/chhau-mask.jpg',
    description: 'A papier-mâché and clay Chhau mask from Saraikela, built up over a clay mould and painted in the traditional palette used for the spring Chaitra Parva performances.',
    price: 3200, craftType: 'Chhau Mask', stockQuantity: 5,
  },
  {
    operatorKey: 'artisan1', category: 'artisan', district: 'Khunti',
    title: 'Bamboo Craft Storage Basket Set',
    imageFile: '/images/listings/bamboo-basket.jpg',
    description: 'A nested set of three bamboo baskets woven by Munda artisans near Khunti, using split bamboo cured over a slow fire so it stays flexible for years.',
    price: 900, craftType: 'Bamboo Craft', stockQuantity: 20,
  },
  {
    operatorKey: 'artisan1', category: 'artisan', district: 'Dumka',
    title: 'Santhali Handloom Cotton Stole',
    imageFile: '/images/listings/handloom-stole.jpg',
    description: 'Handwoven cotton in the red-and-white Santhali border pattern, from a weaver cooperative in the Santhal Parganas. Natural dyes throughout.',
    price: 1200, craftType: 'Handloom', stockQuantity: 15,
  },
];

import express from 'express';
import { getPublicListings, getListingById } from '../controllers/publicController.js';
import {
  getDestinations,
  getDestinationFacets,
  getDestinationById,
} from '../controllers/destinationController.js';

const router = express.Router();

router.get('/listings', getPublicListings);
router.get('/listings/:id', getListingById);

// `/facets` is declared before `/:idOrSlug` so it isn't swallowed by the wildcard.
router.get('/destinations', getDestinations);
router.get('/destinations/facets', getDestinationFacets);
router.get('/destinations/:idOrSlug', getDestinationById);

export default router;

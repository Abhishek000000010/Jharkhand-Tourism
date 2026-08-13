import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, MapPin, Map as MapIcon, List as ListIcon, Compass, Store, X } from 'lucide-react';
import DestinationMap from '../../components/DestinationMap';
import SafeImage from '../../components/SafeImage';
import { useAuth } from '../../context/AuthContext';
import TouristLayout from '../../components/TouristLayout';

const UNIT = { homestay: '/ night', guide: '/ day', artisan: '' };

const TYPE_LABELS = {
  waterfall: 'Waterfall',
  temple: 'Temple & shrine',
  dam: 'Dam & reservoir',
  park: 'Park & garden',
  wildlife: 'Wildlife & nature',
  hill: 'Hill & valley',
  lake: 'Lake',
  fort: 'Fort & palace',
  museum: 'Museum & memorial',
  heritage: 'Heritage site',
  city: 'Town & city',
  other: 'Other',
};

const PAGE_SIZE = 60;

const Explore = () => {
  const { user } = useAuth();

  const [tab, setTab] = useState('destinations');
  const [viewMode, setViewMode] = useState('list');

  // Filter options come from the data, not a hardcoded array, so a district can
  // never appear in the dropdown with nothing behind it.
  const [facets, setFacets] = useState({ allDistricts: [], types: [], total: 0 });

  const [district, setDistrict] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [destinations, setDestinations] = useState([]);
  const [destTotal, setDestTotal] = useState(0);
  const [destPage, setDestPage] = useState(1);

  const [listings, setListings] = useState([]);
  const [listingTotal, setListingTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/public/destinations/facets')
      .then(res => setFacets(res.data))
      .catch(() => setFacets({ allDistricts: [], types: [], total: 0 }));
  }, []);

  const fetchDestinations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/public/destinations', {
        params: {
          district: district || undefined,
          type: type || undefined,
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        },
      });
      // Page 1 replaces; later pages append, so "Load more" accumulates.
      setDestinations(prev => (page === 1 ? res.data.destinations : [...prev, ...res.data.destinations]));
      setDestTotal(res.data.total);
      setDestPage(page);
    } catch {
      if (page === 1) { setDestinations([]); setDestTotal(0); }
    } finally {
      setLoading(false);
    }
  }, [district, type, search]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/public/listings', {
        params: {
          category: category || undefined,
          district: district || undefined,
          maxPrice: maxPrice || undefined,
          search: search || undefined,
          limit: 50,
        },
      });
      setListings(res.data.listings);
      setListingTotal(res.data.total);
    } catch {
      setListings([]);
      setListingTotal(0);
    } finally {
      setLoading(false);
    }
  }, [category, district, maxPrice, search]);

  useEffect(() => {
    if (tab === 'destinations') fetchDestinations(1);
    else fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, district, type, category, search]);

  const applySearch = () => {
    setSearch(searchInput.trim());
    if (tab === 'listings') fetchListings();
  };

  const clear = () => {
    setCategory(''); setDistrict(''); setType('');
    setMaxPrice(''); setSearchInput(''); setSearch('');
  };

  const showingDestinations = tab === 'destinations';
  const mapItems = showingDestinations ? destinations : listings;

  // The empty panel is always in the DOM so the browser has a painted start
  // state to animate from — toggling a class on an element inserted in the same
  // commit skips the transition entirely. Leaflet is the expensive part, so it
  // is mounted on first open and then kept, which also lets the map slide out
  // instead of vanishing when the panel closes.
  const mapOpen = viewMode === 'map';
  const [mapMounted, setMapMounted] = useState(false);

  useEffect(() => { if (mapOpen) setMapMounted(true); }, [mapOpen]);

  const content = (
    <div className={`page-fluid explore-page ${mapOpen ? 'map-open' : ''}`}>
      <h1 className="page-title">Explore Jharkhand</h1>
      <p className="page-sub" style={{ marginBottom: '1.75rem' }}>
        Every documented place to visit across all {facets.allDistricts.length || 24} districts —
        plus verified homestays, local guides and authentic tribal crafts.
      </p>

      <div className="tabs">
        <button
          className={`tab ${showingDestinations ? 'is-active' : ''}`}
          onClick={() => setTab('destinations')}
        >
          <Compass size={16} /> Places to visit
          {facets.total > 0 && <span className="tab-count">{facets.total}</span>}
        </button>
        <button
          className={`tab ${!showingDestinations ? 'is-active' : ''}`}
          onClick={() => setTab('listings')}
        >
          <Store size={16} /> Stays, guides &amp; crafts
          {listingTotal > 0 && <span className="tab-count">{listingTotal}</span>}
        </button>
      </div>

      <div className="filter-bar">
        <input
          className="input"
          placeholder={showingDestinations ? 'Search places…' : 'Search listings…'}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applySearch()}
        />

        <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">All districts</option>
          {facets.allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {showingDestinations ? (
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All kinds of place</option>
            {facets.types.map(t => (
              <option key={t.name} value={t.name}>
                {TYPE_LABELS[t.name] || t.name} ({t.count})
              </option>
            ))}
          </select>
        ) : (
          <>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All experiences</option>
              <option value="homestay">Homestays</option>
              <option value="guide">Local guides</option>
              <option value="artisan">Tribal crafts</option>
            </select>
            <input
              className="input" type="number" min="0" placeholder="Max price"
              value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchListings()}
            />
          </>
        )}

        <button className="btn btn-primary" onClick={applySearch}>
          <Search size={16} /> Search
        </button>
      </div>

      <div className="row-wrap" style={{ justifyContent: 'flex-end', marginBottom: '1.5rem', gap: '0.5rem' }}>
        <button
          className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setViewMode('list')}
        >
          <ListIcon size={14} /> List View
        </button>
        <button
          className={`btn btn-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setViewMode('map')}
        >
          <MapIcon size={14} /> Map View
        </button>
      </div>

      {loading && mapItems.length === 0 ? (
        <div className="loading">Loading{showingDestinations ? ' destinations' : ' experiences'}…</div>
      ) : mapItems.length === 0 ? (
        <div className="empty">
          <h3>Nothing found</h3>
          <p className="muted" style={{ marginBottom: '1.25rem' }}>Try widening your filters.</p>
          <button className="btn btn-secondary" onClick={clear}>Clear filters</button>
        </div>
      ) : viewMode === 'map' ? (
        // The map itself is no longer a column in this grid — it is a fixed
        // partition rendered at the end of the page, so the list simply owns
        // whatever width is left.
        <div className="explore-list-col">
          <p className="small muted">
            {showingDestinations ? destTotal : listingTotal} results
          </p>
          {showingDestinations
            ? destinations.map(d => <DestinationRow key={d._id} dest={d} />)
            : listings.map(l => <ListingRow key={l._id} listing={l} />)}
        </div>
      ) : showingDestinations ? (
        <>
          <p className="small muted" style={{ marginBottom: '1rem' }}>
            Showing {destinations.length} of {destTotal} places
            {district ? ` in ${district}` : ' across Jharkhand'}
          </p>
          <div className="dest-grid">
            {destinations.map(d => <DestinationCard key={d._id} dest={d} />)}
          </div>
          {destinations.length < destTotal && (
            <div className="load-more">
              <button
                className="btn btn-secondary"
                disabled={loading}
                onClick={() => fetchDestinations(destPage + 1)}
              >
                {loading ? 'Loading…' : `Load ${Math.min(PAGE_SIZE, destTotal - destinations.length)} more`}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="small muted" style={{ marginBottom: '1rem' }}>
            {listingTotal} {listingTotal === 1 ? 'result' : 'results'}
          </p>
          <div className="explore-list-layout">
            {listings.map(l => <ListingRow key={l._id} listing={l} />)}
          </div>
        </>
      )}

      <aside className={`explore-map-panel ${mapOpen ? 'is-open' : ''}`} aria-hidden={!mapOpen}>
        {mapMounted && (
          <>
            <button
              className="btn btn-secondary btn-sm map-panel-close"
              onClick={() => setViewMode('list')}
            >
              <X size={14} /> Close map
            </button>
            <DestinationMap
              items={mapItems}
              kind={showingDestinations ? 'destination' : 'listing'}
            />
          </>
        )}
      </aside>
    </div>
  );

  return user?.role === 'tourist' ? <TouristLayout fluid>{content}</TouristLayout> : content;
};

const DestinationCard = ({ dest }) => (
  <Link to={`/destinations/${dest.slug}`} className="dest-card">
    <div className="thumb">
      <SafeImage src={dest.images?.[0]} alt={dest.name} label={dest.name} />
    </div>
    <div className="card-body">
      <span className="chip" style={{ alignSelf: 'flex-start', marginBottom: '0.6rem' }}>
        {TYPE_LABELS[dest.type] || dest.type}
      </span>
      <h3>{dest.name}</h3>
      <div className="row small muted" style={{ gap: '0.3rem' }}>
        <MapPin size={13} /> {dest.district}
      </div>
      <p className="dest-desc">{dest.description}</p>
    </div>
  </Link>
);

const DestinationRow = ({ dest }) => (
  <Link to={`/destinations/${dest.slug}`} className="card-horizontal">
    <div className="thumb">
      <SafeImage src={dest.images?.[0]} alt={dest.name} label={dest.name} />
    </div>
    <div className="card-body">
      <span className="chip" style={{ alignSelf: 'flex-start', marginBottom: '0.6rem' }}>
        {TYPE_LABELS[dest.type] || dest.type}
      </span>
      <h3 style={{ marginBottom: '0.3rem' }}>{dest.name}</h3>
      <div className="row small muted" style={{ gap: '0.3rem' }}>
        <MapPin size={14} /> {dest.district}
      </div>
      <p className="dest-desc">{dest.description}</p>
    </div>
  </Link>
);

const ListingRow = ({ listing }) => (
  <Link to={`/explore/${listing._id}`} className="card-horizontal">
    <div className="thumb">
      <SafeImage src={listing.images?.[0]} alt={listing.title} label={listing.title} />
    </div>
    <div className="card-body">
      <span className="chip" style={{ alignSelf: 'flex-start', marginBottom: '0.6rem' }}>{listing.category}</span>
      <h3 style={{ marginBottom: '0.3rem' }}>{listing.title}</h3>
      <div className="row small muted" style={{ gap: '0.3rem', marginBottom: '1rem' }}>
        <MapPin size={14} /> {listing.district}
      </div>
      <div className="row-between" style={{ marginTop: 'auto' }}>
        <span className="price" style={{ fontSize: '1.25rem' }}>
          ₹{listing.price.toLocaleString('en-IN')}
          <span className="price-unit"> {UNIT[listing.category]}</span>
        </span>
        <span className="tiny faint">{listing.operator?.name}</span>
      </div>
    </div>
  </Link>
);

export default Explore;

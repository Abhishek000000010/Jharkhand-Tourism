import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { DISTRICT_COORDINATES } from '../utils/coordinates';

// Fix for default Leaflet marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Fit the viewport to whatever is currently on the map. */
const FitBounds = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 12 });
  }, [points, map]);
  return null;
};

/**
 * Plots destinations or listings.
 *
 * Destinations carry their own coordinates from Wikipedia, so they land on the
 * actual waterfall rather than on the district headquarters. Listings still only
 * know their district, so they fall back to the district centroid with a small
 * deterministic offset — random jitter used to make markers hop on every render.
 */
const DestinationMap = ({ items = [], kind = 'destination' }) => {
  const markers = useMemo(() => {
    return items.map((item, index) => {
      const own = item.coordinates;
      if (own && Number.isFinite(own.lat) && Number.isFinite(own.lng)) {
        return { item, lat: own.lat, lng: own.lng };
      }
      const centre = DISTRICT_COORDINATES[item.district];
      if (!centre) return null;
      // Spread same-district pins around a small circle, stable across renders.
      const angle = (index * 2.399963) % (Math.PI * 2);
      return {
        item,
        lat: centre.lat + Math.cos(angle) * 0.035,
        lng: centre.lng + Math.sin(angle) * 0.035,
      };
    }).filter(Boolean);
  }, [items]);

  const points = useMemo(() => markers.map(m => [m.lat, m.lng]), [markers]);
  const fallbackCentre = DISTRICT_COORDINATES['Ranchi'];

  return (
    // No radius of its own — the container decides whether it is a rounded card
    // or, in the Explore partition, a full-bleed panel with square edges.
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <MapContainer
        center={[fallbackCentre.lat, fallbackCentre.lng]}
        zoom={7}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />

        {markers.map(({ item, lat, lng }) => {
          const isDestination = kind === 'destination';
          const to = isDestination ? `/destinations/${item.slug}` : `/explore/${item._id}`;
          return (
            <Marker key={item._id || item.slug} position={[lat, lng]}>
              <Popup>
                <div style={{ minWidth: '160px' }}>
                  <h4 style={{ margin: '0 0 5px 0' }}>{isDestination ? item.name : item.title}</h4>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
                    {isDestination ? `${item.type} · ${item.district}` : item.category}
                  </p>
                  {!isDestination && (
                    <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                      ₹{item.price?.toLocaleString('en-IN')}
                    </p>
                  )}
                  <Link
                    to={to}
                    style={{
                      display: 'block', textAlign: 'center', backgroundColor: 'var(--primary)',
                      color: 'white', padding: '5px', borderRadius: '4px', textDecoration: 'none',
                    }}
                  >
                    View details
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default DestinationMap;

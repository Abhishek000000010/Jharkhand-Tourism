import { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * An <img> that degrades to a labelled placeholder instead of a broken icon.
 *
 * Every listing card used to render `<img src={listing.images[0]}>` directly, so
 * any record pointing at a file that was never downloaded (the two seeded
 * artisan crafts both referenced a non-existent default_artisan.jpg) showed the
 * browser's broken-image glyph with the raw alt text next to it.
 */
const SafeImage = ({ src, alt, className = '', label }) => {
  const [failed, setFailed] = useState(!src);

  // A card can be recycled onto a different record as filters change.
  useEffect(() => { setFailed(!src); }, [src]);

  if (failed) {
    return (
      <div className={`thumb-empty ${className}`.trim()}>
        <ImageOff size={18} />
        <span>{label || 'Photo coming soon'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

export default SafeImage;

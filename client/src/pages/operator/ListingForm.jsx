import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Sparkles } from 'lucide-react';
import OperatorLayout from '../../components/OperatorLayout';
import DistrictSelect from '../../components/DistrictSelect';

const ListingForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    category: 'homestay', title: '', description: '', district: 'Ranchi', price: '',
    rooms: '', amenities: '', languages: '', specialities: '', serviceArea: '',
    craftType: '', stockQuantity: '',
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEdit) return;

    axios.get('/api/operator/listings')
      .then(res => {
        const listing = res.data.listings.find(l => l._id === id);
        if (!listing) return;
        setFormData({
          category: listing.category,
          title: listing.title,
          description: listing.description,
          district: listing.district,
          price: listing.price ?? '',
          // `??` not `||` — a genuine 0 (sold out) must show as 0, not blank
          rooms: listing.rooms ?? '',
          amenities: listing.amenities?.join(', ') || '',
          languages: listing.languages?.join(', ') || '',
          specialities: listing.specialities?.join(', ') || '',
          serviceArea: listing.serviceArea || '',
          craftType: listing.craftType || '',
          stockQuantity: listing.stockQuantity ?? '',
        });
      })
      .catch(() => setError('Could not load this listing'));
  }, [id, isEdit]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEdit) {
        await axios.put(`/api/operator/listings/${id}`, formData);
      } else {
        const data = new FormData();
        Object.keys(formData).forEach(key => {
          // Send anything non-blank, so a stock quantity of 0 still gets through
          if (formData[key] !== '' && formData[key] != null) data.append(key, formData[key]);
        });
        for (let i = 0; i < files.length; i++) data.append('images', files[i]);

        await axios.post('/api/operator/listings', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      navigate('/operator/listings');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save listing');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoWrite = async () => {
    if (!formData.description.trim()) {
      setError('Please provide some bullet points in the description first!');
      return;
    }
    
    setAiLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/ai/description', {
        category: formData.category,
        bulletPoints: formData.description
      });
      setFormData(prev => ({ ...prev, description: res.data.description }));
    } catch (err) {
      setError('AI generation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <OperatorLayout>
      <div className="page page--mid">
        <Link to="/operator/listings" className="link-back"><ArrowLeft size={15} /> My listings</Link>

      <h1 className="page-title">{isEdit ? 'Edit listing' : 'New listing'}</h1>
      <p className="page-sub" style={{ marginBottom: '1.75rem' }}>
        {isEdit ? 'Update the details travellers see.' : 'Tell travellers what you offer.'}
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="stack">
        {!isEdit && (
          <div className="field">
            <label className="label" htmlFor="category">What are you listing?</label>
            <select id="category" className="select" name="category" value={formData.category} onChange={handleChange}>
              <option value="homestay">Homestay — rooms by the night</option>
              <option value="guide">Guiding — your time by the day</option>
              <option value="artisan">Craft — items from stock</option>
            </select>
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" name="title" value={formData.title}
            onChange={handleChange} required placeholder="Sunrise Cottage, Netarhat" />
        </div>

        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="label" htmlFor="description">Description (or bullet points)</label>
            <button type="button" className="btn btn-outline" onClick={handleAutoWrite} disabled={aiLoading} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
              <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }} />
              {aiLoading ? 'Writing...' : 'Auto-write with AI'}
            </button>
          </div>
          <textarea id="description" className="textarea" name="description" value={formData.description}
            onChange={handleChange} required rows={5}
            placeholder="What makes this special? What should a traveller expect?" />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="district">District</label>
            <DistrictSelect id="district" name="district" value={formData.district} onChange={handleChange} />
          </div>
          <div className="field">
            <label className="label" htmlFor="price">
              Price (₹) {formData.category === 'homestay' ? 'per night' : formData.category === 'guide' ? 'per day' : 'per item'}
            </label>
            <input id="price" className="input" type="number" name="price" min="0"
              value={formData.price} onChange={handleChange} required />
          </div>
        </div>

        {formData.category === 'homestay' && (
          <div className="card card--muted stack">
            <h4>Homestay details</h4>
            <div className="field">
              <label className="label" htmlFor="rooms">Number of rooms</label>
              <input id="rooms" className="input" type="number" name="rooms" min="1"
                value={formData.rooms} onChange={handleChange} required />
              <span className="hint">Rooms are interchangeable — this many guests can book the same nights.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="amenities">Amenities</label>
              <input id="amenities" className="input" name="amenities" value={formData.amenities}
                onChange={handleChange} placeholder="Home-cooked meals, Bonfire, Hot water" />
              <span className="hint">Separate with commas.</span>
            </div>
          </div>
        )}

        {formData.category === 'guide' && (
          <div className="card card--muted stack">
            <h4>Guiding details</h4>
            <div className="field">
              <label className="label" htmlFor="languages">Languages</label>
              <input id="languages" className="input" name="languages" value={formData.languages}
                onChange={handleChange} placeholder="Hindi, English, Santhali" required />
              <span className="hint">Separate with commas.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="specialities">Specialities</label>
              <input id="specialities" className="input" name="specialities" value={formData.specialities}
                onChange={handleChange} placeholder="Trekking, Birding, Tribal culture" />
            </div>
            <div className="field">
              <label className="label" htmlFor="serviceArea">Service area</label>
              <input id="serviceArea" className="input" name="serviceArea" value={formData.serviceArea}
                onChange={handleChange} placeholder="Netarhat, Betla and Lodh Falls" />
            </div>
          </div>
        )}

        {formData.category === 'artisan' && (
          <div className="card card--muted stack">
            <h4>Craft details</h4>
            <div className="field">
              <label className="label" htmlFor="craftType">Craft type</label>
              <input id="craftType" className="input" name="craftType" value={formData.craftType}
                onChange={handleChange} placeholder="Sohrai painting, Dokra metalwork, Bamboo" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="stockQuantity">Stock quantity</label>
              <input id="stockQuantity" className="input" type="number" name="stockQuantity" min="0"
                value={formData.stockQuantity} onChange={handleChange} required />
              <span className="hint">Set to 0 to pause sales without deleting the listing.</span>
            </div>
          </div>
        )}

        {!isEdit && (
          <div className="field">
            <label className="label">Photos</label>
            <div className="file-drop">
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} />
              <p className="hint" style={{ marginTop: '0.6rem' }}>
                {files.length > 0 ? `${files.length} file(s) selected` : 'Up to 5 images, 5MB each'}
              </p>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: '0.25rem' }}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create listing'}
        </button>
      </form>
      </div>
    </OperatorLayout>
  );
};

export default ListingForm;

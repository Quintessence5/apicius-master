import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';

const ManageSeasonality = () => {
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [regions, setRegions] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  // Fetch initial data
  useEffect(() => {
    console.log('ManageSeasonality mounted - starting data fetch');
    const fetchData = async () => {
      try {
        console.log('Fetching entries...');
        const entriesRes = await apiClient.get('/seasonality/manage');
        console.log('Entries response:', entriesRes.data);
  
        console.log('Fetching regions...');
        const regionsRes = await apiClient.get('/seasonality/regions');
        console.log('Regions response:', regionsRes.data);
  
        console.log('Fetching ingredients...');
        const ingredientsRes = await apiClient.get('/ingredients/all');
        console.log('Ingredients response:', ingredientsRes.data);
  
        setEntries(entriesRes.data);
        setRegions(regionsRes.data);
        setIngredients(ingredientsRes.data);
      } catch (err) {
        console.error('Fetch error details:', {
          message: err.message,
          response: err.response,
          config: err.config
        });
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setFormData({
      ingredient_id: entry.ingredient_id.toString(),
      region_id: entry.region_id.toString(),
      season_start: entry.season_start,
      season_end: entry.season_end,
      notes: entry.notes || '',
      produce_image_url: entry.produce_image_url || ''
    });
    setValidationErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.ingredient_id) errors.ingredient_id = 'Ingredient is required';
    if (!formData.region_id) errors.region_id = 'Region is required';
    if (!formData.season_start) errors.season_start = 'Start date is required';
    if (!formData.season_end) errors.season_end = 'End date is required';
    if (new Date(formData.season_end) < new Date(formData.season_start)) {
      errors.dates = 'End date must be after start date';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (id) => {
    if (!validateForm()) return;
    
    try {
      const response = await apiClient.put(`/seasonality/manage/${id}`, {
        ...formData,
        ingredient_id: parseInt(formData.ingredient_id),
        region_id: parseInt(formData.region_id)
      });
      setEntries(entries.map(entry => entry.id === id ? response.data : entry));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update entry');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this seasonality entry?')) return;
    
    try {
      await apiClient.delete(`/seasonality/manage/${id}`);
      setEntries(entries.filter(entry => entry.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleAdd = async () => {
    if (!validateForm()) return;

    try {
      const response = await apiClient.post('/seasonality/manage', {
        ...formData,
        ingredient_id: parseInt(formData.ingredient_id),
        region_id: parseInt(formData.region_id)
      });
      setEntries([...entries, response.data]);
      setShowAddForm(false);
      setFormData({});
      setValidationErrors({});
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create entry');
    }
  };

  const renderAddForm = () => (
    <div className="add-form">
      <h3>Add New Seasonality Entry</h3>
      <div className="form-grid">
        {/* Ingredient Select */}
        <div className="form-row">
          <label>Ingredient *</label>
          <select
            value={formData.ingredient_id || ''}
            onChange={(e) => setFormData({...formData, ingredient_id: e.target.value})}
            className={validationErrors.ingredient_id ? 'error' : ''}
          >
            <option value="">Select Ingredient</option>
            {ingredients.map(ing => (
              <option key={ing.id} value={ing.id}>{ing.name}</option>
            ))}
          </select>
          {validationErrors.ingredient_id && 
            <span className="error-message">{validationErrors.ingredient_id}</span>}
        </div>

        {/* Region Select */}
        <div className="form-row">
          <label>Region *</label>
          <select
            value={formData.region_id || ''}
            onChange={(e) => setFormData({...formData, region_id: e.target.value})}
            className={validationErrors.region_id ? 'error' : ''}
          >
            <option value="">Select Region</option>
            {regions.map(region => (
              <option key={region.region_id} value={region.region_id}>
                {region.region_name} ({region.country})
              </option>
            ))}
          </select>
          {validationErrors.region_id && 
            <span className="error-message">{validationErrors.region_id}</span>}
        </div>

        {/* Start Date */}
        <div className="form-row">
          <label>Season Start *</label>
          <input
            type="date"
            value={formData.season_start || ''}
            onChange={(e) => setFormData({...formData, season_start: e.target.value})}
            className={validationErrors.season_start ? 'error' : ''}
          />
          {validationErrors.season_start && 
            <span className="error-message">{validationErrors.season_start}</span>}
        </div>

        {/* End Date */}
        <div className="form-row">
          <label>Season End *</label>
          <input
            type="date"
            value={formData.season_end || ''}
            onChange={(e) => setFormData({...formData, season_end: e.target.value})}
            className={validationErrors.season_end ? 'error' : ''}
          />
          {validationErrors.season_end && 
            <span className="error-message">{validationErrors.season_end}</span>}
        </div>

        {/* Image URL */}
        <div className="form-row">
          <label>Image URL</label>
          <input
            type="url"
            value={formData.produce_image_url || ''}
            onChange={(e) => setFormData({...formData, produce_image_url: e.target.value})}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        {/* Notes */}
        <div className="form-row full-width">
          <label>Notes</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            rows="3"
          />
        </div>
      </div>

      {validationErrors.dates && 
        <div className="error-message">{validationErrors.dates}</div>}

      <div className="form-actions">
        <button className="save-btn" onClick={handleAdd}>Create Entry</button>
        <button className="cancel-btn" onClick={() => {
          setShowAddForm(false);
          setValidationErrors({});
        }}>Cancel</button>
      </div>
    </div>
  );


  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="manage-seasonality">
      <div className="table-header">
        <h2>Manage Seasonality</h2>
        <button onClick={() => setShowAddForm(true)} className="add-button">
          Add New Entry
        </button>
      </div>

      {showAddForm && (
        <div className="add-form">
          <h3>Add New Seasonality Entry</h3>
          <div className="form-row">
            <label>Ingredient:</label>
            <select
              value={formData.ingredient_id || ''}
              onChange={(e) => setFormData({...formData, ingredient_id: e.target.value})}
            >
              <option value="">Select Ingredient</option>
              {ingredients.map(ing => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
          </div>
          {/* Add other form fields similarly */}
          <div className="form-actions">
            <button onClick={handleAdd}>Save</button>
            <button onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="seasonality-table">
          <thead>
            <tr>
              <th>Actions</th>
              <th>Ingredient</th>
              <th>Region</th>
              <th>Season Start</th>
              <th>Season End</th>
              <th>Image URL</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td>
                  {editingId === entry.id ? (
                    <>
                      <button className="save-btn" onClick={() => handleSave(entry.id)}>Save</button>
                      <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="edit-btn" onClick={() => handleEdit(entry)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDelete(entry.id)}>Delete</button>
                    </>
                  )}
                </td>
                <td>
                  {editingId === entry.id ? (
                    <select
                      value={formData.ingredient_id}
                      onChange={(e) => setFormData({...formData, ingredient_id: e.target.value})}
                    >
                      {ingredients.map(ing => (
                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                      ))}
                    </select>
                  ) : (
                    entry.ingredient_name
                  )}
                </td>
                <td>
                  {editingId === entry.id ? (
                    <select
                      value={formData.region_id}
                      onChange={(e) => setFormData({...formData, region_id: e.target.value})}
                    >
                      {regions.map(region => (
                        <option key={region.region_id} value={region.region_id}>{region.region_name}</option>
                      ))}
                    </select>
                  ) : (
                    entry.region_name
                  )}
                </td>
                <td>
                  {editingId === entry.id ? (
                    <input
                      type="date"
                      value={formData.season_start || ''}
                      onChange={(e) => setFormData({...formData, season_start: e.target.value})}
                    />
                  ) : (
                    entry.season_start
                  )}
                </td>
                <td>
                  {editingId === entry.id ? (
                    <input
                      type="date"
                      value={formData.season_end || ''}
                      onChange={(e) => setFormData({...formData, season_end: e.target.value})}
                    />
                  ) : (
                    entry.season_end
                  )}
                </td>
                <td>
                  {editingId === entry.id ? (
                    <input
                      type="text"
                      value={formData.produce_image_url || ''}
                      onChange={(e) => setFormData({...formData, produce_image_url: e.target.value})}
                    />
                  ) : (
                    entry.produce_image_url
                  )}
                </td>
                <td>
                  {editingId === entry.id ? (
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                  ) : (
                    entry.notes
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageSeasonality;
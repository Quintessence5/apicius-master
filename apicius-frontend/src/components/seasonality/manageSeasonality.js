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
  const [sortConfig, setSortConfig] = useState({ key: 'ingredient_id', direction: 'asc' });
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadStatus({ message: 'Uploading...', success: null });
      const response = await apiClient.post('/seasonality/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadStatus({
        success: true,
        message: response.data.message,
        inserted: response.data.inserted
      });
      setValidationErrors(response.data.errors || []);
      
      // Refresh entries if any were added
      if (response.data.inserted > 0) {
        const entriesRes = await apiClient.get('/seasonality/manage');
        setEntries(entriesRes.data);
      }

    } catch (error) {
      setUploadStatus({
        success: false,
        message: error.response?.data?.message || 'Upload failed. Check console for details.'
      });
      setValidationErrors(error.response?.data?.errors || []);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await apiClient.get('/seasonality/template', {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'seasonality_template.xlsx';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

    } catch (error) {
      alert('Failed to download template. Please check your connection and try again.');
    }
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [entriesRes, regionsRes, ingredientsRes] = await Promise.all([
          apiClient.get('/seasonality/manage'),
          apiClient.get('/seasonality/regions'),
          apiClient.get('/ingredients/all')
        ]);

        setEntries(entriesRes.data);
        setRegions(regionsRes.data);
        setIngredients(ingredientsRes.data);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Sorting functionality
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedEntries = React.useMemo(() => {
    return [...entries].sort((a, b) => {
      // Handle numeric comparison for ID
      if (sortConfig.key === 'ingredient_id') {
        return sortConfig.direction === 'asc' 
          ? a.ingredient_id - b.ingredient_id 
          : b.ingredient_id - a.ingredient_id;
      }

      // Handle string comparisons
      const aValue = a[sortConfig.key]?.toLowerCase?.() || a[sortConfig.key];
      const bValue = b[sortConfig.key]?.toLowerCase?.() || b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [entries, sortConfig]);

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setFormData({
      ingredient_id: entry.ingredient_id.toString(),
      region_id: entry.region_id.toString(),
      season_start: entry.season_start.split('T')[0],
      season_end: entry.season_end.split('T')[0],
      notes: entry.notes || ''
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

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB'); // Formats to DD/MM/YYYY
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="manage-seasonality">
      <div className="header-section">
        <h2>Manage Seasonality</h2>
        <button onClick={() => setShowAddForm(true)} className="add-button">
          Add New Entry
        </button>
      </div>
  
      {/* Bulk Upload Section */}
      <div className="bulk-upload-section">
        <h3>Bulk Upload</h3>
        <div className="upload-controls">
          <form onSubmit={handleFileUpload}>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <button type="submit" className="upload-btn">
              Upload Excel
            </button>
          </form>
          <button onClick={downloadTemplate} className="download-btn">
            Download Template
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.success ? 'success' : 'error'}`}>
          <p>{uploadStatus.message}</p>
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <h4>Validation Issues:</h4>
              <ul>
                {validationErrors.map((error, index) => (
                  <li key={index}>
                    Row {error.row}: {error.errors.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>)}

      {showAddForm && (
        <div className="add-form">
          <h3>Add New Seasonality Entry</h3>
          <div className="form-grid">
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
      )}

      <div className="table-wrapper">
        <table className="seasonality-table">
          <thead>
            <tr>
              <th>Actions</th>
              <th onClick={() => handleSort('ingredient_id')} className={`sortable ${sortConfig.key === 'ingredient_id' ? sortConfig.direction : ''}`}>
                ID
              </th>
              <th onClick={() => handleSort('ingredient_name')} className={`sortable ${sortConfig.key === 'ingredient_name' ? sortConfig.direction : ''}`}>
                Ingredient
              </th>
              <th onClick={() => handleSort('country')} className={`sortable ${sortConfig.key === 'country' ? sortConfig.direction : ''}`}>
                Country
              </th>
              <th>Season Start</th>
              <th>Season End</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(entry => (
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
                <td>{entry.ingredient_id}</td>
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
                  {regions.find(r => r.region_id === entry.region_id)?.country || 'Unknown'}
                </td>
                <td>
                  {editingId === entry.id ? (
                    <input
                      type="date"
                      value={formData.season_start || ''}
                      onChange={(e) => setFormData({...formData, season_start: e.target.value})}
                    />
                  ) : (
                    formatDate(entry.season_start)
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
                    formatDate(entry.season_end)
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
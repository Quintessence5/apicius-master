import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';

const IngredientPrices = () => {
  const [prices, setPrices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [tempPrices, setTempPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const fetchPrices = async () => {
    try {
      const response = await apiClient.get('/ingredients/prices');
      if (response.status === 200) {
        setPrices(response.data);
      }
    } catch (err) {
      setError('Failed to load prices. Please check your connection and try again.');
      console.error('Fetch error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const handleEdit = (ingredient) => {
    setEditingId(ingredient.id);
    setTempPrices({
      price_fr: ingredient.price_fr || '',
      price_uk: ingredient.price_uk || '',
      price_us: ingredient.price_us || '',
    });
  };

  // Sorting handler
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPrices = React.useMemo(() => {
    return [...prices].sort((a, b) => {
      // Handle numeric comparison for ID
      if (sortConfig.key === 'id') {
        return sortConfig.direction === 'asc' 
          ? a.id - b.id 
          : b.id - a.id;
      }
  
      // Handle string comparisons
      const aValue = typeof a[sortConfig.key] === 'string' 
        ? a[sortConfig.key].toLowerCase() 
        : a[sortConfig.key];
      
      const bValue = typeof b[sortConfig.key] === 'string' 
        ? b[sortConfig.key].toLowerCase() 
        : b[sortConfig.key];
  
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [prices, sortConfig]);

  const handleSave = async (ingredientId) => {
    try {
      await apiClient.put(`/ingredients/prices/${ingredientId}`, tempPrices);
      setEditingId(null);
      fetchPrices(); // Refresh data after update
    } catch (err) {
      console.error('Save error:', err.response?.data || err.message);
      alert('Failed to save prices: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setTempPrices({});
  };

  const handlePriceChange = (field, value) => {
    setTempPrices(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Render loading/error states
  if (loading) return <div>Loading prices...</div>;
  if (error) return <div className="error-message">{error}</div>;

return (
    <div className="prices-container">
      <h2>Manage Ingredient Prices</h2>
      
      {/* Debugging output */}
      <div style={{ display: 'none' }}>
        API Data: {JSON.stringify(prices)}
      </div>

      <div className="table-wrapper">
        <table className="prices-table">
          <thead>
            <tr>
              <th>Actions</th>
              <th onClick={() => handleSort('name')} className={`sortable ${sortConfig.key === 'name' ? sortConfig.direction : ''}`}> Name </th>
              <th onClick={() => handleSort('id')} className={`sortable ${sortConfig.key === 'id' ? sortConfig.direction : ''}`}> ID </th>
              <th onClick={() => handleSort('category')} className={`sortable ${sortConfig.key === 'category' ? sortConfig.direction : ''}`}> Category </th>
              <th>Price FR €</th>
              <th>Price UK £</th>
              <th>Price US $</th>
            </tr>
          </thead>
          <tbody>
            {sortedPrices.map(ingredient => {
              console.log('Rendering ingredient:', ingredient); // Debugging
              return (
                <tr key={ingredient.id}>
                  <td>
                    {editingId === ingredient.id ? (
                      <>
                        <button className="save-btn" onClick={() => handleSave(ingredient.id)}>
                          Save
                        </button>
                        <button className="cancel-btn" onClick={handleCancel}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="edit-btn" onClick={() => handleEdit(ingredient)}>
                        Edit
                      </button>
                    )}
                  </td>
                  <td>{ingredient.name}</td>
                  <td>{ingredient.id}</td>
                  <td>{ingredient.category}</td>
                  <td>
                    {editingId === ingredient.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempPrices.price_fr || ''}
                        onChange={(e) => handlePriceChange('price_fr', e.target.value)}
                      />
                    ) : ingredient.price_fr ? `€${ingredient.price_fr}` : '-'}
                  </td>
                  <td>
                    {editingId === ingredient.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempPrices.price_uk || ''}
                        onChange={(e) => handlePriceChange('price_uk', e.target.value)}
                      />
                    ) : ingredient.price_uk ? `£${ingredient.price_uk}` : '-'}
                  </td>
                  <td>
                    {editingId === ingredient.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempPrices.price_us || ''}
                        onChange={(e) => handlePriceChange('price_us', e.target.value)}
                      />
                    ) : ingredient.price_us ? `$${ingredient.price_us}` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IngredientPrices;
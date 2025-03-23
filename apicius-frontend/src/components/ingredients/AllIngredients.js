import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';

const AllIngredients = () => {
  const [ingredients, setIngredients] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchIngredients = async () => {
    try {
      const response = await apiClient.get('/ingredients/all'); // Remove duplicate /api
      if (response.status === 200) {
        setIngredients(response.data);
      }
    } catch (err) {
      setError('Failed to load ingredients. Please check your connection and try again.');
      console.error('Fetch error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  const columns = [
    'name',
    'average_weight',
    'category',
    'calories_per_100g',
    'protein',
    'lipids',
    'carbohydrates',
    'allergies',
    'dietary_restrictions',
    'form',
    'saturated_fat',
    'trans_fat',
    'cholesterol',
    'sodium',
    'fibers',
    'sugars',
    'added_sugars',
    'intolerance'
  ];
  
  const handleEdit = (ingredient) => {
    setEditingId(ingredient.id);
    setFormData(ingredient);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdate = async () => {
    if (!window.confirm('Are you sure you want to update this ingredient?')) return;
    
    try {
      const response = await apiClient.put(`/ingredients/${editingId}`, formData);
      if (response.status === 200) {
        setIngredients(ingredients.map(ing => 
          ing.id === editingId ? response.data : ing
        ));
        setEditingId(null);
      }
    } catch (err) {
      console.error('Update error:', err.response?.data || err.message);
      alert('Failed to update ingredient: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this ingredient?')) return;
    
    try {
      await apiClient.delete(`/ingredients/${id}`);
      setIngredients(ingredients.filter(ing => ing.id !== id));
    } catch (err) {
      console.error('Delete error:', err.response?.data || err.message);
      alert('Failed to delete ingredient: ' + (err.response?.data?.message || err.message));
    }
  };

  // Render loading/error states
  if (loading) return <div>Loading ingredients...</div>;
  if (error) return <div className="error-message">{error}</div>;


  return (
    <div className="all-ingredients-container">
      <h2>Manage Ingredients</h2>
      
      <div className="table-wrapper">
        <table className="ingredients-table">
          <thead>
            <tr>
              <th>Actions</th>
              <th>Name</th>
              <th>Average Weight</th>
              <th>Category</th>
              <th>Calories/100g</th>
              <th>Protein</th>
              <th>Lipids</th>
              <th>Carbohydrates</th>
              <th>Allergies</th>
              <th>Dietary Restrictions</th>
              <th>Form</th>
              <th>Saturated Fat</th>
              <th>Trans Fat</th>
              <th>Cholesterol</th>
              <th>Sodium</th>
              <th>Fibers</th>
              <th>Sugars</th>
              <th>Added Sugars</th>
              <th>Intolerance</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map(ingredient => (
              <tr key={ingredient.id}>
                <td>
                  {editingId === ingredient.id ? (
                    <>
                      <button className="save-btn" onClick={handleUpdate}>
                        Save
                      </button>
                      <button className="cancel-btn" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="edit-btn" onClick={() => handleEdit(ingredient)}>
                        Edit
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(ingredient.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
                {columns.map(column => (
                  <td key={column}>
                    {editingId === ingredient.id ? (
                      <input
                        name={column}
                        value={formData[column] || ''}
                        onChange={handleChange}
                        type={typeof ingredient[column] === 'number' ? 'number' : 'text'}
                        step={column === 'average_weight' ? '1' : '0.01'}
                      />
                    ) : (
                      ingredient[column]?.toString() || '-'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllIngredients;
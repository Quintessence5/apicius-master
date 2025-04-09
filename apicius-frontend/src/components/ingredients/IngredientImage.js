import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import unavailableImage from '../../assets/produce-icons/unavailable-produce.png';

const IngredientImage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const path = { basename: (fullPath) => fullPath.split('/').pop()};

  const fetchIngredients = async () => {
    try {
      const response = await apiClient.get('/ingredients/all');
      setIngredients(response.data);
    } catch (err) {
      setError('Failed to load ingredients');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const sortedIngredients = [...ingredients].sort((a, b) => {
    const modifier = sortOrder === 'asc' ? 1 : -1;
    
    if (sortBy === 'id') {
      return (a.id - b.id) * modifier;
    }
    
    const aValue = a[sortBy]?.toString().toLowerCase() || '';
    const bValue = b[sortBy]?.toString().toLowerCase() || '';
    
    return aValue.localeCompare(bValue) * modifier;
  });

  const handleImageUpload = async (ingredientId, file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await apiClient.post(
        `/ingredients/${ingredientId}/image`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setIngredients(prev => prev.map(ing => 
        ing.id === ingredientId ? { ...ing, image_path: response.data.image_path } : ing
      ));
    } catch (error) {
      console.error('Upload error:', error);
      alert('Image upload failed');
    }
  };

  if (loading) return <div>Loading ingredients...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="ingredient-image-container">
      <h2>Ingredient Images</h2>
      
      <table className="ingredients-image-table">
      <thead>
          <tr>
          <th>Actions</th>
            <th 
              className={`sortable ${sortBy === 'id' ? sortOrder : ''}`}
              onClick={() => handleSort('id')}
            >
              ID
            </th>
            <th 
              className={`sortable ${sortBy === 'name' ? sortOrder : ''}`}
              onClick={() => handleSort('name')}
            >
              Name
            </th>
            <th 
              className={`sortable ${sortBy === 'category' ? sortOrder : ''}`}
              onClick={() => handleSort('category')}
            >
              Category
            </th>
            <th>Image</th>
          </tr>
        </thead>
        <tbody>
          {sortedIngredients.map(ingredient => (
            <tr key={ingredient.id}>
              <td>
                <input
                  type="file"
                  accept="image/*"
                  id={`file-upload-${ingredient.id}`}
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(ingredient.id, e.target.files[0])}
                />
                <label htmlFor={`file-upload-${ingredient.id}`} className="upload-image-button">
                  Upload Image
                </label>
              </td>
              <td>{ingredient.id}</td>
              <td>{ingredient.name}</td>
              <td>{ingredient.category}</td>
              <td>
  <img 
    src={
      ingredient.image_path 
        ? require(`../../assets/produce-icons/${path.basename(ingredient.image_path)}`)
        : unavailableImage
    }
    alt={ingredient.name}
    className="ingredient-thumbnail"
    onError={(e) => {
      if (e.target.src !== unavailableImage) {
        e.target.src = unavailableImage;
      }
    }}
  />
</td> 
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default IngredientImage;
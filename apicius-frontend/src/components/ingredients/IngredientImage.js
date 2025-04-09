import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import unavailableImage from '../../assets/produce-icons/unavailable-produce.png';

const IngredientImage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  // Handle image upload
  const handleImageUpload = async (ingredientId, file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await apiClient.post(
        `/ingredients/${ingredientId}/image`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Update local state with new image path
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
      
      <table className="ingredients-table">
        <thead>
          <tr>
            <th>Actions</th>
            <th>Name</th>
            <th>Category</th>
            <th>Image</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map(ingredient => (
            <tr key={ingredient.id}>
              <td>
                <input
                  type="file"
                  accept="image/*"
                  id={`file-upload-${ingredient.id}`}
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(ingredient.id, e.target.files[0])}
                />
                <label htmlFor={`file-upload-${ingredient.id}`} className="upload-button">
                  Upload Image
                </label>
              </td>
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
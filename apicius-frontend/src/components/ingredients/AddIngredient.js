import React, { useState } from 'react';
import apiClient from '../../services/apiClient';

const AddIngredient = () => {
  const [formData, setFormData] = useState({
    name: '',
    average_weight: '',
    category: '',
    calories_per_100g: '',
    protein: '',
    lipids: '',
    carbohydrates: '',
    allergies: '',
    dietary_restrictions: '',
    form: '',
    saturated_fat: '',
    trans_fat: '',
    cholesterol: '',
    sodium: '',
    fibers: '',
    sugars: '',
    added_sugars: '',
    intolerance: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Convert empty strings to null and parse numbers
    const processedData = {
      name: formData.name || null,
      average_weight: formData.average_weight ? parseInt(formData.average_weight) : null,
      category: formData.category || null,
      calories_per_100g: formData.calories_per_100g ? parseInt(formData.calories_per_100g) : null,
      protein: formData.protein ? parseFloat(formData.protein) : null,
      lipids: formData.lipids ? parseFloat(formData.lipids) : null,
      carbohydrates: formData.carbohydrates ? parseFloat(formData.carbohydrates) : null,
      allergies: formData.allergies || null,
      dietary_restrictions: formData.dietary_restrictions || null,
      form: formData.form || null,
      saturated_fat: formData.saturated_fat ? parseFloat(formData.saturated_fat) : null,
      trans_fat: formData.trans_fat ? parseFloat(formData.trans_fat) : null,
      cholesterol: formData.cholesterol ? parseFloat(formData.cholesterol) : null,
      sodium: formData.sodium ? parseFloat(formData.sodium) : null,
      fibers: formData.fibers ? parseFloat(formData.fibers) : null,
      sugars: formData.sugars ? parseFloat(formData.sugars) : null,
      added_sugars: formData.added_sugars ? parseFloat(formData.added_sugars) : null,
      intolerance: formData.intolerance || null
    };

    try {
      const response = await apiClient.post('/ingredients', processedData);
      if (response.status === 201) {
        alert('Ingredient added successfully!');
        // Reset form
        setFormData({
          name: '',
          average_weight: '',
          category: '',
          calories_per_100g: '',
          protein: '',
          lipids: '',
          carbohydrates: '',
          allergies: '',
          dietary_restrictions: '',
          form: '',
          saturated_fat: '',
          trans_fat: '',
          cholesterol: '',
          sodium: '',
          fibers: '',
          sugars: '',
          added_sugars: '',
          intolerance: ''
        });
      }
    } catch (error) {
      alert('Error adding ingredient: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fields = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'average_weight', label: 'Average Weight (g)', type: 'number', step: '1' },
    { name: 'category', label: 'Category', type: 'text', required: true },
    { name: 'calories_per_100g', label: 'Calories per 100g', type: 'number', step: '1', required: true },
    { name: 'protein', label: 'Protein (g)', type: 'number', step: '0.01' },
    { name: 'lipids', label: 'Lipids (g)', type: 'number', step: '0.01' },
    { name: 'carbohydrates', label: 'Carbohydrates (g)', type: 'number', step: '0.01' },
    { name: 'allergies', label: 'Allergies', type: 'text' },
    { name: 'dietary_restrictions', label: 'Dietary Restrictions', type: 'text' },
    { name: 'form', label: 'Form', type: 'text' },
    { name: 'saturated_fat', label: 'Saturated Fat (g)', type: 'number', step: '0.01' },
    { name: 'trans_fat', label: 'Trans Fat (g)', type: 'number', step: '0.01' },
    { name: 'cholesterol', label: 'Cholesterol (mg)', type: 'number', step: '0.01' },
    { name: 'sodium', label: 'Sodium (g)', type: 'number', step: '0.0001' },
    { name: 'fibers', label: 'Fibers (g)', type: 'number', step: '0.01' },
    { name: 'sugars', label: 'Sugars (g)', type: 'number', step: '0.01' },
    { name: 'added_sugars', label: 'Added Sugars (g)', type: 'number', step: '0.01' },
    { name: 'intolerance', label: 'Intolerance', type: 'text' }
  ];

  return (
    <div className="add-ingredient-container">
      <h2>Add New Ingredient</h2>
      <form onSubmit={handleSubmit}>
        <table>
          <tbody>
            {fields.map(field => (
              <tr key={field.name}>
                <td>{field.label}</td>
                <td>
                  <input
                    name={field.name}
                    value={formData[field.name]}
                    onChange={handleChange}
                    type={field.type}
                    step={field.step || 'any'}
                    required={field.required}
                    min="0"
                  />
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan="2" style={{ textAlign: 'center', border: 'none' }}>
                <button type="submit" className="save-btn">
                  Save Ingredient
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
};

export default AddIngredient;
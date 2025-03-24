import React, { useState } from 'react';
import apiClient from '../../services/apiClient';


const AddIngredient = () => {
  // Manual form state
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

  // Excel upload state
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  // Handle manual form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const processedData = {
      name: formData.name.trim() || null,
      average_weight: formData.average_weight ? parseInt(formData.average_weight) : null,
      category: formData.category.trim() || null,
      calories_per_100g: formData.calories_per_100g ? parseInt(formData.calories_per_100g) : null,
      protein: formData.protein ? parseFloat(formData.protein) : null,
      lipids: formData.lipids ? parseFloat(formData.lipids) : null,
      carbohydrates: formData.carbohydrates ? parseFloat(formData.carbohydrates) : null,
      allergies: formData.allergies.trim() || null,
      dietary_restrictions: formData.dietary_restrictions.trim() || null,
      form: formData.form.trim() || null,
      saturated_fat: formData.saturated_fat ? parseFloat(formData.saturated_fat) : null,
      trans_fat: formData.trans_fat ? parseFloat(formData.trans_fat) : null,
      cholesterol: formData.cholesterol ? parseFloat(formData.cholesterol) : null,
      sodium: formData.sodium ? parseFloat(formData.sodium) : null,
      fibers: formData.fibers ? parseFloat(formData.fibers) : null,
      sugars: formData.sugars ? parseFloat(formData.sugars) : null,
      added_sugars: formData.added_sugars ? parseFloat(formData.added_sugars) : null,
      intolerance: formData.intolerance.trim() || null
    };

    try {
      const response = await apiClient.post('/ingredients', processedData);
      if (response.status === 201) {
        alert('Ingredient added successfully!');
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

  // Handle Excel upload
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a file first');
      return;
    }
  
    const formData = new FormData();
    formData.append('file', file); // Must match Multer's field name
  
    try {
      setUploadStatus({ message: 'Uploading...', success: null });
      
      const response = await apiClient.post('/ingredients/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data' // Let browser set boundary
        }
      });
  
      setUploadStatus({
        success: true,
        message: response.data.message,
        inserted: response.data.inserted
      });
      setValidationErrors(response.data.errors || []);
  
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        success: false,
        message: error.response?.data?.message || 'Upload failed. Check console for details.'
      });
      setValidationErrors(error.response?.data?.errors || []);
    }
  };

  // Download template
  const downloadTemplate = async () => {
    try {
      const response = await apiClient.get('/ingredients/template', {
        responseType: 'blob'
      });

      // Create Blob with explicit MIME type
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Create temporary link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = 'ingredient_template.xlsx';

      // Append and trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download template. Please check your connection and try again.');
    }
  };

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Form field configuration
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
      {/* Excel Upload Section */}
      <div className="excel-upload-section">
        <h3>Bulk Upload</h3>
        
        <div className="upload-controls">

    {/* Upload Form */}
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
  </div>

  <button onClick={downloadTemplate} className="download-btn">
      Download Template
    </button>

  {uploadStatus && (
    <div className={`upload-status ${uploadStatus.success ? 'success' : 'error'}`}>
            <p>{uploadStatus.message}</p>
            {validationErrors.length > 0 && (
              <div className="validation-errors">
                <h4>Validation Issues:</h4>
                <ul>
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <h2>Manually Add Ingredient</h2>
      
      {/* Manual Entry Form */}
      <div className="manual-entry-section">
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

      
    </div>
  );
};

export default AddIngredient;
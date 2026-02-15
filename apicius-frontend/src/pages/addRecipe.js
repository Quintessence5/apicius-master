import React, { useState, useEffect } from 'react';
import AsyncSelect from 'react-select/async';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import "../styles/addRecipe.css";
import TranscriptToRecipe from '../components/TranscriptToRecipe';
import "../styles/transcriptToRecipe.css"

const AddRecipe = () => {
    const location = useLocation();
    const editingRecipe = location.state?.recipe || null;
    const [recipe, setRecipe] = useState({
      title: editingRecipe?.title || '',
      steps: editingRecipe?.steps || [],
      notes: editingRecipe?.notes || '',
      prep_time: editingRecipe?.prep_time || '',
      cook_time: editingRecipe?.cook_time || '',
      total_time: editingRecipe?.total_time || '',
      difficulty: editingRecipe?.difficulty || '',
      course_type: editingRecipe?.course_type || '',
      meal_type: editingRecipe?.meal_type || '',
      cuisine_type: editingRecipe?.cuisine_type || '',
      public: editingRecipe?.public || false,
      source: editingRecipe?.source || '',
      portions: editingRecipe?.portions || '',
      image_path: editingRecipe?.image_path || null, 
      ...editingRecipe,
  });
    const [ingredients, setIngredients] = useState([{ ingredientId: '', quantity: '', unit: '', form: '', locked: false }]);
    const [availableUnits, setAvailableUnits] = useState([]);
    const courseTypes = ['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage'];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const cuisineTypes = ['Italian', 'Chinese', 'Indian', 'Mexican', 'French', 'Others'];
    const difficulty = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard' ];
    const [error, setError] = useState("");
    const [editingIngredientIndex, setEditingIngredientIndex] = useState(null);
    const [editingStepIndex, setEditingStepIndex] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [currentStep, setCurrentStep] = useState("");
    const [deletedIngredients, setDeletedIngredients] = useState([]);
    const navigate = useNavigate();

    document.addEventListener("DOMContentLoaded", () => {
      const imageInput = document.getElementById("recipe-image");
      const label = document.querySelector(".upload-label");
    
      imageInput.addEventListener("change", () => {
        if (imageInput.files && imageInput.files.length > 0) {
          label.style.display = "none"; 
        } else {
          label.style.display = "block";
        }
      });
    });    

    // Fetch available ingredients and units on component mount
    useEffect(() => {
      const fetchUnits = async () => {
          try {
              const unitResponse = await axios.get('/api/units');
              const normalizedUnits = unitResponse.data.map((unit) => ({
                  ...unit,
                  type: unit.type.toLowerCase(),
              }));
              setAvailableUnits(normalizedUnits || []);
          } catch (error) {
              setError("Failed to fetch units. Please try again.");
              console.error("Error fetching units:", error);
          }
      };
  
      if (editingRecipe) {
        setRecipe({
          ...editingRecipe,
          public: editingRecipe.public || false,
        });
    
        // Ensure ingredients are set correctly
        if (editingRecipe.ingredients) {
          const formattedIngredients = editingRecipe.ingredients.map((ing) => ({
            ingredientId: ing.ingredient_id || "", 
            ingredientName: ing.ingredient_name || "",
            quantity: ing.quantity || "",
            unit: ing.unit || "",
            form: ing.form || "",
            locked: true,
          }));
    
          // Add an empty ingredient field at the end
          formattedIngredients.push({ ingredientId: "", ingredientName: "", quantity: "", unit: "", form: "", locked: false });
    
          setIngredients(formattedIngredients);
        }
      } else {
        // Ensure there's at least one empty ingredient row for new recipes
        setIngredients([{ ingredientId: "", ingredientName: "", quantity: "", unit: "", form: "", locked: false }]);
      }
    
      fetchUnits();
      console.log("Received recipe for editing:", editingRecipe);
    }, [editingRecipe]);  

    const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      const newValue =
          type === "checkbox"
              ? checked
              : ["prep_time", "cook_time", "portions"].includes(name)
              ? value === "" ? null : parseInt(value)
              : value;
  
      setRecipe((prev) => ({
          ...prev,
          [name]: newValue,
          total_time: name === "prep_time" || name === "cook_time"
              ? (name === "prep_time" ? newValue || 0 : prev.prep_time || 0) +
                (name === "cook_time" ? newValue || 0 : prev.cook_time || 0)
              : prev.total_time,
      }));
  };  

  const handleIngredientChange = (index, selectedOption) => {
    const newIngredients = [...ingredients];
    newIngredients[index].ingredientId = selectedOption.value;
    newIngredients[index].ingredientName = selectedOption.label;
    newIngredients[index].form = selectedOption.form || "unknown";
    setIngredients(newIngredients);
  };
    
const fetchIngredients = async (inputValue) => {
  if (!inputValue || inputValue.trim().length < 2) {
    return ingredients
      .filter((ing) => ing.ingredientId && ing.ingredientName)
      .map((ing) => ({
        value: ing.ingredientId,
        label: ing.ingredientName,
        form: ing.form || "unknown",
      }));
  }

  try {
    const response = await axios.get(`/api/ingredients/suggestions?search=${inputValue.trim()}`);
    console.log("Fetched ingredients:", response.data); 
    return response.data.map((ingredient) => ({
      value: ingredient.id,
      label: ingredient.name,
      form: ingredient.form || "unknown",
    }));
  } catch (error) {
    console.error("Error fetching ingredient suggestions:", error);
    return [];
  }
};

      const addIngredient = () => {
        if (isValidIngredient(ingredients[ingredients.length - 1])) {
          const updatedIngredients = [...ingredients];
          updatedIngredients[updatedIngredients.length - 1].locked = true;
          setIngredients([
            ...updatedIngredients,
            { ingredientId: "", quantity: "", unit: "", form: "", locked: false },
          ]);
        }
      };
      
      const isValidIngredient = (ingredient) =>
        ingredient.ingredientId &&
        ingredient.quantity &&
        ingredient.unit &&
        !ingredient.locked;
    
        const handleEdit = (index) => {
          setEditingIngredientIndex(index); 
          const updatedIngredients = [...ingredients];
          updatedIngredients[index].locked = false;
          setIngredients(updatedIngredients);
        };      
    
        const removeIngredient = (index) => {
          setIngredients((prev) => prev.filter((_, i) => i !== index));
      
          // If the ingredient has an ID, mark it for deletion
          const ingredientToRemove = ingredients[index];
          if (ingredientToRemove.ingredientId) {
              setDeletedIngredients((prev) => [...prev, ingredientToRemove.ingredientId]);
          }
      };
      
      const handleSaveEditIngredient = (index) => {
        const updatedIngredients = [...ingredients];
        updatedIngredients[index].locked = true;
        setIngredients(updatedIngredients);
        setEditingIngredientIndex(null); 
      };

        //Unit Handler
        const handleUnitChange = (index, e) => {
            const { name, value } = e.target;
            const newIngredients = [...ingredients];
            newIngredients[index][name] = value;
            setIngredients(newIngredients);
         };

         const getFilteredUnits = (form) => {
          console.log("Filtering units for form:", form);
          if (!form) return availableUnits;
          if (form === "solid") {
            return availableUnits.filter((unit) => unit.type === "weight" || unit.type === "quantity");
          }
          if (form === "liquid") {
            return availableUnits.filter((unit) => unit.type === "volume");
          }
          return [];
        };

  const handleAddStep = (e) => {
    if (e.key === 'Enter' && currentStep.trim()) {
        e.preventDefault(); 
        setRecipe((prev) => ({
            ...prev,
            steps: [...(prev.steps || []), currentStep.trim()],
        }));
        setCurrentStep(""); 
    }
};

const handleEditStepStart = (index) => {
  setEditingStepIndex(index);
};

const handleSaveEditStep = (index) => {
  setEditingStepIndex(null);
};

const handleEditStep = (index, newValue) => {
  setRecipe((prev) => {
    const updatedSteps = [...prev.steps];
    updatedSteps[index] = newValue.trim();
    return { ...prev, steps: updatedSteps };
  });
};

const handleDeleteStep = (index) => {
  setRecipe((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
  }));
};

    // Save and delete functions
    const handleSave = async () => {
      try {
          const formData = new FormData();
  
          // Append recipe fields
          Object.entries(recipe).forEach(([key, value]) => {
              if (key === "steps") {
                  const stepsArray = Array.isArray(value) ? value : [];
                  stepsArray.forEach((step, index) => formData.append(`steps[${index}]`, step));
              } else {
                  formData.append(key, value);
              }
          });
  
          // Determine if updating or creating a new recipe
          const isEditing = !!editingRecipe;
          const recipeId = isEditing ? (editingRecipe.recipe_id || editingRecipe.id) : null;
  
          if (isEditing && !recipeId) {
              console.error("❌ Error: Recipe ID is missing!");
              return;
          }
  
          // Append recipe ID only if updating
          if (isEditing) {
              formData.append("id", recipeId);
          }
  
          // Filter out empty or invalid ingredients
          const validIngredients = ingredients.filter(
              (ing) => ing.locked && (ing.ingredientId || ing.name) // Only include locked and valid ingredients
          );
  
          // 🔹 Append ingredients
          if (validIngredients.length > 0) {
            ingredients.forEach((ingredient, index) => {
                if (ingredient.ingredientId || ingredient.name) {
                    formData.append(`ingredients[${index}][ingredientId]`, ingredient.ingredientId || "");
                    formData.append(`ingredients[${index}][name]`, ingredient.ingredientName || "");
                    formData.append(`ingredients[${index}][quantity]`, ingredient.quantity || "");
                    formData.append(`ingredients[${index}][unit]`, ingredient.unit || "");
                    formData.append(`ingredients[${index}][recipeId]`, recipeId || ""); // Attach to recipe ID when editing
                }
            });
        } else {
            console.warn("⚠️ No ingredients to append.");
        }
  
          // Append deletedIngredients as a JSON array
        if (deletedIngredients.length > 0) {
          formData.append("deletedIngredients", JSON.stringify(deletedIngredients));
      }
  
          // Append selected image (if present)
          if (selectedImage) {
              formData.append("image", selectedImage);
          }
  
          // Make the API call
          if (isEditing) {
              console.log(`Updating recipe ID: ${recipeId}`);
              await axios.put(`/api/recipes/${recipeId}`, formData, {
                  headers: { "Content-Type": "multipart/form-data" },
              });
              alert("✅ Recipe updated successfully!");
          } else {
              console.log("Creating new recipe...");
              const response = await axios.post("/api/recipes", formData, {
                  headers: { "Content-Type": "multipart/form-data" },
              });
              console.log("🆕 New recipe created:", response.data);
              alert("✅ Recipe saved successfully!");
          }
  
          navigate("/all-recipes");
      } catch (err) {
          console.error("❌ Error saving recipe:", err);
          setError("Failed to save the recipe. Please try again.");
      }
  };
        
  const handleDelete = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete this recipe?");
    if (confirmDelete) {
        try {
            const recipeId = editingRecipe?.id || editingRecipe?.recipe_id;
            if (!recipeId) {
                console.error("❌ Error: Recipe ID is missing!");
                return;
            }

            // Call the backend API to delete the recipe
            await axios.delete(`/api/recipes/${recipeId}`);

            // Reset the form state
            setRecipe({
              title: "",
              steps: [],
              notes: "",
              prep_time: "",
              cook_time: "",
              total_time: "",
              difficulty: "",
              course_type: "",
              meal_type: "",
              cuisine_type: "",
              public: false,
              source: "",
              portions: "",
              image_path: null,
          });
            setIngredients([{ ingredientId: "", quantity: "", unit: "", form: "", locked: false }]);
            setDeletedIngredients([]);
            setError("");

            // Navigate back
            navigate("/all-recipes");
        } catch (error) {
            console.error("❌ Error deleting recipe:", error);
            setError("Failed to delete the recipe. Please try again.");
        }
    }
};

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    setSelectedImage(file);

    // Generate a preview URL
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
};

const handleImageUpload = async () => {
  if (!selectedImage) {
      alert('Please select an image');
      return;
  }

  const formData = new FormData();
  formData.append('image', selectedImage);

  try {
      const response = await axios.post('http://localhost:5010/api/recipes/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(response.data.message);

      // Save the image path in recipe state
      setRecipe((prev) => ({ ...prev, imagePath: response.data.imagePath }));
  } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
  }
};

    return (
            <div className="add-recipe-container">
                {error && <div className="error-message">{error}</div>}

                {/* Save and Delete Buttons */}
            <div className="action-buttons">
                <button className="save-button" onClick={handleSave}>
                    Save Recipe
                </button>
                <button className="delete-recipe-button" onClick={handleDelete}>
                    Delete Recipe
                </button>
            </div>
            
            <div className="add-recipe-container">
        
            <div className="header-row">

              <TranscriptToRecipe onRecipeGenerated={(recipe) => {
    setRecipe({
        ...recipe,
        steps: recipe.steps || []
    });
    setIngredients(recipe.ingredients.map(ing => ({
        ingredientId: '',
        ingredientName: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        form: 'unknown',
        locked: false
    })));
}} />

    <input
        type="text"
        id="titleInput"
        name="title"
        value={recipe.title || ""}
        onChange={handleChange}
        placeholder=" "
        required
    />
    <label htmlFor="titleInput" className={recipe.title ? 'float' : ''}> Title </label>
</div>

            <div className="difficulty-row"> 
            <div className="difficulty">
              <select name="difficulty" value={recipe.difficulty || ""} onChange={handleChange} required>
                <option value=""></option>
                {difficulty.map((type) => (
                <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <label className={recipe.difficulty ? 'float' : ''}> Difficulty </label>
            </div>

            <div className="source-container">
            <input 
            type="text" 
            name="source" 
            value={recipe.source || ""} 
            onChange={handleChange} 
            placeholder=" " />
            <label className={recipe.source ? 'float' : ''}> Source (Optional) </label>
            </div>

            <div className="portions-row">
            <input
            type="number"
            id="portions"
            name="portions"
            value={recipe.portions}
            onChange={handleChange}
            min="1"
            />
            <label htmlFor="portions" className={recipe.portions ? 'float' : ''}> Portion Number </label>
            </div>
            </div>
            

            <div className="meal-type">
                {/* Course Type */}
                <div className="meal-type-select">
                    <select
                        id="courseTypeSelect"
                        name="course_type"
                        value={recipe.course_type || ""}
                        onChange={handleChange}
                        required
                    >
                        <option value=""></option>
                        {courseTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <label htmlFor="courseTypeSelect" className={recipe.course_type ? 'float' : ''}>Course Type
                    </label>
                </div>

                {/* Meal Type */}
                <div className="meal-type-select">
                    <select
                        id="mealTypeSelect"
                        name="meal_type"
                        value={recipe.meal_type || ""}
                        onChange={handleChange}
                        required
                    >
                        <option value=""></option>
                        {mealTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <label htmlFor="mealTypeSelect" className={recipe.meal_type ? 'float' : ''}>Meal Type</label>
                </div>

                {/* Cuisine Type */}
                <div className="meal-type-select">
                    <select
                        id="cuisineTypeSelect"
                        name="cuisine_type"
                        value={recipe.cuisine_type || ""}
                        onChange={handleChange}
                        required
                    >
                        <option value=""></option>
                        {cuisineTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <label htmlFor="cuisineTypeSelect" className={recipe.cuisine_type ? 'float' : ''}>Cuisine Type</label>
                </div>
            </div>
            
            <div className="time-row">
              <input
                type="number"
                name="prep_time"
                value={recipe.prep_time || ""}
                onChange={handleChange}
                placeholder="Prep Time (minutes)"
                min="0"
                className="time-field"
                required
              />
              <input
                type="number"
                name="cook_time"
                value={recipe.cook_time || ""}
                onChange={handleChange}
                placeholder="Cook Time (minutes)"
                min="0"
                className="time-field"
                required
              />
              <input
                type="number"
                name="total_time"
                value={recipe.total_time || ""}
                placeholder="Total Time (auto-calculated)"
                className="time-field"
                readOnly
              />
            </div>
            
            <div className="notes-container">
                <textarea
                    id="recipeNotes"
                    name="notes"
                    value={recipe.notes || ""}
                    onChange={handleChange}
                    placeholder=" "
                />
                <label htmlFor="recipeNotes" className={recipe.notes ? 'float' : ''}>Notes (optional)</label>
            </div>
            
            <div className="steps-container">
                <h4>Steps</h4>
                <ul>
                    {(recipe.steps || []).map((step, index) => (
                      <li key={index} className="step-row">
                      {editingStepIndex === index ? (
                      <>
    <textarea
      value={recipe.steps[index] || ""}
      onChange={(e) => handleEditStep(index, e.target.value)}
      className="step-edit-textarea"
    ></textarea>
    <button
      className="steps-save-edit-button"
      onClick={() => handleSaveEditStep(index)}
    >
      ✔
    </button>
  </>
) : (
  <>
    <span>{index + 1}. {step}</span>
    <button
      className="steps-edit-button"
      onClick={() => handleEditStepStart(index)}
    >
      ✏️
    </button>
    <button
      className="steps-delete-button"
      onClick={() => handleDeleteStep(index)}
    >
      ❌
    </button>
  </>
                )}
            </li>
        ))}
    </ul>
    <textarea
        placeholder="Type a step and press Enter"
        value={currentStep}
        onChange={(e) => setCurrentStep(e.target.value)}
        onKeyDown={handleAddStep}
        className="steps-textarea"
    ></textarea>
</div>

            <div className="addrecipe-checkbox-row">
              <label className="addrecipe-checkbox-label">
                  <input
                  type="checkbox"
                  name="public"
                  checked={recipe.public || false}
                  onChange={handleChange}
                  /> Public
              </label>
            </div>
            </div>

        {/* Ingredients Section */}
    <div className="ingredients-container">
      <h3>Ingredients</h3>
      {(ingredients || []).map((ingredient, index) => (
        <div className="ingredient-row" key={index}>
 {ingredient.locked ? (
  <div className="locked-ingredient-row">
    <span className="locked-ingredient-text">
      {ingredient.quantity} {ingredient.unit} of {ingredient.ingredientName}
    </span>
    <button
      className="ingredient-edit-button"
      onClick={() => handleEdit(index)}
    >
      ✏️
    </button>
    <button
      className="ingredient-delete-button"
      onClick={() => removeIngredient(index)}
    >
      ❌
    </button>
  </div>
      ) : (
        <>
          {/* Ingredient Selection */}
          <div className="ingredientRS-select">
          
          
          <AsyncSelect
  className="ingredientRS-select"
  classNamePrefix="custom-select"
  placeholder="Type to search"
  cacheOptions
  defaultOptions={false}
  loadOptions={fetchIngredients}
  noOptionsMessage={() => "No options"}
  onChange={(selectedOption) => handleIngredientChange(index, selectedOption)}
  value={
    ingredient.ingredientId
      ? { value: ingredient.ingredientId, label: ingredient.ingredientName }
      : null
  }
/></div>

  {/* Quantity and Unit Group */}
  <div className="quantity-unit-group">
    <input
      type="number"
      name="quantity"
      value={ingredient.quantity}
      onChange={(e) => handleUnitChange(index, e)}
      placeholder="Quantity"
      min="0"
      required
    />

    {/* Unit Selection */}
    <select
      name="unit"
      value={ingredient.unit}
      onChange={(e) => handleUnitChange(index, e)}
      required
    >
      <option value="">Units</option>
      {getFilteredUnits(ingredient.form).map((unit) => (
        <option key={unit.id} value={unit.abbreviation}>
          {unit.name} ({unit.abbreviation})
        </option>
      ))}
    </select>
    </div>
     {/* Save/Confirm Button */}
     {editingIngredientIndex === index && (
          <button
            className="ingredient-save-edit-button"
            onClick={() => handleSaveEditIngredient(index)}
            disabled={!isValidIngredient(ingredients[index])}
          >
            ✔
          </button>
        )}
        </>
      )}
    </div>
  ))}
      {/* Add Ingredient Button */}
  <button
    className="add-ingredient-button"
    onClick={addIngredient}
    disabled={!isValidIngredient(ingredients[ingredients.length - 1])}
  >
    Add Ingredient
  </button>
</div>
<div className="upload-container">
            {!previewUrl && <label htmlFor="imageUpload">Upload Recipe Picture <br /> ⬇ </label>}
            <input type="file" id="imageUpload" onChange={handleImageChange} />
            {previewUrl && <img src={previewUrl} alt="Preview" />}
            {previewUrl && (
                <button type="button" onClick={handleImageUpload}>
                    Upload Image
                </button>
            )}
        </div></div>

    );
};

export default AddRecipe;

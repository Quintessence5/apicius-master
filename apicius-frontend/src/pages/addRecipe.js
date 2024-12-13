import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import "../styles/addRecipe.css";

const AddRecipe = () => {
    const [recipe, setRecipe] = useState({
        title: '', description: '', notes: '', prep_time: '', cook_time: '', total_time: '', difficulty: '', 
        course_type: '', meal_type: '', cuisine_type: '', public: false, source: ''
    });
    const [ingredients, setIngredients] = useState([{ ingredientId: '', quantity: '', unit: '', form: '', locked: false }]);
    const [availableIngredients, setAvailableIngredients] = useState([]);
    const [availableUnits, setAvailableUnits] = useState([]);
    const courseTypes = ['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage'];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const cuisineTypes = ['Italian', 'Chinese', 'Indian', 'Mexican', 'French', 'Others'];
    const difficulty = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard' ];
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // Fetch available ingredients and units on component mount
    useEffect(() => {
        const fetchIngredients = async () => {
            try {
                const ingredientResponse = await axios.get('/api/ingredients'); // Ensure API returns form data
                setAvailableIngredients(ingredientResponse.data || []);
            } catch (error) {
                console.error("Error fetching ingredients:", error);
            }
        };
    
        const fetchUnits = async () => {
            try {
                const unitResponse = await axios.get('/api/units');
                const normalizedUnits = unitResponse.data.map((unit) => ({
                    ...unit,
                    type: unit.type.toLowerCase(), // Ensure consistent lowercase values
                }));
                setAvailableUnits(normalizedUnits || []);
            } catch (error) {
                setError("Failed to fetch units. Please try again.");
                console.error("Error fetching units:", error);
            }
        };
    
        fetchIngredients();
        fetchUnits();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : (name === 'prep_time' || name === 'cook_time') ? parseInt(value) || 0 : value;
        setRecipe(prev => ({
            ...prev,
            [name]: newValue,
            total_time: (name === 'prep_time' ? newValue : prev.prep_time) + (name === 'cook_time' ? newValue : prev.cook_time),
        }));
    };

    const handleIngredientChange = (index, selectedOption) => {
      const newIngredients = [...ingredients];
      newIngredients[index].ingredientId = selectedOption.value;
      newIngredients[index].ingredientName = selectedOption.label; // Save the name
      newIngredients[index].form = selectedOption.form;
      newIngredients[index].unit = ""; // Reset unit when ingredient changes
      setIngredients(newIngredients);
    };
    

      const addIngredient = () => {
        if (isValidIngredient(ingredients[ingredients.length - 1])) {
          const updatedIngredients = [...ingredients];
          updatedIngredients[updatedIngredients.length - 1].locked = true; // Lock the last one
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
          const updatedIngredients = [...ingredients];
          updatedIngredients[index].locked = false;
          setIngredients(updatedIngredients);
        };
        
    
        const removeIngredient = (index) => {
          setIngredients((prev) => prev.filter((_, i) => i !== index));
        };        

    //Unit Handler
    const handleUnitChange = (index, e) => {
        const { name, value } = e.target;
        const newIngredients = [...ingredients];
        newIngredients[index][name] = value;
        setIngredients(newIngredients);
    };

    const getFilteredUnits = (form) => {
        if (!form) return []; // No units if form is undefined
        if (form === 'solid') {
            // Return units that are weight or quantity
            return availableUnits.filter((unit) => unit.type === 'weight' || unit.type === 'quantity');
        }
        if (form === 'liquid') {
            // Return units that are volume
            return availableUnits.filter((unit) => unit.type === 'volume');
        }
        return []; // Default empty array for invalid form values
    };    

    const handleSaveEdit = (index) => {
      const updatedIngredients = [...ingredients];
      updatedIngredients[index].locked = true; // Lock the ingredient again
      setIngredients(updatedIngredients);
    };    
    
    // Save and delete functions
  const handleSave = async () => {
    try {
      const lockedIngredients = ingredients.filter((ing) => ing.locked);
      await axios.post("/api/recipes", { ...recipe, ingredients: lockedIngredients });
      alert("Recipe saved successfully!");
      navigate("/all-recipes");
    } catch (err) {
      console.error("Error saving recipe:", err);
      setError("Failed to save the recipe. Please try again.");
    }
  };

  const handleDelete = () => {
    const confirmDelete = window.confirm("Are you sure you want to delete this recipe?");
    if (confirmDelete) {
      setRecipe({
        title: "",
        description: "",
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
      });
      setIngredients([{ ingredientId: "", quantity: "", unit: "", form: "" }]);
      setError("");
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
            <div className="header-row"><input type="text" name="title" value={recipe.title} onChange={handleChange} placeholder="Title" required /></div>
            
            <div className="difficulty-con">
            <div className="difficulty"><select name="difficulty" value={recipe.difficulty} onChange={handleChange} required>
                <option value="">Select Difficulty</option>
                {difficulty.map((type) => (
                <option key={type} value={type}>{type}</option>
                ))}
            </select>

            <div className="source-container">
            <input type="text" name="source" value={recipe.source} onChange={handleChange} placeholder="Source (Optional)" />
            </div>
            </div>
            </div>

            <div className="meal-type">
            <select name="course_type" value={recipe.course_type} onChange={handleChange} required>
                <option value="">Select Course Type</option>
                {courseTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
                ))}
            </select>

            <select name="meal_type" value={recipe.meal_type} onChange={handleChange} required>
                <option value="">Select Meal Type</option>
                {mealTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
                ))}
            </select>

            <select name="cuisine_type" value={recipe.cuisine_type} onChange={handleChange} required>
                <option value="">Select Cuisine Type</option>
                {cuisineTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
                ))}
            </select>
            </div>
            
            <div className="time-row"><input type="number" name="prep_time" value={recipe.prep_time} onChange={handleChange} placeholder="Prep Time" min="0" required />
            <input type="number" name="cook_time" value={recipe.cook_time} onChange={handleChange} placeholder="Cook Time" min="0" required />
            <input type="number" name="total_time" value={recipe.total_time} placeholder="Total Time (auto-calculated)" readOnly /></div>

            <div className="description-container">
            <textarea name="description" value={recipe.description} onChange={handleChange} placeholder="Description" required></textarea>
             {/* Notes Section */}
             </div>

            <div className="notes-container">
            <textarea
            name="notes"
            value={recipe.notes}
            onChange={handleChange}
            placeholder="Notes (optional)"
            />
            </div>

            <label>
                <input type="checkbox" name="public" checked={recipe.public} onChange={handleChange} />
                Public
            </label>
            </div>

        {/* Ingredients Section */}
    <div className="ingredients-container">
      <h3>Ingredients</h3>
      {ingredients.map((ingredient, index) => (
        
        <div className="ingredient-row" key={index}>
 {ingredient.locked ? (
  <div className="locked-ingredient-row">
    <span className="locked-ingredient-text">
      {ingredient.quantity}
      {ingredient.unit} of {ingredient.ingredientName}
    </span>
    <button
      className="edit-button"
      onClick={() => handleEdit(index)}
    >
      ✏️
    </button>
    <button
      className="delete-button"
      onClick={() => removeIngredient(index)}
    >
      -
    </button>
  </div>
      ) : (
        <>
          {/* Ingredient Selection */}
  <Select
  className="ingredientRS-select"
  classNamePrefix="custom-select"
    options={availableIngredients.map((ing) => ({
      value: ing.id,
      label: ing.name,
      form: ing.form,
    }))}
    onChange={(selectedOption) => handleIngredientChange(index, selectedOption)}
        value={
          ingredient.ingredientId
            ? {
                value: ingredient.ingredientId,
                label: ingredient.ingredientName,
              }
            : null
        }
        placeholder="Select Ingredient"
        isClearable
      />
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
      <option value="">Select Unit</option>
      {getFilteredUnits(ingredient.form).map((unit) => (
        <option key={unit.id} value={unit.abbreviation}>
          {unit.name} ({unit.abbreviation})
        </option>
      ))}
    </select>
    </div>
     {/* Save/Confirm Button */}
     <button className="save-edit-button" onClick={() => handleSaveEdit(index)} disabled={!isValidIngredient(ingredients[index])}>
        ✔
      </button>
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
</div>
    );
};

export default AddRecipe;

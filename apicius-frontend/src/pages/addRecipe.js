import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AddRecipe = () => {
    const [recipe, setRecipe] = useState({
        title: '',
        description: '',
        notes: '',
        prep_time: '',
        cook_time: '',
        total_time: '',
        difficulty: '',
    });
    const [ingredients, setIngredients] = useState([{ ingredientId: '', quantity: 0, unit: '' }]);
    const [availableIngredients, setAvailableIngredients] = useState([]);
    const [availableUnits, setAvailableUnits] = useState([]);

    // Fetch available ingredients and units on component mount
    useEffect(() => {
        // Inside your component or function
        const fetchIngredientsAndUnits = async () => {
            try {
                const response = await axios.get('/api/recipes/ingredients'); // Ensure this matches your backend route
                // Handle the response data
            } catch (error) {
                console.error("Error fetching ingredients or units:", error);
            }
        };
        
        fetchIngredientsAndUnits();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newValue = name === 'prep_time' || name === 'cook_time' ? parseInt(value) || 0 : value; // Handle NaN
        setRecipe(prev => ({
            ...prev,
            [name]: newValue,
            total_time: (name === 'prep_time' ? newValue : recipe.prep_time) + (name === 'cook_time' ? newValue : recipe.cook_time),
        }));
    };

    const handleIngredientChange = (index, e) => {
        const { name, value } = e.target;
        const newIngredients = [...ingredients];
        newIngredients[index][name] = value;
        setIngredients(newIngredients);
    };

    const addIngredientField = () => {
        setIngredients([...ingredients, { ingredientId: '', quantity: 0, unit: '' }]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/recipes', {
                ...recipe,
                ingredients: ingredients.map((ing) => ({
                    ingredientId: ing.ingredientId,
                    quantity: ing.quantity,
                    unit: ing.unit,
                })),
            });
            alert("Recipe added successfully!");
        } catch (error) {
            console.error("Error adding recipe:", error);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input type="text" name="title" value={recipe.title} onChange={handleChange} placeholder="Title" required />
            <textarea name="description" value={recipe.description} onChange={handleChange} placeholder="Description" required></textarea>
            <input type="text" name="notes" value={recipe.notes} onChange={handleChange} placeholder="Notes" />
            <input type="number" name="prep_time" value={recipe.prep_time} onChange={handleChange} placeholder="Prep Time" min="0" required />
            <input type="number" name="cook_time" value={recipe.cook_time} onChange={handleChange} placeholder="Cook Time" min="0" required />
            <input type="number" name="total_time" value={recipe.total_time} placeholder="Total Time (auto-calculated)" readOnly />
            <input type="text" name="difficulty" value={recipe.difficulty} onChange={handleChange} placeholder="Difficulty" required />

            {ingredients.map((ingredient, index) => (
                <div key={index}>
                    <select 
                        name="ingredientId" 
                        value={ingredient.ingredientId} 
                        onChange={(e) => handleIngredientChange(index, e)} 
                        required
                    >
                        <option value="">Select Ingredient</option>
                        {availableIngredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                    </select>
                    <input type="number" name="quantity" value={ingredient.quantity} onChange={(e) => handleIngredientChange(index, e)} placeholder="Quantity" min="0" required />
                    <select 
                        name="unit" 
                        value={ingredient.unit} 
                        onChange={(e) => handleIngredientChange(index, e)} 
                        required
                    >
                        <option value="">Select Unit</option>
                        {availableUnits.map((unit) => (
                            <option key={unit.id} value={unit.unit_name}>{unit.unit_name}</option>
                        ))}
                    </select>
                </div>
            ))}
            <button type="button" onClick={addIngredientField}>Add Ingredient</button>
            <button type="submit">Add Recipe</button>
        </form>
    );
};

export default AddRecipe;

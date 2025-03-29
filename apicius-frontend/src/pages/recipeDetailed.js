import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/recipeDetailed.css';
import NoImageAvailable from '../assets/images/No_Image_Avail.jpg';

const RecipeDetails = () => {
    const navigate = useNavigate();
    const { id } = useParams(); 
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [units, setUnits] = useState([]);
    const [solidUnit, setSolidUnit] = useState('g');
    const [liquidUnit, setLiquidUnit] = useState('ml');
    const [currentPortions, setCurrentPortions] = useState(1);
    const [basePortions, setBasePortions] = useState(1);
    const [isEditingPortions, setIsEditingPortions] = useState(false);
    const [hasSolidIngredients, setHasSolidIngredients] = useState(false);
    const [hasLiquidIngredients, setHasLiquidIngredients] = useState(false);

    useEffect(() => {
        const fetchRecipe = async () => {
            try {
                const response = await axios.get(`/api/recipes/${id}`);
                console.log("Fetched Recipe Data:", response.data); 
                setRecipe(response.data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching recipe:", error);
                setLoading(false);
            }
        };
        fetchRecipe();
    }, [id]);

    useEffect(() => {
        if (recipe) {
            const initialPortions = recipe.portions || 1;
            setCurrentPortions(initialPortions);
            setBasePortions(initialPortions);
        // Check ingredient types
        let hasSolid = false;
        let hasLiquid = false;
        recipe.ingredients?.forEach(ingredient => {
            if (ingredient.form === 'solid') hasSolid = true;
            if (ingredient.form === 'liquid') hasLiquid = true;
        });
        setHasSolidIngredients(hasSolid);
        setHasLiquidIngredients(hasLiquid);
    }
    }, [recipe]);

    useEffect(() => {
        const fetchUnits = async () => {
            try {
                const response = await axios.get('/api/units');
                setUnits(response.data);
            } catch (error) {
                console.error("Error fetching units:", error);
            }
        };
        fetchUnits();
    }, []);

    const getConvertedQuantity = (ingredient) => {
        console.log('Current Ingredient:', ingredient);
        if (!units || !ingredient.unit) return { quantity: ingredient.quantity, unit: ingredient.unit };
        
        const originalUnit = units.find(u => u.abbreviation.toLowerCase() === ingredient.unit?.toLowerCase());
        if (!originalUnit) return { quantity: ingredient.quantity, unit: ingredient.unit};
    
        if (originalUnit.type === 'quantity') {
            return { quantity: ingredient.quantity, unit: ingredient.unit };
        }
    
        const targetAbbr = ingredient.form === 'liquid' ? liquidUnit : solidUnit;
        const targetUnit = units.find(u => u.abbreviation.toLowerCase() === targetAbbr.toLowerCase());
        
        if (!targetUnit || originalUnit.type !== targetUnit.type) {
            return { quantity: ingredient.quantity, unit: ingredient.unit };
        }
    
        // Convert through base units (g or mL)
        const baseQuantity = ingredient.quantity * originalUnit.conversion_factor;
        const convertedQuantity = baseQuantity / targetUnit.conversion_factor;
        
        return { 
            quantity: Number(convertedQuantity.toFixed(2)), 
            unit: targetUnit.abbreviation 
        };
    };
    
    const handleTimer = () => {
        if (!recipe) {
            console.error("Error: Recipe data is missing!");
            return;
        }
        navigate('/timer', { 
            state: { 
                steps: recipe.steps,
                recipeName: recipe.title
            } });
    };

    if (loading) return <p>Loading recipe...</p>;
    if (!recipe) return <p>Recipe not found.</p>;

    // Nutritional facts calculations
    const nutritionFacts = recipe.total_nutrition;

    const handleEdit = () => {
        if (!recipe) {
            console.error("Error: Recipe data is missing!");
            return;
        }
    
        const recipeWithId = { ...recipe, recipe_id: recipe.recipe_id || id };
    
        navigate(`/add-recipe`, { state: { recipe: recipeWithId } });
    };
    
    const handlePortionChange = (newPortions) => {
        const validatedPortions = Math.max(newPortions, basePortions);
        setCurrentPortions(validatedPortions);
    };
    
    const handleIncrement = () => handlePortionChange(currentPortions + 1);
    const handleDecrement = () => handlePortionChange(currentPortions - 1);
    
    const confirmPortionChange = () => setIsEditingPortions(false);
    const cancelPortionChange = () => {
        setCurrentPortions(basePortions);
        setIsEditingPortions(false);
    }; 
    
    return (
        <div className="recipe-details-page">

            {/* Recipe Image */}
            <div className="recipe-headerzz">
                <img 
                    className="recipe-imagezz" 
                    src={recipe.image_path ? `http://localhost:5010/uploads/${recipe.image_path.split('/').pop()}` : NoImageAvailable}
                    alt={recipe.title} 
                />
                <div className="recipe-title-container">
                    <h1 className="recipe-titlezz">{recipe.title}</h1>
                    <p className="recipe-subtitle">{recipe.meal_type} | {recipe.course_type}</p>
                    <button className="timer-btn" onClick={handleTimer}>Timer</button>
                    <button className="edit-recipe-btn" onClick={handleEdit}>Edit</button>
                </div>
            </div>

            {/* Recipe Information Sections */}
            <div className="recipe-info">
                {recipe.source && <p><strong>Source:</strong> {recipe.source}</p>}
                <p><strong>Cuisine Type:</strong> {recipe.cuisine_type}</p>
                <p><strong>Difficulty:</strong> {recipe.difficulty}</p>
                <p><strong>Preparation Time:</strong> {recipe.prep_time} mins</p>
                <p><strong>Cooking Time:</strong> {recipe.cook_time} mins</p>

                {/* Allergies Section */}
                {recipe.total_nutrition?.allergies?.length > 0 &&
                 recipe.total_nutrition.allergies.some(allergy => allergy !== "none") && (
                    <>
                        <h3>Allergies</h3>
                        <ul className="allergy-list">
                            {recipe.total_nutrition.allergies
                                .filter(allergy => allergy !== "none")
                                .map((allergy, index) => (
                                    <li key={index}>{allergy}</li>
                                ))}
                        </ul>
                    </>
                )}

                {/* Portion Control */}
                <div className="portion-control">
                    <div className="portion-header">
                    <strong>Portions:</strong>
                    {isEditingPortions ? (
                        <div className="portion-editor">
                            <button className="portion-btn" onClick={handleDecrement} disabled={currentPortions <= basePortions}>
                                -
                            </button>
                            <input
                                type="number"
                                value={currentPortions}
                                min={basePortions}
                                onChange={(e) => handlePortionChange(parseInt(e.target.value) || basePortions)}
                                className="portion-input"
                            />
                            <button className="portion-btn" onClick={handleIncrement}>
                                +
                            </button>
                            <button className="confirm-btn" onClick={confirmPortionChange}>OK</button>
                            <button className="cancel-btn" onClick={cancelPortionChange}>Cancel</button>
                        </div>
                    ) : (
                        <div className="portion-display">
                            <span className="portion-number">{currentPortions}</span>
                            <button className="edit-portion-btn" onClick={() => setIsEditingPortions(true)}>
                                Edit
                            </button>
                        </div>
                    )}
                </div></div>

                {/* Ingredients Section */}
                {console.log("Current Recipe Data:", recipe)} {/* 🛠️ Debugging Log */}

                <h3>Ingredients</h3>
                <ul className="ingredient-list">
                    {recipe.ingredients?.map((ingredient, index) => {
                        const scaledIngredient = {
                            ...ingredient,
                            quantity: ingredient.quantity * (currentPortions / basePortions)
                        };

                        const converted = getConvertedQuantity(scaledIngredient);
                        return (
                            <li key={index}>
                                {converted.quantity} {converted.unit} of {ingredient.ingredient_name}
                            </li>
                        );
                    })}
                </ul>

            {/* Unit Switches */}
            {(hasSolidIngredients || hasLiquidIngredients) && (
            <div className="unit-switches-container">
                {hasSolidIngredients && (
                <div className="unit-group">
                    <div className="unit-title">Solids</div>
                    <div className="unit-btns-container">
                        {['g', 'kg', 'oz', 'lb'].map((unit) => (
                            <button
                                key={unit}
                                onClick={() => setSolidUnit(unit)}
                                className={`unit-btn ${solidUnit === unit ? 'active' : ''}`}
                            >
                                {unit}
                            </button>
                        ))}
                    </div>
                </div>)}

                {hasLiquidIngredients && (
                <div className="unit-group">
                    <div className="unit-title">Liquids</div>
                    <div className="unit-btns-container">
                        {['ml', 'L', 'fl oz', 'pt'].map((unit) => (
                            <button
                                key={unit}
                                onClick={() => setLiquidUnit(unit)}
                                className={`unit-btn ${liquidUnit === unit ? 'active' : ''}`}
                            >
                                {unit}
                            </button>
                        ))}
                    </div>
                </div>
                )}
            </div>)}

                <h3>Steps</h3>
                <ol className="steps-list">
                    {recipe.steps ? ( 
                        recipe.steps.map((step, index) => <li key={index}>{step}</li>)
                    ) : (
                        <p>No steps available.</p> 
                    )}
                </ol>

                {/* Nutritional Facts Table */}
                <table className="nutrition-table">
                    <thead>
                        <tr>
                            <th>Nutrition Facts</th>
                            <th>Full Recipe</th>
                            <th>% Daily Value</th>
                            <th>Per Portion</th>
                            <th>% Daily Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Calories</td><td>{nutritionFacts.calories.toFixed(2)} kcal</td><td>{((nutritionFacts.calories / 2000) * 100).toFixed(2)}%</td><td>{(nutritionFacts.calories / currentPortions).toFixed(2)} kcal</td><td>{(((nutritionFacts.calories / currentPortions) / 2000) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Total Fat</td><td>{nutritionFacts.lipids.toFixed(2)} g</td><td>{((nutritionFacts.lipids / 70) * 100).toFixed(2)}%</td><td>{(nutritionFacts.lipids / currentPortions).toFixed(2)} g</td><td>{(((nutritionFacts.lipids / currentPortions) / 70) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Saturated Fat</td><td>{nutritionFacts.saturated_fat.toFixed(2)} g</td><td>{((nutritionFacts.saturated_fat / 20) * 100).toFixed(2)}%</td><td>{(nutritionFacts.saturated_fat / currentPortions).toFixed(2)} g</td><td>{(((nutritionFacts.saturated_fat / currentPortions) / 20) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Trans Fat</td><td>{nutritionFacts.trans_fat.toFixed(2)} g</td><td>-</td><td>{(nutritionFacts.trans_fat / currentPortions).toFixed(2)} g</td><td>-</td></tr>
                        <tr><td>Cholesterol</td><td>{nutritionFacts.cholesterol.toFixed(2)} mg</td><td>{((nutritionFacts.cholesterol / 300) * 100).toFixed(2)}%</td><td>{(nutritionFacts.cholesterol / currentPortions).toFixed(2)} mg</td><td>{(((nutritionFacts.cholesterol / currentPortions) / 300) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Sodium</td><td>{nutritionFacts.sodium.toFixed(2)} mg</td><td>{((nutritionFacts.sodium / 2300) * 100).toFixed(2)}%</td><td>{(nutritionFacts.sodium / currentPortions).toFixed(2)} mg</td><td>{(((nutritionFacts.sodium / currentPortions) / 2300) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Total Carbohydrates</td><td>{nutritionFacts.carbohydrates.toFixed(2)} g</td><td>{((nutritionFacts.carbohydrates / 275) * 100).toFixed(2)}%</td><td>{(nutritionFacts.carbohydrates / currentPortions).toFixed(2)} g</td><td>{(((nutritionFacts.carbohydrates / currentPortions) / 275) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Dietary Fibers</td><td>{nutritionFacts.fibers.toFixed(2)} g</td><td>{((nutritionFacts.fibers / 28) * 100).toFixed(2)}%</td><td>{(nutritionFacts.fibers / currentPortions).toFixed(2)} g</td><td>{(((nutritionFacts.fibers / currentPortions) / 28) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Total Sugars</td><td>{nutritionFacts.sugars.toFixed(2)} g</td><td>-</td><td>{(nutritionFacts.sugars / currentPortions).toFixed(2)} g</td><td>-</td></tr>
                        <tr><td>Added Sugars</td><td>{nutritionFacts.added_sugars.toFixed(2)} g</td><td>{((nutritionFacts.added_sugars / 50) * 100).toFixed(2)}%</td><td>{(nutritionFacts.added_sugars / currentPortions).toFixed(2)} g</td><td>{(((nutritionFacts.added_sugars / currentPortions) / 50) * 100).toFixed(2)}%</td></tr>
                        <tr><td>Protein</td><td>{nutritionFacts.protein.toFixed(2)} g</td><td>{((nutritionFacts.protein / 50) * 100).toFixed(2)}%</td><td>{(nutritionFacts.protein / currentPortions).toFixed(2)} g</td><td>{(((nutritionFacts.protein / currentPortions) / 50) * 100).toFixed(2)}%</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RecipeDetails;
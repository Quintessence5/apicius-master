import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/recipeDetailed.css';
import NoImageAvailable from '../assets/images/No_Image_Avail.jpg';

const RecipeDetails = () => {
    const { id } = useParams(); // Get recipe ID from URL params
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecipe = async () => {
            try {
                const response = await axios.get(`/api/recipes/${id}`);
                console.log("Fetched Recipe Data:", response.data);  // 🛠️ Debugging log
                setRecipe(response.data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching recipe:", error);
                setLoading(false);
            }
        };
        fetchRecipe();
    }, [id]);
    

    if (loading) return <p>Loading recipe...</p>;
    if (!recipe) return <p>Recipe not found.</p>;

    // Nutritional facts calculations
    const nutritionFacts = recipe.total_nutrition;
    const portions = recipe.portions || 1; // Prevent division by zero

    return (
        <div className="recipe-details-page">
            {/* Recipe Image */}
            <div className="recipe-header">
                <img 
                    className="recipe-image" 
                    src={recipe.image_path ? `http://localhost:5010/${recipe.image_path}` : NoImageAvailable} 
                    alt={recipe.title} 
                />
                <div className="recipe-title-container">
                    <h1 className="recipe-title">{recipe.title}</h1>
                    <p className="recipe-subtitle">{recipe.meal_type} | {recipe.course_type}</p>
                </div>
            </div>

            {/* Recipe Information Sections */}
            <div className="recipe-info">
                {recipe.source && <p><strong>Source:</strong> {recipe.source}</p>}
                <p><strong>Cuisine Type:</strong> {recipe.cuisine_type}</p>
                <p><strong>Difficulty:</strong> {recipe.difficulty}</p>
                <p><strong>Preparation Time:</strong> {recipe.prep_time} mins</p>
                <p><strong>Cooking Time:</strong> {recipe.cook_time} mins</p>
                <p><strong>Portions:</strong> {recipe.portions || 1}</p>

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

                {/* Ingredients Section */}
                {console.log("Current Recipe Data:", recipe)} {/* 🛠️ Debugging Log */}

<h3>Ingredients</h3>
<ul className="ingredient-list">
    {recipe.ingredients ? (  // 🛠️ Safe Check
        recipe.ingredients.map((ingredient, index) => (
            <li key={index}>
                {ingredient.quantity} {ingredient.unit} of {ingredient.ingredient_name}
            </li>
        ))
    ) : (
        <p>No ingredients available.</p>  // 🛠️ Debugging Message
    )}
</ul>

<h3>Steps</h3>
<ol className="steps-list">
    {recipe.steps ? (  // 🛠️ Safe Check
        recipe.steps.map((step, index) => <li key={index}>{step}</li>)
    ) : (
        <p>No steps available.</p>  // 🛠️ Debugging Message
    )}
</ol>

                {/* Nutritional Facts Table */}
                <h3>Nutritional Facts</h3>
                <table className="nutrition-table">
                    <thead>
                        <tr>
                            <th>Nutrient</th>
                            <th>Full Recipe</th>
                            <th>Per Portion</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Calories</td><td>{nutritionFacts.calories.toFixed(2)} kcal</td><td>{(nutritionFacts.calories / portions).toFixed(2)} kcal</td></tr>
                        <tr><td>Lipids</td><td>{nutritionFacts.lipids.toFixed(2)} g</td><td>{(nutritionFacts.lipids / portions).toFixed(2)} g</td></tr>
                        <tr><td>Saturated Fat</td><td>{nutritionFacts.saturated_fat.toFixed(2)} g</td><td>{(nutritionFacts.saturated_fat / portions).toFixed(2)} g</td></tr>
                        <tr><td>Trans Fat</td><td>{nutritionFacts.trans_fat.toFixed(2)} g</td><td>{(nutritionFacts.trans_fat / portions).toFixed(2)} g</td></tr>
                        <tr><td>Cholesterol</td><td>{nutritionFacts.cholesterol.toFixed(2)} mg</td><td>{(nutritionFacts.cholesterol / portions).toFixed(2)} mg</td></tr>
                        <tr><td>Sodium</td><td>{nutritionFacts.sodium.toFixed(2)} mg</td><td>{(nutritionFacts.sodium / portions).toFixed(2)} mg</td></tr>
                        <tr><td>Carbohydrates</td><td>{nutritionFacts.carbohydrates.toFixed(2)} g</td><td>{(nutritionFacts.carbohydrates / portions).toFixed(2)} g</td></tr>
                        <tr><td>Fibers</td><td>{nutritionFacts.fibers.toFixed(2)} g</td><td>{(nutritionFacts.fibers / portions).toFixed(2)} g</td></tr>
                        <tr><td>Sugars</td><td>{nutritionFacts.sugars.toFixed(2)} g</td><td>{(nutritionFacts.sugars / portions).toFixed(2)} g</td></tr>
                        <tr><td>Added Sugars</td><td>{nutritionFacts.added_sugars.toFixed(2)} g</td><td>{(nutritionFacts.added_sugars / portions).toFixed(2)} g</td></tr>
                        <tr><td>Protein</td><td>{nutritionFacts.protein.toFixed(2)} g</td><td>{(nutritionFacts.protein / portions).toFixed(2)} g</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RecipeDetails;
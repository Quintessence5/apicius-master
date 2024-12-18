import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/allRecipes.css';

const AllRecipes = () => {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecipes = async () => {
            try {
                const response = await axios.get('/api/recipes');
                setRecipes(response.data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching recipes:", error);
                setLoading(false);
            }
        };
        fetchRecipes();
    }, []);

    if (loading) return <p>Loading recipes...</p>;

    return (
        <div className="all-recipes-page">
            <h1 className="all-recipes-title">All Recipes</h1>
            {recipes.length === 0 ? (
                <p>No recipes available.</p>
            ) : (
                recipes.map((recipe) => (
                    <div key={recipe.id} className="recipe-card">     
                    <h2 className="recipe-title">{recipe.title}</h2>
                    <p className="recipe-description">{recipe.description}</p>
                    <div className="recipe-details">
                    <p><strong>Difficulty:</strong> {recipe.difficulty}</p>
                            <p><strong>Prep Time:</strong> {recipe.prep_time} mins</p>
                            <p><strong>Cook Time:</strong> {recipe.cook_time} mins</p>
                            <p><strong>Total Time:</strong> {recipe.total_time} mins</p>
                            <p><strong>Course Type:</strong> {recipe.course_type}</p>
                            <p><strong>Meal Type:</strong> {recipe.meal_type}</p>
                            <p><strong>Cuisine Type:</strong> {recipe.cuisine_type}</p>
                            {recipe.source && <p><strong>Source:</strong> {recipe.source}</p>}
                            <h3>Ingredients:</h3>
                            <ul>
                                {recipe.ingredients.map((ingredient, index) => (
                                    <li key={index}>
                                        {ingredient.quantity}{ingredient.unit} of {ingredient.ingredient_name}
                                    </li>
                                ))}
                            </ul>
                            </div>
                        </div>
                    ))
            )}
        </div>
    );
};

export default AllRecipes;

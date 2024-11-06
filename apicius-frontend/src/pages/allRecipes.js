// src/pages/AllRecipes.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';

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
        <div>
            <h1>All Recipes</h1>
            {recipes.length === 0 ? (
                <p>No recipes available.</p>
            ) : (
                recipes.map(recipe => (
                    <div key={recipe.id} style={{ border: "1px solid #ddd", padding: "10px", margin: "10px 0" }}>
                        <h2>{recipe.title}</h2>
                        <p>{recipe.description}</p>
                        <p><strong>Prep Time:</strong> {recipe.prep_time} mins</p>
                        <p><strong>Cook Time:</strong> {recipe.cook_time} mins</p>
                        <p><strong>Total Time:</strong> {recipe.total_time} mins</p>
                        <h3>Ingredients:</h3>
                        <ul>
                            {recipe.ingredients.map((ingredient, index) => (
                                <li key={index}>
                                    {ingredient.ingredient_name} - {ingredient.quantity} {ingredient.unit}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </div>
    );
};

export default AllRecipes;

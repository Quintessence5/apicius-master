import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/allRecipes.css';
import NoImageAvailable from '../assets/images/No_Image_Avail.jpg';

const AllRecipes = () => {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [mealType, setMealType] = useState('');
    const [cuisineType, setCuisineType] = useState('');
    const [dietaryRestriction, setDietaryRestriction] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [dropdownOptions, setDropdownOptions] = useState({
        mealTypes: [],
        cuisineTypes: [],
        courseTypes: [],
        dietaryRestrictions: [],
    });
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDropdownOptions = async () => {
            try {
                const response = await axios.get('/api/recipes/options');
                setDropdownOptions(response.data);
            } catch (error) {
                console.error("Error fetching dropdown options:", error);
            }
        };
        fetchDropdownOptions();
    }, []);

    const fetchRecipes = useCallback(async () => {
        try {
            const response = await axios.get('/api/recipes', {
                params: {
                    search,
                    meal_type: mealType,
                    cuisine_type: cuisineType,
                    dietary_restriction: dietaryRestriction,
                },
            });
            setRecipes(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching recipes:", error);
            setLoading(false);
        }
    }, [search, mealType, cuisineType, dietaryRestriction]);

    useEffect(() => {
        console.log("Fetching recipes..."); // Debugging log
        fetchRecipes();
    }, [fetchRecipes]);

    if (loading) return <p>Loading recipes...</p>;

    return (
        <div className="all-recipes-page">
            <h1 className="all-recipes-title">All Recipes</h1>

            <button className="search-toggle-button" onClick={() => setShowSearch(!showSearch)}>
                🔎
            </button>

            {showSearch && (
                <div className="search-filter-section">
                    <input
                        type="text"
                        placeholder="Search by name or ingredient"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    {/* Meal Type Dropdown */}
                    <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
                        <option value="">All Meal Types</option>
                        {dropdownOptions.mealTypes.map((type, index) => (
                            <option key={index} value={type.name}>{type.name}</option>
                        ))}
                    </select>

                    {/* Cuisine Type Dropdown */}
                    <select value={cuisineType} onChange={(e) => setCuisineType(e.target.value)}>
                        <option value="">All Cuisine Types</option>
                        {dropdownOptions.cuisineTypes.map((type, index) => (
                            <option key={index} value={type.name}>{type.name}</option>
                        ))}
                    </select>

                    {/* Dietary Restriction Dropdown */}
                    <select value={dietaryRestriction} onChange={(e) => setDietaryRestriction(e.target.value)}>
                        <option value="">All Dietary Restrictions</option>
                        {dropdownOptions.dietaryRestrictions.map((restriction, index) => (
                            <option key={index} value={restriction.name}>{restriction.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {recipes && recipes.length === 0 ? (
                <p>No recipes available.</p>
            ) : (
                recipes.map((recipe) => (
                    <div key={recipe.recipe_id} className="recipe-card" onClick={() => navigate(`/recipe/${recipe.recipe_id}`)}>
                        <div className="recipe-title">{recipe.title}</div>
                        <div className="recipe-content">
                            <div className="recipe-left-column">
                                <div className="recipe-image">
                                    <img
                                        src={recipe.image_path ? `http://localhost:5010/uploads/${recipe.image_path.split('/').pop()}` : NoImageAvailable}
                                        alt={recipe.title || "No Image Available"}
                                    />
                                </div>
                                <div className="recipe-nutritionz">
                                    <h3>Nutrition Values</h3>
                                    <ul>
                                        <li>Calories - {(recipe.total_nutrition?.calories || 0).toFixed(2)} kcal</li>
                                        <li>Protein - {(recipe.total_nutrition?.protein || 0).toFixed(2)} g</li>
                                        <li>Lipids - {(recipe.total_nutrition?.lipids || 0).toFixed(2)} g</li>
                                        <li>Carbohydrates - {(recipe.total_nutrition?.carbohydrates || 0).toFixed(2)} g</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="recipe-right-column">
                                <p><strong>Difficulty - </strong> {recipe.difficulty}</p>
                                {recipe.course_type && <p><strong>Course Type - </strong> {recipe.course_type}</p>}
                                {recipe.meal_type && <p><strong>Meal Type -</strong> {recipe.meal_type}</p>}
                                {recipe.cuisine_type && <p><strong>Cuisine Type -</strong> {recipe.cuisine_type}</p>}
                                <p><strong>Total Time -</strong> {recipe.total_time} mins</p>
                                {recipe.source && <p><strong>Source -</strong> {recipe.source}</p>}

                                <h3>Ingredients</h3>
                                <ul>
                                    {recipe.ingredients.map((ingredient, index) => (
                                        <li key={index}>
                                            {ingredient.quantity}{ingredient.unit} of {ingredient.ingredient_name}
                                        </li>
                                    ))}
                                </ul>

                                {recipe.total_nutrition?.allergies?.length > 0 &&
                                    recipe.total_nutrition.allergies.some((allergy) => allergy !== "none") && (
                                        <>
                                            <h4>Allergies</h4>
                                            <ul>
                                                {recipe.total_nutrition.allergies
                                                    .filter((allergy) => allergy !== "none")
                                                    .map((allergy, index) => (
                                                        <li key={index}>{allergy}</li>
                                                    ))}
                                            </ul>
                                        </>
                                    )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default AllRecipes;
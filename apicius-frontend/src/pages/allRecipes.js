import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

import '../styles/allRecipes.css';
import NoImageAvailable from '../assets/images/No_Image_Avail.jpg';

const AllRecipes = () => {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [mealType, setMealType] = useState('');
    const [cuisineType, setCuisineType] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [dietaryRestriction] = useState('');
    const [dropdownOptions, setDropdownOptions] = useState({
        mealTypes: [],
        cuisineTypes: [],
        courseTypes: []});
        const [selectedDiets, setSelectedDiets] = useState([]);
        const [selectedRestrictions, setSelectedRestrictions] = useState([]);
        const [selectedAllergies, setSelectedAllergies] = useState([]);
        const [courseType, setCourseType] = useState('');
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
                    course_type: courseType || null,
                    dietary_restriction: dietaryRestriction,
                    diets: selectedDiets.join(','),
                    restrictions: selectedRestrictions.join(','),
                    allergies: selectedAllergies.join(',')
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
            <div className="title-search-container">
  <h1 className="all-recipes-title">All Recipes</h1>
  <button className="search-toggle-button" onClick={() => setShowSearch(!showSearch)}>
    🔎 - Find your next recipe
  </button>
</div>

            {showSearch && (
                <div className="search-filter-section">
                    <div className="single-select-container">
                    <input
                        type="text"
                        placeholder="Search by name or ingredient"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                      {/* Course Type Dropdown */}
                    <select value={courseType} onChange={(e) => setCourseType(e.target.value)}>
                    <option value="">All Course Types</option>
                    {dropdownOptions.courseTypes.map((type, index) => (
                    <option key={index} value={type.name}>{type.name}</option>))}
                    </select>

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
                </div>

                    {/* Dietary Restriction Dropdown */}
                    <div className="multi-select-container">
                      
                    <MultiSelectDropdown 
                        options={dropdownOptions.dietaryRestrictions.filter(d => d.category === 'Allergy')}
                        selected={selectedAllergies}
                        setSelected={setSelectedAllergies}
                        placeholder="Select Allergies"
                      />
                      <MultiSelectDropdown 
                        options={dropdownOptions.dietaryRestrictions.filter(d => d.category === 'Restriction')}
                        selected={selectedRestrictions}
                        setSelected={setSelectedRestrictions}
                        placeholder="Select Food Restrictions"
                      />
                      <MultiSelectDropdown 
                        options={dropdownOptions.dietaryRestrictions.filter(d => d.category === 'Diet')}
                        selected={selectedDiets}
                        setSelected={setSelectedDiets}
                        placeholder="Select Diets"
                      />
                    </div>
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
                                <p><strong>Total Time -</strong> {recipe.total_time} mn</p>
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
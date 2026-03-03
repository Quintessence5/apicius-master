import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import axios from 'axios';
import '../styles/recipeDetailed.css';
import StarRating from '../components/starRating';
import CommentSection from '../components/CommentSection';
import NoImageAvailable from '../assets/images/No_Image_Avail.jpg';
import { getSourceInfo } from '../utils/sourceUtils';

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
    const [hasSolidIngredients, setHasSolidIngredients] = useState(false);
    const [hasLiquidIngredients, setHasLiquidIngredients] = useState(false);
    const [user] = useState({ id: localStorage.getItem('userId'), role: localStorage.getItem('userRole') });

const [activeTab, setActiveTab] = useState('recipe');
    const [activePopup, setActivePopup] = useState(null);
    const [multiplier, setMultiplier] = useState(1);

// Update currentPortions when multiplier changes
useEffect(() => {
    if (recipe) {
        setCurrentPortions(basePortions * multiplier);
    }
}, [multiplier, basePortions, recipe]);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.ingredient-popup') && !event.target.closest('.info-icon')) {
                setActivePopup(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const togglePopup = (section, index) => {
        if (activePopup && activePopup.section === section && activePopup.index === index) {
            setActivePopup(null);
        } else {
            setActivePopup({ section, index });
        }
    };

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
        // Check ingredient types (case-insensitive)
        let hasSolid = false;
        let hasLiquid = false;
        recipe.ingredients?.forEach(ingredient => {
            if (ingredient.form && ingredient.form.toLowerCase() === 'solid') hasSolid = true;
            if (ingredient.form && ingredient.form.toLowerCase() === 'liquid') hasLiquid = true;
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

    const handleAddToCart = async () => {
        try {
          await apiClient.post('/cart/add', { recipeId: id });
          alert('Recipe added to cart successfully!');
          // Optional: You could add a more sophisticated notification here
        } catch (error) {
          console.error('Add to cart error:', error);
          if (error.response?.status === 401) {
            navigate('/login');
          } else {
            alert('Failed to add recipe to cart. Please try again.');
          }
        }
      };

    const getConvertedQuantity = (ingredient) => {
    if (!units || units.length === 0) return { quantity: ingredient.quantity, unit: ingredient.unit };
    if (!ingredient.unit) return { quantity: ingredient.quantity, unit: ingredient.unit };

    const originalUnit = units.find(u => u.abbreviation.toLowerCase() === ingredient.unit.toLowerCase());
    if (!originalUnit) return { quantity: ingredient.quantity, unit: ingredient.unit };

    if (originalUnit.type === 'quantity') {
        return { quantity: ingredient.quantity, unit: ingredient.unit };
    }

    const targetAbbr = ingredient.form && ingredient.form.toLowerCase() === 'liquid' ? liquidUnit : solidUnit;
    const targetUnit = units.find(u => u.abbreviation.toLowerCase() === targetAbbr.toLowerCase());
    if (!targetUnit || originalUnit.type !== targetUnit.type) {
        return { quantity: ingredient.quantity, unit: ingredient.unit };
    }

    const baseQuantity = ingredient.quantity * originalUnit.conversion_factor;
    const convertedQuantity = baseQuantity / targetUnit.conversion_factor;
    return { quantity: Number(convertedQuantity.toFixed(2)), unit: targetUnit.abbreviation };
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
        } 
    });
};

    if (loading) return <p>Loading recipe...</p>;
    if (!recipe) return <p>Recipe not found.</p>;

    // Nutritional facts calculations
    const nutritionFacts = recipe.total_nutrition;

    const handleEdit = () => {
    if (!recipe) return;
    navigate('/recipe-review/edit', {
        state: {
            recipe: recipe,
            recipeId: id,
            videoTitle: recipe.title,
            videoThumbnail: recipe.thumbnail_url || recipe.image_path
        }
    });
};
    
    
    const handleReport = async (originalName, recipeId, ingredientId) => {
    try {
        await axios.post('/api/ingredients/report', {
            originalName,
            recipeId,
            ingredientId,
            note: 'User reported mismatched ingredient'
        });
        alert('Ingredient reported for review. Thank you!');
    } catch (error) {
        console.error('Report failed:', error);
        alert('Failed to report ingredient. Please try again.');
    }
};
    
    return (
        <div className="recipe-details-page">

           {/* Recipe Image */}
<div className="recipe-headerzz">
    <img 
        className="recipe-imagezz" 
        src={
            recipe.thumbnail_url && recipe.thumbnail_url.trim() !== ''
                ? recipe.thumbnail_url.startsWith('http')
                    ? recipe.thumbnail_url
                    : `http://localhost:5010/uploads/${recipe.thumbnail_url.split('/').pop()}`
                : recipe.image_path && recipe.image_path.trim() !== ''
                    ? recipe.image_path.startsWith('http')
                        ? recipe.image_path
                        : `http://localhost:5010/uploads/${recipe.image_path.split('/').pop()}`
                    : NoImageAvailable
        }
        onError={(e) => e.target.src = NoImageAvailable}
        alt={recipe.title} 
    />
    <div className="recipe-title-container">
        <h1 className="recipe-titlezz">{recipe.title}</h1>
        <div className="subtitle-row">
            <p className="recipe-subtitle">{recipe.meal_type} | {recipe.course_type}</p>
            <div className="recipe-actions">
                <button className="timer-btn" onClick={handleTimer}>Timer</button>
                <button className="edit-recipe-btn" onClick={handleEdit}>Edit</button>
                <button className="add-to-cart-btn" onClick={handleAddToCart}>Add to Cart</button>
            </div>
        </div>
    </div>
</div>
<div className="star-rating-container">
             <StarRating recipeId={id} /></div>

            {/* Metadata Line 1 – centered tags */}
<div className="metadata-line">
    {recipe.source && (() => {
        const sourceInfo = getSourceInfo(recipe.source);
        return (
            <a 
                href={sourceInfo?.url || recipe.source} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="metadata-tag source-tag" 
                style={{ color: sourceInfo?.color }}
            >
                <span className="source-icon">{sourceInfo?.icon || '🌐'}</span>
                <span className="tag-label">Source</span>
                <span className="tag-value">{sourceInfo?.name || 'Website'}</span>
            </a>
        );
    })()}
    
    {recipe.cuisine_type && (
        <div className="metadata-tag">
            <span className="tag-label">Cuisine</span>
            <span className="tag-value">{recipe.cuisine_type}</span>
        </div>
    )}
    
    {recipe.difficulty && (
        <div className="metadata-tag">
            <span className="tag-label">Difficulty</span>
            <span className="tag-value">{recipe.difficulty}</span>
        </div>
    )}
    
    {recipe.prep_time && (
        <div className="metadata-tag">
            <span className="tag-label">Prep 🕘</span>
            <span className="tag-value">{recipe.prep_time} min</span>
        </div>
    )}
    
    {recipe.cook_time && (
        <div className="metadata-tag">
            <span className="tag-label">Cook </span>
            <span className="tag-value">{recipe.cook_time} min</span>
        </div>
    )}
</div>

{/* Allergies Line 2 – left aligned */}
{recipe.total_nutrition?.allergies?.length > 0 && 
    recipe.total_nutrition.allergies.some(allergy => allergy !== "none") && (
    <div className="allergies-line">
        <span className="allergies-label">Allergies:</span>
        <div className="allergy-tags">
            {recipe.total_nutrition.allergies
                .filter(allergy => allergy !== "none")
                .map((allergy, index) => (
                    <span key={index} className="allergy-tag">{allergy}</span>
                ))}
        </div>
    </div>
)}

{/* Portions & Unit Switches */}
{/* Tab Navigation */}
<div className="tab-navigation">
    <button
        className={`tab-btn ${activeTab === 'recipe' ? 'active' : ''}`}
        onClick={() => setActiveTab('recipe')}
    >
        Recipe
    </button>
    <button
        className={`tab-btn ${activeTab === 'nutrition' ? 'active' : ''}`}
        onClick={() => setActiveTab('nutrition')}
    >
        Nutrition Table
    </button>
    <button
        className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
        onClick={() => setActiveTab('comments')}
    >
        Comments
    </button>
</div>

{/* Tab Content */}
<div className="tab-content">
    {activeTab === 'recipe' && (
        <div className="recipe-tab">
            {/* Portions & Unit Switches */}
            <div className="portions-unit-line">
                <div className="portions-left">
                    <div className="portion-control">
                        <span className="portion-label">Portions:</span>
                        <span className="portion-value">{currentPortions}</span>
                        <div className="multiplier-container">
                            <button className={`multiplier-btn ${multiplier === 0.5 ? 'active' : ''}`} onClick={() => setMultiplier(0.5)}>0.5×</button>
                            <button className={`multiplier-btn ${multiplier === 1 ? 'active' : ''}`} onClick={() => setMultiplier(1)}>1×</button>
                            <button className={`multiplier-btn ${multiplier === 2 ? 'active' : ''}`} onClick={() => setMultiplier(2)}>2×</button>
                            <button className={`multiplier-btn ${multiplier === 4 ? 'active' : ''}`} onClick={() => setMultiplier(4)}>4×</button>
                        </div>
                    </div>
                </div>
                <div className="unit-switches-centered">
                    {(hasSolidIngredients || hasLiquidIngredients) && (
                        <div className="unit-switches-container">
                            {hasSolidIngredients && (
                                <div className="unit-group">
                                    <span className="unit-title">Solids</span>
                                    <div className="unit-btns-container">
                                        {['g', 'kg', 'oz', 'lb'].map(unit => (
                                            <button key={unit} onClick={() => setSolidUnit(unit)} className={`unit-btn ${solidUnit === unit ? 'active' : ''}`}>{unit}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {hasLiquidIngredients && (
                                <div className="unit-group">
                                    <span className="unit-title">Liquids</span>
                                    <div className="unit-btns-container">
                                        {['ml', 'L', 'fl oz', 'pt'].map(unit => (
                                            <button key={unit} onClick={() => setLiquidUnit(unit)} className={`unit-btn ${liquidUnit === unit ? 'active' : ''}`}>{unit}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <h3>Ingredients</h3>
{(() => {
    console.log('recipe.ingredients:', recipe.ingredients);
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
        console.warn('No ingredients array found');
        return <p>No ingredients listed.</p>;
    }

    const sections = {};
    recipe.ingredients.forEach(ing => {
        const section = ing.section || 'Main';
        if (!sections[section]) sections[section] = [];
        sections[section].push(ing);
    });
    console.log('sections:', sections);

    if (Object.keys(sections).length === 0) {
        return <p>No ingredients found.</p>;
    }

    return Object.entries(sections).map(([sectionName, ingredients]) => (
        <div key={sectionName} className="ingredients-section">
            {sectionName !== 'Main' && <h4 className="section-title">{sectionName}</h4>}
            <ul className="ingredient-list">
                {ingredients.map((ingredient, index) => {
    const scaledIngredient = {
        ...ingredient,
        quantity: ingredient.quantity * (currentPortions / basePortions)
    };
    const converted = getConvertedQuantity(scaledIngredient);
    const isMatched = !!ingredient.ingredient_id;
    const hasOriginal = ingredient.original_name && ingredient.original_name !== ingredient.ingredient_name;
    const isPopupOpen = activePopup?.section === sectionName && activePopup?.index === index;

    return (
        <li key={index} className="ingredient-item">
            <span className="ingredient-text">
                {converted.quantity} {converted.unit} of {ingredient.ingredient_name}
                {hasOriginal && (
                    <span
                        className="info-icon"
                        onClick={() => togglePopup(sectionName, index)}
                    >
                        ⓘ
                    </span>
                )}
            </span>
            {!isMatched && (
                <button
                    className="report-btn"
                    onClick={() => handleReport(ingredient.original_name, id, ingredient.ingredient_id)}
                >
                    Report
                </button>
            )}

            {/* Custom popup for original name */}
            {isPopupOpen && (
    <div className="ingredient-popup">
        <div className="popup-content">
            <span className="popup-label">Extracted name:</span>
            <span className="popup-original">{ingredient.original_name}</span>
        </div>
        <button
            className="popup-report-btn"
            onClick={() => {
                handleReport(ingredient.original_name, id, ingredient.ingredient_id);
                setActivePopup(null);
            }}
        >
            Report
        </button>
    </div>
)}
        </li>
    );
})}
            </ul>
        </div>
    ));
})()}

                <h3>Instructions</h3>
{(() => {
    // Group steps by section if available
    const isStructured = Array.isArray(recipe.steps) && 
                         recipe.steps.length > 0 && 
                         typeof recipe.steps[0] === 'object';
    
    if (isStructured) {
        const sections = {};
        recipe.steps.forEach(step => {
            const section = step.section || 'Main';
            if (!sections[section]) sections[section] = [];
            sections[section].push(step);
        });
        
        return Object.entries(sections).map(([sectionName, steps]) => (
            <div key={sectionName} className="steps-section">
                {sectionName !== 'Main' && (
                    <h4 className="section-title">{sectionName}</h4>
                )}
                <ol className="steps-list">
                    {steps.map((step, idx) => (
                        <li key={idx}>
                            {step.instruction || step}
                            {step.duration_minutes && (
                                <span className="step-duration"> (~{step.duration_minutes} min)</span>
                            )}
                        </li>
                    ))}
                </ol>
            </div>
        ));
    } else {
        // Fallback for unstructured steps
        return (
            <ol className="steps-list">
                {recipe.steps?.map((step, idx) => (
                    <li key={idx}>{typeof step === 'object' ? step.instruction : step}</li>
                ))}
            </ol>
        );
    }
})()}
</div>
    )}

    {activeTab === 'nutrition' && (
        <div className="nutrition-tab">
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
    )}

    {activeTab === 'comments' && (
        <div className="comments-tab">
            <CommentSection recipeId={id} userId={user.id} userRole={user.role} />
        </div>
    )}
</div> </div>
    );
};

export default RecipeDetails;
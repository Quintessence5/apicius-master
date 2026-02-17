import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/videoRecipeReview.css';

const VideoRecipeReview = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { recipe, ingredientMatches, conversionId, videoTitle, videoThumbnail } = location.state || {};
    
    const [editedRecipe, setEditedRecipe] = useState(recipe || {});
    const [ingredients, setIngredients] = useState([]);
    const [availableUnits, setAvailableUnits] = useState([]);
    const [availableIngredients, setAvailableIngredients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchingIndex, setSearchingIndex] = useState(null);
    const [searchResults, setSearchResults] = useState({});

    const courseTypes = ['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage'];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const difficulty = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

    // Fetch units and ingredients on mount
    useEffect(() => {
    const fetchData = async () => {
        try {
            console.log("📋 Fetching units...");
            
            // Fetch units
            try {
                const unitsResponse = await axios.get('/api/units');
                console.log(`✅ Units loaded: ${unitsResponse.data.length} units`);
                const normalizedUnits = unitsResponse.data.map((unit) => ({
                    ...unit,
                    type: (unit.type || 'unknown').toLowerCase(),
                }));
                setAvailableUnits(normalizedUnits);
            } catch (unitError) {
                console.error('❌ Error loading units:', unitError.message);
                console.warn('⚠️ Units endpoint not available, using empty array');
                setAvailableUnits([]);
                // Don't fail - continue with ingredients
            }

            // Fetch all ingredients for search
            try {
                console.log("📋 Fetching ingredients...");
                const ingredientsResponse = await axios.get('/api/ingredients');
                console.log(`✅ Ingredients loaded: ${ingredientsResponse.data.length} ingredients`);
                setAvailableIngredients(ingredientsResponse.data);
            } catch (ingredientError) {
                console.error('❌ Error loading ingredients:', ingredientError.message);
                setError('⚠️ Could not load ingredients from database');
            }
        } catch (err) {
            console.error('❌ Unexpected error fetching data:', err);
        }
    };

    fetchData();
}, []);

    // Initialize ingredients from recipe
    useEffect(() => {
        if (editedRecipe.ingredients && availableUnits.length > 0) {
            console.log("🔧 Initializing ingredients...");
            setIngredients(
                editedRecipe.ingredients.map((ing) => {
                    const match = ingredientMatches?.all?.find(m => m.name === ing.name);
                    return {
                        name: ing.name,
                        quantity: ing.quantity,
                        unit: ing.unit,
                        section: ing.section,
                        ingredientId: match?.dbId || null,
                        ingredientName: match?.dbName || ing.name,
                        locked: false,
                        dbMatch: match
                    };
                })
            );
        }
    }, [editedRecipe.ingredients, availableUnits, ingredientMatches]);

    if (!recipe) {
        return (
            <div className="recipe-review-container">
                <p>❌ No recipe data found. Please extract a recipe first.</p>
                <button onClick={() => navigate('/video-to-recipe')}>← Back</button>
            </div>
        );
    }

    // __________-------------Simple Ingredient Search (Alternative to AsyncSelect)-------------__________
    const handleIngredientSearch = async (index, searchValue) => {
    console.log(`🔍 Searching index ${index} for: "${searchValue}"`);
    
    // Update the ingredient name in state while searching
    const updatedIngredients = [...ingredients];
    updatedIngredients[index].ingredientName = searchValue;
    setIngredients(updatedIngredients);

    if (!searchValue || searchValue.length < 1) {
        setSearchResults(prev => ({ ...prev, [index]: [] }));
        return;
    }

    try {
        console.log(`📡 Fetching suggestions for: "${searchValue}"`);
        const response = await axios.get(
            `/api/ingredients/suggestions?search=${searchValue.trim()}`
        );
        console.log(`✅ Found ${response.data.length} results`);
        setSearchResults(prev => ({
            ...prev,
            [index]: response.data
        }));
    } catch (error) {
        console.error('❌ Error searching ingredients:', error);
        setSearchResults(prev => ({ ...prev, [index]: [] }));
    }
};

const selectIngredient = (index, ingredient) => {
    console.log(`✅ Selected: ${ingredient.name} (ID: ${ingredient.id})`);
    const updatedIngredients = [...ingredients];
    updatedIngredients[index] = {
        ...updatedIngredients[index],
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,  // This is the display name
        form: ingredient.form || 'unknown',
        dbMatch: {
            name: ingredient.name,
            found: true,
            dbId: ingredient.id,
            dbName: ingredient.name,
            icon: '✅'
        }
    };
    setIngredients(updatedIngredients);
    setSearchResults(prev => ({ ...prev, [index]: [] }));
    setSearchingIndex(null);
    console.log("✅ Ingredient selection complete");
};

    const handleQuantityChange = (index, value) => {
        const updatedIngredients = [...ingredients];
        updatedIngredients[index].quantity = value;
        setIngredients(updatedIngredients);
    };

    const handleUnitChange = (index, value) => {
        const updatedIngredients = [...ingredients];
        updatedIngredients[index].unit = value;
        setIngredients(updatedIngredients);
        console.log(`✅ Unit changed to: ${value}`);
    };

    const handleRecipeChange = (field, value) => {
        setEditedRecipe(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleStepChange = (index, value) => {
        const updatedSteps = [...editedRecipe.steps];
        updatedSteps[index] = value;
        setEditedRecipe(prev => ({
            ...prev,
            steps: updatedSteps
        }));
    };

    const handleDeleteStep = (index) => {
        setEditedRecipe(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index)
        }));
    };

    const handleAddStep = () => {
        setEditedRecipe(prev => ({
            ...prev,
            steps: [...prev.steps, '']
        }));
    };

    const getFilteredUnits = (form) => {
    if (!availableUnits || availableUnits.length === 0) {
        console.warn('⚠️ No units available');
        return [];
    }

    if (!form || form === 'unknown') {
        console.log('ℹ️ No form specified, returning all units');
        return availableUnits;
    }

    const normalizedForm = form.toLowerCase();
    
    if (normalizedForm === 'solid') {
        return availableUnits.filter((unit) => {
            const unitType = (unit.type || '').toLowerCase();
            return unitType === 'weight' || unitType === 'quantity';
        });
    }

    if (normalizedForm === 'liquid') {
        return availableUnits.filter((unit) => {
            const unitType = (unit.type || '').toLowerCase();
            return unitType === 'volume';
        });
    }

    console.warn(`⚠️ Unknown form type: ${form}, returning all units`);
    return availableUnits;
};

    // __________-------------Save Recipe to Database-------------__________
    const handleSaveRecipe = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // Validate that all ingredients have selections
            const unselectedIngredients = ingredients.filter(ing => !ing.ingredientId);
            if (unselectedIngredients.length > 0) {
                setError(`⚠️ Please select ingredients for: ${unselectedIngredients.map(i => i.name).join(', ')}`);
                setLoading(false);
                return;
            }

            // Prepare final ingredients with database IDs
            const finalIngredients = ingredients.map(ing => ({
                name: ing.ingredientName,
                quantity: ing.quantity,
                unit: ing.unit,
                section: ing.section,
                ingredientId: ing.ingredientId
            }));

            // Update recipe with final ingredients
            const finalRecipe = {
                ...editedRecipe,
                ingredients: finalIngredients
            };

            console.log("💾 Saving recipe...");
            const response = await axios.post('/api/transcripts/save-recipe', {
                generatedRecipe: finalRecipe,
                conversionId,
                userId: null
            });

            if (response.data.success) {
                setSuccess(`✅ Recipe "${editedRecipe.title}" saved successfully!`);
                console.log("✅ Recipe saved with ID:", response.data.recipeId);
                setTimeout(() => {
                    navigate('/all-recipes');
                }, 2000);
            }
        } catch (err) {
            console.error('Save error:', err);
            setError(err.response?.data?.message || 'Failed to save recipe');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="recipe-review-container">
            <h1>🍳 Review & Edit Recipe</h1>
            <p className="source-info">From: <strong>{videoTitle}</strong></p>

            {error && <div className="error-message">❌ {error}</div>}
            {success && <div className="success-message">✅ {success}</div>}

            <div className="recipe-review-content">
                
                {/* Thumbnail & Meta */}
                <section className="section thumbnail-section">
                    {videoThumbnail && (
                        <img src={videoThumbnail} alt="Video Thumbnail" className="video-thumbnail" />
                    )}
                    <div className="recipe-meta-info">
                        <h3>Recipe Details</h3>
                        <div className="meta-grid">
                            <div className="meta-item">
                                <label>Servings</label>
                                <input
                                    type="number"
                                    value={editedRecipe.servings || ''}
                                    onChange={(e) => handleRecipeChange('servings', parseInt(e.target.value) || null)}
                                    placeholder="e.g., 4"
                                />
                            </div>
                            <div className="meta-item">
                                <label>Prep Time (min)</label>
                                <input
                                    type="number"
                                    value={editedRecipe.prep_time || ''}
                                    onChange={(e) => handleRecipeChange('prep_time', parseInt(e.target.value) || null)}
                                    placeholder="e.g., 20"
                                />
                            </div>
                            <div className="meta-item">
                                <label>Cook Time (min)</label>
                                <input
                                    type="number"
                                    value={editedRecipe.cook_time || ''}
                                    onChange={(e) => handleRecipeChange('cook_time', parseInt(e.target.value) || null)}
                                    placeholder="e.g., 30"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Title & Description */}
                <section className="section">
                    <h2>Title & Description</h2>
                    <div className="form-group">
                        <label>Title *</label>
                        <input
                            type="text"
                            value={editedRecipe.title || ''}
                            onChange={(e) => handleRecipeChange('title', e.target.value)}
                            className="input-large"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={editedRecipe.description || ''}
                            onChange={(e) => handleRecipeChange('description', e.target.value)}
                            rows="3"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Difficulty *</label>
                            <select 
                                value={editedRecipe.difficulty || ''} 
                                onChange={(e) => handleRecipeChange('difficulty', e.target.value)}
                                required
                            >
                                <option value="">Select...</option>
                                {difficulty.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Course Type *</label>
                            <select 
                                value={editedRecipe.course_type || ''} 
                                onChange={(e) => handleRecipeChange('course_type', e.target.value)}
                                required
                            >
                                <option value="">Select...</option>
                                {courseTypes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Meal Type *</label>
                            <select 
                                value={editedRecipe.meal_type || ''} 
                                onChange={(e) => handleRecipeChange('meal_type', e.target.value)}
                                required
                            >
                                <option value="">Select...</option>
                                {mealTypes.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Ingredients with Smart Matching (No AsyncSelect - Simple Alternative) */}
                <section className="section">
                    <h2>Ingredients ({ingredients.length})</h2>
                    <div className="ingredients-section">
                        {ingredients.map((ing, idx) => {
                            const match = ing.dbMatch;
                            const results = searchResults[idx] || [];
                            const filteredUnits = getFilteredUnits(ing.form);

                            return (
                                <div key={idx} className={`ingredient-item ${match?.found ? 'matched' : 'unmatched'}`}>
                                    <div className="ingredient-icon">{match?.icon || '⚠️'}</div>
                                    
                                    {/* Ingredient Selector - Simple Search Version */}
                                    <div className="ingredient-selector">
    <label>Ingredient</label>
    <div className="ingredient-search-wrapper">
        <input
            type="text"
            placeholder="Search ingredient..."
            value={ing.ingredientName || ''}  // Use ingredientName, not name
            onChange={(e) => handleIngredientSearch(idx, e.target.value)}
            onFocus={() => setSearchingIndex(idx)}
            className="ingredient-search-input"
            autoComplete="off"
        />
        
        {/* Search Results Dropdown */}
        {searchingIndex === idx && results.length > 0 && (
            <div className="search-results-dropdown">
                {results.map((result) => (
                    <button
                        key={result.id}
                        className="search-result-item"
                        onClick={(e) => {
                            e.preventDefault();
                            selectIngredient(idx, result);
                        }}
                        type="button"
                    >
                        <span className="result-name">{result.name}</span>
                        {result.form && (
                            <span className="result-form">({result.form})</span>
                        )}
                    </button>
                ))}
            </div>
        )}

                                            {/* Show selected ingredient */}
                                             {ing.ingredientId ? (
            <div className="selected-ingredient">
                <span>✅ {ing.ingredientName}</span>
                <button
                    className="clear-selection"
                    onClick={() => {
                        const updatedIngredients = [...ingredients];
                        updatedIngredients[idx] = {
                            ...updatedIngredients[idx],
                            ingredientId: null,
                            ingredientName: ing.name,  // Reset to original recipe name
                            dbMatch: null
                        };
                        setIngredients(updatedIngredients);
                        setSearchResults(prev => ({ ...prev, [idx]: [] }));
                    }}
                    type="button"
                >
                    ✕ Change
                </button>
            </div>
        ) : null}
    </div>
</div>

                                    {/* Quantity */}
                                    <div className="ingredient-quantity">
                                        <label>Qty</label>
                                        <input
                                            type="text"
                                            value={ing.quantity || ''}
                                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                            placeholder="e.g., 1, 1/2, 2-3"
                                        />
                                    </div>

                                    {/* Unit */}
                                   <div className="ingredient-unit">
    <label>Unit</label>
    <select
        value={ing.unit || ''}
        onChange={(e) => handleUnitChange(idx, e.target.value)}
        required
    >
        <option value="">
            {availableUnits.length === 0 ? 'Loading units...' : 'Select unit...'}
        </option>
        {filteredUnits.length > 0 ? (
            filteredUnits.map((unit) => (
                <option key={unit.id} value={unit.abbreviation}>
                    {unit.abbreviation} ({unit.name})
                </option>
            ))
        ) : (
            <option disabled value="">
                {availableUnits.length === 0 
                    ? 'Units not available' 
                    : 'No units for this type'}
            </option>
        )}
    </select>
</div>

                                    {/* Match Status */}
                                    {ing.ingredientId ? (
                                        <span className="match-status matched">✅ Selected</span>
                                    ) : (
                                        <span className="match-status unmatched">⚠️ Select</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Steps */}
                <section className="section">
                    <h2>Instructions ({editedRecipe.steps?.length || 0})</h2>
                    <div className="steps-section">
                        {editedRecipe.steps?.map((step, idx) => (
                            <div key={idx} className="step-item">
                                <span className="step-number">{idx + 1}.</span>
                                <textarea
                                    value={step}
                                    onChange={(e) => handleStepChange(idx, e.target.value)}
                                    placeholder="Enter step instruction..."
                                    rows="2"
                                />
                                <button
                                    className="delete-btn"
                                    onClick={() => handleDeleteStep(idx)}
                                    type="button"
                                >
                                    ❌
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="add-step-btn" onClick={handleAddStep} type="button">
                        ➕ Add Step
                    </button>
                </section>

                {/* Match Summary */}
                {ingredientMatches && (
                    <section className="section match-summary">
                        <h2>📊 Database Match Summary</h2>
                        <div className="match-stats">
                            <div className="stat-box matched">
                                <strong>{ingredientMatches.matched.length}</strong>
                                <p>Auto-Matched</p>
                            </div>
                            <div className="stat-box unmatched">
                                <strong>{ingredientMatches.unmatched.length}</strong>
                                <p>Need Selection</p>
                            </div>
                            <div className="stat-box percentage">
                                <strong>{ingredientMatches.matchPercentage}%</strong>
                                <p>Match Rate</p>
                            </div>
                        </div>
                        {ingredientMatches.unmatched.length > 0 && (
                            <div className="warning-box">
                                ℹ️ Select from the dropdown to match remaining ingredients, or they will be created as new.
                            </div>
                        )}
                    </section>
                )}

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button
                        className="save-btn"
                        onClick={handleSaveRecipe}
                        disabled={loading}
                    >
                        {loading ? '💾 Saving...' : '💾 Save Recipe'}
                    </button>
                    <button
                        className="cancel-btn"
                        onClick={() => navigate(-1)}
                        type="button"
                    >
                        ← Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoRecipeReview;
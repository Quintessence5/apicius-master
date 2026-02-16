import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/videoRecipeReview.css';

const VideoRecipeReview = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { recipe, ingredientMatches, conversionId, videoTitle } = location.state || {};
    
    const [editedRecipe, setEditedRecipe] = useState(recipe || {});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!recipe) {
        return (
            <div className="recipe-review-container">
                <p>❌ No recipe data found. Please extract a recipe first.</p>
            </div>
        );
    }

    const handleRecipeChange = (field, value) => {
        setEditedRecipe(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleIngredientChange = (index, field, value) => {
        const updatedIngredients = [...editedRecipe.ingredients];
        updatedIngredients[index] = {
            ...updatedIngredients[index],
            [field]: value
        };
        setEditedRecipe(prev => ({
            ...prev,
            ingredients: updatedIngredients
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

    const handleAddStep = () => {
        setEditedRecipe(prev => ({
            ...prev,
            steps: [...prev.steps, '']
        }));
    };

    const handleDeleteStep = (index) => {
        setEditedRecipe(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== index)
        }));
    };

    const handleSaveRecipe = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post('/api/transcripts/save-recipe', {
                generatedRecipe: editedRecipe,
                conversionId,
                userId: null
            });

            if (response.data.success) {
                setSuccess(`✅ Recipe "${editedRecipe.title}" saved successfully!`);
                setTimeout(() => {
                    navigate('/recipes');
                }, 2000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save recipe');
            console.error('Save error:', err);
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
                
                {/* Title & Meta */}
                <section className="section">
                    <h2>Recipe Title & Info</h2>
                    <div className="form-group">
                        <label>Title</label>
                        <input
                            type="text"
                            value={editedRecipe.title || ''}
                            onChange={(e) => handleRecipeChange('title', e.target.value)}
                            className="input-large"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Servings</label>
                            <input
                                type="number"
                                value={editedRecipe.servings || ''}
                                onChange={(e) => handleRecipeChange('servings', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Prep Time (min)</label>
                            <input
                                type="number"
                                value={editedRecipe.prep_time || ''}
                                onChange={(e) => handleRecipeChange('prep_time', parseInt(e.target.value))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Cook Time (min)</label>
                            <input
                                type="number"
                                value={editedRecipe.cook_time || ''}
                                onChange={(e) => handleRecipeChange('cook_time', parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Difficulty</label>
                            <select value={editedRecipe.difficulty || ''} onChange={(e) => handleRecipeChange('difficulty', e.target.value)}>
                                <option>Very Easy</option>
                                <option>Easy</option>
                                <option>Medium</option>
                                <option>Hard</option>
                                <option>Very Hard</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Course Type</label>
                            <select value={editedRecipe.course_type || ''} onChange={(e) => handleRecipeChange('course_type', e.target.value)}>
                                <option>Appetizer</option>
                                <option>Main Course</option>
                                <option>Dessert</option>
                                <option>Snack</option>
                                <option>Beverage</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Ingredients */}
                <section className="section">
                    <h2>Ingredients ({editedRecipe.ingredients?.length || 0})</h2>
                    <div className="ingredients-list">
                        {editedRecipe.ingredients?.map((ing, idx) => {
                            const match = ingredientMatches?.all?.find(m => m.name === ing.name);
                            return (
                                <div key={idx} className={`ingredient-item ${match?.found ? 'matched' : 'unmatched'}`}>
                                    <div className="ingredient-match-icon">{match?.icon || '⚠️'}</div>
                                    <div className="ingredient-details">
                                        <input
                                            type="text"
                                            value={ing.name}
                                            onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                                            placeholder="Ingredient name"
                                        />
                                    </div>
                                    <div className="ingredient-quantity">
                                        <input
                                            type="text"
                                            value={ing.quantity || ''}
                                            onChange={(e) => handleIngredientChange(idx, 'quantity', e.target.value)}
                                            placeholder="Qty"
                                            className="qty-input"
                                        />
                                        <input
                                            type="text"
                                            value={ing.unit || ''}
                                            onChange={(e) => handleIngredientChange(idx, 'unit', e.target.value)}
                                            placeholder="Unit"
                                            className="unit-input"
                                        />
                                    </div>
                                    {match?.found ? (
                                        <span className="match-status">✅ Matched</span>
                                    ) : (
                                        <span className="match-status warning">⚠️ Not in DB</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Steps */}
                <section className="section">
                    <h2>Instructions ({editedRecipe.steps?.length || 0})</h2>
                    <div className="steps-list">
                        {editedRecipe.steps?.map((step, idx) => (
                            <div key={idx} className="step-item">
                                <span className="step-number">{idx + 1}.</span>
                                <textarea
                                    value={step}
                                    onChange={(e) => handleStepChange(idx, e.target.value)}
                                    placeholder="Enter step instruction..."
                                />
                                <button
                                    className="delete-btn"
                                    onClick={() => handleDeleteStep(idx)}
                                >
                                    ❌
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="add-step-btn" onClick={handleAddStep}>
                        ➕ Add Step
                    </button>
                </section>

                {/* Match Summary */}
                {ingredientMatches && (
                    <section className="section match-summary">
                        <h2>📊 Ingredient Match Summary</h2>
                        <div className="match-stats">
                            <div className="stat-box matched">
                                <strong>{ingredientMatches.matched.length}</strong>
                                <p>Matched in DB</p>
                            </div>
                            <div className="stat-box unmatched">
                                <strong>{ingredientMatches.unmatched.length}</strong>
                                <p>Not in DB</p>
                            </div>
                            <div className="stat-box percentage">
                                <strong>{ingredientMatches.matchPercentage}%</strong>
                                <p>Match Rate</p>
                            </div>
                        </div>
                        {ingredientMatches.unmatched.length > 0 && (
                            <div className="warning-box">
                                ⚠️ <strong>{ingredientMatches.unmatched.length}</strong> ingredient(s) not found in database. They will be created automatically when you save.
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
                    >
                        ← Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VideoRecipeReview;
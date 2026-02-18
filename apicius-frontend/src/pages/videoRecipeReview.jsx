import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/videoRecipeReview.css';

// ────────────────────────────────────────────────
// Small presentational components
// ────────────────────────────────────────────────

const MetaField = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="meta-item">
    <label>{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value) || null : e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, required = false }) => (
  <div className="form-group">
    <label>{label} {required && <span className="required">*</span>}</label>
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

const IngredientSearchInput = ({ value, onChange, onFocus, results, onSelect, searching }) => (
  <div className="ingredient-search-wrapper">
    <input
      type="text"
      placeholder="Search ingredient..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      className="ingredient-search-input"
      autoComplete="off"
    />

    {searching && results.length > 0 && (
      <div className="search-results-dropdown">
        {results.map((result) => (
          <button
            key={result.id}
            className="search-result-item"
            onClick={(e) => {
              e.preventDefault();
              onSelect(result);
            }}
            type="button"
          >
            <span className="result-name">{result.name}</span>
            {result.form && <span className="result-form">({result.form})</span>}
          </button>
        ))}
      </div>
    )}
  </div>
);

// ────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────

const VideoRecipeReview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { recipe, ingredientMatches, conversionId, videoTitle, videoThumbnail } =
    location.state || {};

    console.log('🎬 VideoRecipeReview received state:', {
    recipe: recipe?.title,
    conversionId,
    videoTitle,
    videoThumbnail: videoThumbnail ? `✅ ${videoThumbnail}` : '❌ undefined'
  });

  const [editedRecipe, setEditedRecipe] = useState(recipe || {});
  const [ingredients, setIngredients] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchResults, setSearchResults] = useState({});
  const [searchingIndex, setSearchingIndex] = useState(null);

  const courseTypes = ['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage'];
  const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const difficultyLevels = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

  // ─── Data fetching ───────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Units
        try {
          const { data } = await axios.get('/api/units');
          setAvailableUnits(
            data.map((u) => ({ ...u, type: (u.type || 'unknown').toLowerCase() }))
          );
        } catch (err) {
          console.warn('Units fetch failed', err);
          setAvailableUnits([]);
        }

        // Ingredients (for search)
        try {
          const { data } = await axios.get('/api/ingredients');
          setAvailableIngredients(data);
        } catch (err) {
          console.warn('Ingredients fetch failed', err);
          setAvailableIngredients([]);
        }
      } catch (err) {
        console.error('Unexpected fetch error', err);
      }
    };

    fetchData();
  }, []);

  // ─── Initialize local ingredients state ──────────────────
  useEffect(() => {
    if (!editedRecipe.ingredients) return;

    const initIngredients = editedRecipe.ingredients.map((ing) => {
      const match = ingredientMatches?.all?.find((m) => m.name === ing.name) || null;
      return {
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit || '',
        section: ing.section,
        ingredientId: match?.dbId || null,
        ingredientName: match?.dbName || ing.name,
        form: match?.form || 'unknown',
        locked: false,
        dbMatch: match,
      };
    });

    setIngredients(initIngredients);
  }, [editedRecipe.ingredients, ingredientMatches]);

  // ─── Handlers ────────────────────────────────────────────
  const updateIngredient = useCallback((index, updates) => {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }, []);

  const handleIngredientSearch = async (index, searchValue) => {
    updateIngredient(index, { ingredientName: searchValue });

    if (!searchValue?.trim()) {
      setSearchResults((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    try {
      const { data } = await axios.get(`/api/ingredients/suggestions?search=${encodeURIComponent(searchValue.trim())}`);
      setSearchResults((prev) => ({ ...prev, [index]: data }));
    } catch (err) {
      console.error('Ingredient search failed', err);
      setSearchResults((prev) => ({ ...prev, [index]: [] }));
    }
  };

  const selectIngredient = (index, selected) => {
    updateIngredient(index, {
      ingredientId: selected.id,
      ingredientName: selected.name,
      form: selected.form || 'unknown',
      dbMatch: {
        name: selected.name,
        found: true,
        dbId: selected.id,
        dbName: selected.name,
        icon: '✅',
      },
    });
    setSearchResults((prev) => ({ ...prev, [index]: [] }));
    setSearchingIndex(null);
  };

  const clearIngredientSelection = (index) => {
    const ing = ingredients[index];
    updateIngredient(index, {
      ingredientId: null,
      ingredientName: ing.name,
      dbMatch: null,
    });
    setSearchResults((prev) => ({ ...prev, [index]: [] }));
  };

  const handleRecipeChange = (field, value) => {
    setEditedRecipe((prev) => ({ ...prev, [field]: value }));
  };

  const handleStepChange = (index, value) => {
    setEditedRecipe((prev) => {
      const steps = [...prev.steps];
      steps[index] = value;
      return { ...prev, steps };
    });
  };

  const addStep = () =>
    setEditedRecipe((prev) => ({
      ...prev,
      steps: [...(prev.steps || []), ''],
    }));

  const deleteStep = (index) =>
    setEditedRecipe((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));

  const getFilteredUnits = useCallback((form = 'unknown') => {
    if (!availableUnits.length) return [];

    const norm = form.toLowerCase();
    if (norm === 'solid') {
      return availableUnits.filter((u) => ['weight', 'quantity'].includes(u.type));
    }
    if (norm === 'liquid') {
      return availableUnits.filter((u) => u.type === 'volume');
    }
    return availableUnits;
  }, [availableUnits]);

  const renderUnitSelect = useCallback(
    (ing, idx) => {
      const units = getFilteredUnits(ing.form);

      return (
        <div className="ingredient-unit">
          <label>Unit</label>
          <select
            value={ing.unit || ''}
            onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
            required
          >
            <option value="">
              {availableUnits.length === 0 ? 'Loading...' : 'Select unit...'}
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.abbreviation}>
                {unit.abbreviation} – {unit.name}
              </option>
            ))}
          </select>
          {ing.unit && (
            <span className="unit-hint">
              Current: <strong>{ing.unit}</strong>
            </span>
          )}
        </div>
      );
    },
    [availableUnits, getFilteredUnits, updateIngredient]
  );

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    const missing = ingredients.filter((i) => !i.ingredientId);
    if (missing.length > 0) {
      setError(`Please select DB match for: ${missing.map((i) => i.name).join(', ')}`);
      setLoading(false);
      return;
    }

    const finalIngredients = ingredients.map((ing) => ({
      name: ing.ingredientName,
      quantity: ing.quantity,
      unit: ing.unit,
      section: ing.section,
      ingredientId: ing.ingredientId,
    }));

    console.log('💾 About to save recipe with:', {
        title: editedRecipe.title,
        conversionId,
        videoThumbnail: videoThumbnail || 'null'
      });
    console.log('📸 Sending thumbnail to backend:', videoThumbnail);

    try {
      const res = await axios.post('/api/transcripts/save-recipe', {
        generatedRecipe: { ...editedRecipe, ingredients: finalIngredients },
        conversionId,
        userId: null,
        videoThumbnail: videoThumbnail,
      });

      if (res.data.success) {
        setSuccess(`Recipe "${editedRecipe.title}" saved!`);
        setTimeout(() => navigate('/all-recipes'), 1800);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save recipe');
    } finally {
      setLoading(false);
    }
  };

  if (!recipe) {
    return (
      <div className="recipe-review-container">
        <p>No recipe data found.</p>
        <button onClick={() => navigate('/video-to-recipe')}>← Back</button>
      </div>
    );
  }

  return (
    <div className="recipe-review-container">
      <h1>Review & Edit Recipe</h1>
      {videoTitle && <p className="source-info">From: <strong>{videoTitle}</strong></p>}

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="recipe-review-content">
        {/* Thumbnail + Meta */}
        <section className="section thumbnail-section">
          {videoThumbnail && <img src={videoThumbnail} alt="Thumbnail" className="video-thumbnail" />}
          <div className="recipe-meta-info">
            <h3>Recipe Details</h3>
            <div className="meta-grid">
              <MetaField
                label="Servings"
                value={editedRecipe.servings}
                onChange={(v) => handleRecipeChange('servings', v)}
                type="number"
                placeholder="e.g. 4"
              />
              <MetaField
                label="Prep Time (min)"
                value={editedRecipe.prep_time}
                onChange={(v) => handleRecipeChange('prep_time', v)}
                type="number"
              />
              <MetaField
                label="Cook Time (min)"
                value={editedRecipe.cook_time}
                onChange={(v) => handleRecipeChange('cook_time', v)}
                type="number"
              />
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
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={editedRecipe.description || ''}
              onChange={(e) => handleRecipeChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-row">
            <SelectField
              label="Difficulty"
              value={editedRecipe.difficulty}
              onChange={(v) => handleRecipeChange('difficulty', v)}
              options={difficultyLevels}
              required
            />
            <SelectField
              label="Course Type"
              value={editedRecipe.course_type}
              onChange={(v) => handleRecipeChange('course_type', v)}
              options={courseTypes}
              required
            />
            <SelectField
              label="Meal Type"
              value={editedRecipe.meal_type}
              onChange={(v) => handleRecipeChange('meal_type', v)}
              options={mealTypes}
              required
            />
          </div>
        </section>

        {/* Ingredients */}
        <section className="section">
  <h2>Ingredients ({ingredients.length})</h2>

  {ingredients.length === 0 ? (
    <p className="empty-message">No ingredients found in the recipe.</p>
  ) : (
    // Group ingredients by section
    (() => {
      const sections = {};

      ingredients.forEach((ing, idx) => {
        const sectionName = ing.section?.trim() || 'Main';
        if (!sections[sectionName]) {
          sections[sectionName] = [];
        }
        sections[sectionName].push({ ing, idx });
      });

      // Sort sections – optional: put 'Main' first, then alphabetical
      const orderedSectionNames = Object.keys(sections).sort((a, b) => {
        if (a === 'Main') return -1;
        if (b === 'Main') return 1;
        return a.localeCompare(b);
      });

      return orderedSectionNames.map((sectionName) => (
        <div key={sectionName} className="ingredients-by-section">
          <h4 className="section-title">
            {sectionName}
            <span className="section-count">({sections[sectionName].length})</span>
          </h4>

          <div className="ingredients-section">
            {sections[sectionName].map(({ ing, idx }) => {
              const match = ing.dbMatch;
              const results = searchResults[idx] || [];

              return (
                <div
                  key={idx}
                  className={`ingredient-item ${match?.found ? 'matched' : 'unmatched'}`}
                >
                  <div className="ingredient-icon">{match?.icon || '⚠️'}</div>

                  <div className="ingredient-selector">
                    <label>Ingredient</label>
                    {ing.ingredientId ? (
                      <div className="selected-ingredient">
                        <span>✅ {ing.ingredientName}</span>
                        <button
                          className="clear-selection"
                          onClick={() => clearIngredientSelection(idx)}
                          type="button"
                        >
                          ✕ Change
                        </button>
                      </div>
                    ) : (
                      <IngredientSearchInput
                        value={ing.ingredientName || ''}
                        onChange={(val) => handleIngredientSearch(idx, val)}
                        onFocus={() => setSearchingIndex(idx)}
                        results={results}
                        onSelect={(selected) => selectIngredient(idx, selected)}
                        searching={searchingIndex === idx}
                      />
                    )}
                  </div>

                  <div className="ingredient-quantity">
                    <label>Qty</label>
                    <input
                      type="text"
                      value={ing.quantity || ''}
                      onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                      placeholder="e.g. 1, ½, 2–3"
                    />
                  </div>

                  {renderUnitSelect(ing, idx)}

                  <span className="match-status">
                    {ing.ingredientId ? '✅ Selected' : '⚠️ Select ingredient'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ));
    })()
  )}
</section>

        {/* Steps */}
<section className="section">
  <h2>Instructions ({editedRecipe.steps?.length || 0})</h2>
  {(() => {
      if (!editedRecipe.steps || editedRecipe.steps.length === 0) {
          return <p className="empty-message">No steps found in the recipe.</p>;
      }

      // Check if steps are structured (objects with section property)
      const isStructured = editedRecipe.steps[0] && typeof editedRecipe.steps[0] === 'object' && editedRecipe.steps[0].section;

      if (isStructured) {
          // Group steps by section
          const sections = {};
          editedRecipe.steps.forEach((step, idx) => {
              const sectionName = step.section || 'Main';
              if (!sections[sectionName]) {
                  sections[sectionName] = [];
              }
              sections[sectionName].push({ step, idx });
          });

          // Sort sections: 'Main' first, then alphabetical
          const sortedSectionNames = Object.keys(sections).sort((a, b) => {
              if (a === 'Main') return -1;
              if (b === 'Main') return 1;
              return a.localeCompare(b);
          });

          return sortedSectionNames.map((sectionName) => (
              <div key={sectionName} className="steps-by-section">
                  {sectionName !== 'Main' && (
                      <h4 className="section-title">
                          {sectionName}
                          <span className="section-count">({sections[sectionName].length} steps)</span>
                      </h4>
                  )}
                  <div className="steps-section">
                      {sections[sectionName].map(({ step, idx }) => (
                          <div key={idx} className="step-item">
                              <span className="step-number">{step.step_number || idx + 1}.</span>
                              <div className="step-content">
                                  <textarea
                                      value={step.instruction || ''}
                                      onChange={(e) => {
                                          const steps = [...editedRecipe.steps];
                                          steps[idx] = { ...step, instruction: e.target.value };
                                          setEditedRecipe(prev => ({ ...prev, steps }));
                                      }}
                                      rows={3}
                                      className="step-textarea"
                                  />
                                  
                                  {/* Duration input */}
                                  <div className="step-meta">
                                      <input
                                          type="number"
                                          placeholder="Duration (min)"
                                          value={step.duration_minutes || ''}
                                          onChange={(e) => {
                                              const steps = [...editedRecipe.steps];
                                              steps[idx] = { ...step, duration_minutes: parseInt(e.target.value) || null };
                                              setEditedRecipe(prev => ({ ...prev, steps }));
                                          }}
                                          min="0"
                                          className="duration-input"
                                      />
                                      
                                      {/* Section selector */}
                                      <select
                                          value={step.section || 'Main'}
                                          onChange={(e) => {
                                              const steps = [...editedRecipe.steps];
                                              steps[idx] = { ...step, section: e.target.value };
                                              setEditedRecipe(prev => ({ ...prev, steps }));
                                          }}
                                          className="section-select"
                                      >
                                          <option value="Main">Main</option>
                                          <option value="Prepare">Prepare</option>
                                          <option value="Cook">Cook</option>
                                          <option value="Assembly">Assembly</option>
                                          <option value="Garnish">Garnish</option>
                                      </select>
                                  </div>

                                  {/* Sub-steps */}
                                  {Array.isArray(step.sub_steps) && step.sub_steps.length > 0 && (
                                      <div className="sub-steps">
                                          <strong>Tips:</strong>
                                          <ul>
                                              {step.sub_steps.map((substep, sidx) => (
                                                  <li key={sidx}>{substep}</li>
                                              ))}
                                          </ul>
                                      </div>
                                  )}
                              </div>

                              <button 
                                  className="delete-btn" 
                                  onClick={() => deleteStep(idx)} 
                                  type="button"
                              >
                                  ×
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          ));
      } else {
          // Fallback for simple string steps
          return (
              <div className="steps-section">
                  {editedRecipe.steps.map((step, idx) => (
                      <div key={idx} className="step-item">
                          <span className="step-number">{idx + 1}.</span>
                          <textarea
                              value={typeof step === 'object' ? step.instruction : step}
                              onChange={(e) => handleStepChange(idx, e.target.value)}
                              rows={2}
                          />
                          <button className="delete-btn" onClick={() => deleteStep(idx)} type="button">
                              ×
                          </button>
                      </div>
                  ))}
              </div>
          );
      }
  })()}

  <div className="add-step-container">
      <button className="add-step-btn" onClick={addStep} type="button">
          + Add Step
      </button>
  </div>
</section>

        {/* Summary */}
        {ingredientMatches && (
          <section className="section match-summary">
            <h2>Match Summary</h2>
            <div className="match-stats">
              <div className="stat-box matched">
                <strong>{ingredientMatches.matched.length}</strong>
                <p>Matched</p>
              </div>
              <div className="stat-box unmatched">
                <strong>{ingredientMatches.unmatched.length}</strong>
                <p>To match</p>
              </div>
              <div className="stat-box percentage">
                <strong>{ingredientMatches.matchPercentage}%</strong>
                <p>Match rate</p>
              </div>
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="action-buttons">
          <button className="save-btn" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Recipe'}
          </button>
          <button className="cancel-btn" onClick={() => navigate(-1)} type="button">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoRecipeReview;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/transcriptToRecipe.css';

const TranscriptToRecipe = ({ onRecipeGenerated }) => {
    const navigate = useNavigate();
    
    // State management
    const [activeTab, setActiveTab] = useState('youtube');
    const [videoUrl, setVideoUrl] = useState('');
    const [manualTranscript, setManualTranscript] = useState('');
    const [transcript, setTranscript] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [generatedRecipe, setGeneratedRecipe] = useState(null);
    const [ingredientMatches, setIngredientMatches] = useState(null);
    const [step, setStep] = useState('input'); 
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [conversionId, setConversionId] = useState(null);
    const [videoTitle, setVideoTitle] = useState('');
    const [videoThumbnail, setVideoThumbnail] = useState('');
    const [recipeUrl, setRecipeUrl] = useState(''); 
    
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5010/api';

    // __________-------------Extract YouTube Video and Recipe-------------__________
    const handleExtractYouTube = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setProgress(0);
    setStep('extracting');

    try {
        console.log("🎬 Step 1: Extracting recipe from YouTube...");
        setStatusMessage('🎬 Downloading and analyzing video...');
        setProgress(20);

        const response = await axios.post(`${API_BASE_URL}/transcripts/extract-youtube`, {
            videoUrl
        });

        console.log("Response received:", response.data);

        if (response.data.redirect && response.data.recipeId) {
            // Recipe already exists - redirect directly to recipe page
            console.log("🔄 Redirecting to existing recipe...");
            setSuccess('✅ Recipe already exists! Redirecting...');
            setTimeout(() => {
                navigate(`/recipe/${response.data.recipeId}`);
            }, 1500);
            return;
        }

        if (response.data.success) {
            console.log("✅ Recipe extracted successfully");
            setProgress(90);
            setStatusMessage('📊 Matching ingredients with database...');
            
            setGeneratedRecipe(response.data.recipe);
            setIngredientMatches(response.data.ingredientMatches || null);
            setConversionId(response.data.conversionId);
            setVideoTitle(response.data.videoTitle || 'YouTube Video');
            setSuccess('✅ Recipe extracted! Redirecting to review page...');
            setProgress(100);
            setStatusMessage('✨ Complete!');
            setStep('review');
            
            // Wait a moment then redirect
            setTimeout(() => {
                console.log("🔀 Redirecting to review page...");
                navigate('/recipe-review', {
                    state: {
                        recipe: response.data.recipe,
                        ingredientMatches: response.data.ingredientMatches,
                        conversionId: response.data.conversionId,
                        videoTitle: response.data.videoTitle,
                        videoThumbnail: response.data.videoThumbnail 
                    }
                });
            }, 1000);
        } else {
            setError(response.data.message || 'Failed to extract recipe');
            setStep('input');
        }
    } catch (err) {
        console.error('YouTube extraction error:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to extract recipe from YouTube';
        setError(`❌ ${errorMsg}`);
        setStep('input');
    } finally {
        setLoading(false);
    }
};

// __________-------------Extract TikTok Video and Recipe-------------__________
    const handleExtractTikTok = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        setProgress(0);
        setStep('extracting');

        try {
            console.log("🎵 Step 1: Extracting recipe from TikTok...");
            setStatusMessage('🎵 Analyzing TikTok video...');
            setProgress(20);

            const response = await axios.post(`${API_BASE_URL}/transcripts/extract-tiktok`, {
                videoUrl
            });

            console.log("Response received:", response.data);

            if (response.data.redirect && response.data.recipeId) {
                // Recipe already exists - redirect directly to recipe page
                console.log("🔄 Redirecting to existing recipe...");
                setSuccess('✅ Recipe already exists! Redirecting...');
                setTimeout(() => {
                    navigate(`/recipe/${response.data.recipeId}`);
                }, 1500);
                return;
            }

            if (response.data.requiresManualInput) {
                // Metadata fetch failed - prompt user for manual input
                console.warn("⚠️ Automatic extraction failed, switching to manual input...");
                setError(`${response.data.message}. Please paste the video transcript below.`);
                setStep('input');
                setActiveTab('tiktok');
                setLoading(false);
                return;
            }

            if (response.data.success) {
                console.log("✅ Recipe extracted from TikTok successfully");
                setProgress(90);
                setStatusMessage('📊 Matching ingredients with database...');
                
                setGeneratedRecipe(response.data.recipe);
                setIngredientMatches(response.data.ingredientMatches || null);
                setConversionId(response.data.conversionId);
                setVideoTitle(response.data.videoTitle || 'TikTok Video');
                setVideoThumbnail(response.data.videoThumbnail);
                setSuccess('✅ Recipe extracted from TikTok! Redirecting to review page...');
                setProgress(100);
                setStatusMessage('✨ Complete!');
                setStep('review');
                
                // Wait a moment then redirect
                setTimeout(() => {
                    console.log("🔀 Redirecting to review page...");
                    navigate('/recipe-review', {
                        state: {
                            recipe: response.data.recipe,
                            ingredientMatches: response.data.ingredientMatches,
                            conversionId: response.data.conversionId,
                            videoTitle: response.data.videoTitle,
                            videoThumbnail: response.data.videoThumbnail 
                        }
                    });
                }, 1000);
            } else {
                setError(response.data.message || 'Failed to extract recipe from TikTok');
                setStep('input');
            }
        } catch (err) {
            console.error('TikTok extraction error:', err);
            const errorMsg = err.response?.data?.message || err.message || 'Failed to extract recipe from TikTok';
            setError(`❌ ${errorMsg}`);
            setStep('input');
        } finally {
            setLoading(false);
        }
    };

    // __________-------------Extract Recipe from Website URL-------------__________
const handleExtractFromURL = async (e) => {
    e.preventDefault();
    
    if (!recipeUrl.trim()) {
        setError('❌ Please enter a valid recipe URL');
        return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setProgress(0);
    setStep('extracting');

    try {
        console.log(`🌐 Extracting recipe from URL: ${recipeUrl}`);
        setStatusMessage('📡 Connecting to website...');
        setProgress(20);

        const response = await axios.post(`${API_BASE_URL}/scraper/extract`, {
            url: recipeUrl.trim(),
        });

        setProgress(60);
        setStatusMessage('🔄 Processing recipe data...');

        if (!response.data.success) {
            setError(`❌ ${response.data.error || 'Failed to extract recipe from URL'}`);
            setStep('input');
            setLoading(false);
            return;
        }

        const recipe = response.data.recipe;
        
        setProgress(90);
        setStatusMessage('✨ Recipe extracted successfully!');

        // Store the extracted recipe
        setGeneratedRecipe(recipe);
        
        // Create basic ingredient matches for URL-sourced recipes
        const basicMatches = {
            all: recipe.ingredients.map(ing => ({
                ...ing,
                dbId: null,
                found: false,
                icon: '⚠️'
            })),
            matched: [],
            unmatched: recipe.ingredients,
            matchPercentage: 0
        };
        setIngredientMatches(basicMatches);
        setConversionId(null);
        setVideoTitle(`From: ${new URL(recipeUrl).hostname}`);
        
        setSuccess(`✅ Successfully extracted "${recipe.title}"`);
        setProgress(100);
        setStep('ready');
        
    } catch (err) {
        console.error('❌ Error extracting recipe from URL:', err);
        const errorMsg = err.response?.data?.error || err.message || 'Failed to extract recipe from URL';
        setError(`❌ ${errorMsg}`);
        setStep('input');
    } finally {
        setLoading(false);
    }
};

    // __________-------------Convert Manual Transcript to Recipe-------------__________
    const handleManualTranscriptSubmit = async (e) => {
    e.preventDefault();
    if (!manualTranscript.trim()) {
        setError('Please enter a transcript');
        return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setProgress(0);
    setStep('extracting');

    try {
        console.log("📝 Converting manual transcript to recipe...");
        setStatusMessage('🤖 Generating recipe from transcript...');
        setProgress(30);

        // For manual input, use the convert-to-recipe endpoint
        const response = await axios.post(`${API_BASE_URL}/transcripts/convert-to-recipe`, {
            transcript: manualTranscript,
            source: activeTab,
            videoUrl: null
        });

        if (response.data.success) {
            console.log("✅ Recipe created successfully");
            setProgress(90);
            setStatusMessage('📊 Matching ingredients...');

            setGeneratedRecipe(response.data.recipe);
            // For manual input, create a basic match response
            const basicMatches = {
                all: response.data.recipe.ingredients.map(ing => ({
                    ...ing,
                    dbId: null,
                    found: false,
                    icon: '⚠️'
                })),
                matched: [],
                unmatched: response.data.recipe.ingredients,
                matchPercentage: 0
            };
            setIngredientMatches(basicMatches);
            setConversionId(response.data.conversionId);
            setVideoTitle(activeTab === 'manual' ? 'Manual Recipe Input' : `${activeTab} Video`);
            setSuccess('✅ Recipe created! Redirecting to review page...');
            setProgress(100);
            setStatusMessage('✨ Complete!');

            // Redirect to review page
            setTimeout(() => {
                navigate('/recipe-review', {
                    state: {
                        recipe: response.data.recipe,
                        ingredientMatches: basicMatches,
                        conversionId: response.data.conversionId,
                        videoTitle: activeTab === 'manual' ? 'Manual Recipe Input' : `${activeTab} Video`
                    }
                });
            }, 1500);
        } else {
            setError(response.data.message || 'Failed to create recipe');
            setStep('input');
        }
    } catch (err) {
        console.error('Conversion error:', err);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to convert transcript to recipe';
        setError(`❌ ${errorMsg}`);
        setStep('input');
    } finally {
        setLoading(false);
    }
};

    // __________-------------Navigate to Review Page-------------__________
    const handleReviewRecipe = () => {
        if (!generatedRecipe) return;

        navigate('/recipe-review', {
            state: {
                recipe: generatedRecipe,
                ingredientMatches: ingredientMatches,
                conversionId: conversionId,
                videoTitle: videoTitle,
                videoThumbnail: videoThumbnail,
            }
        });
    };

    // __________-------------Reset Form-------------__________
    const handleReset = () => {
        setActiveTab('youtube');
        setVideoUrl('');
        setRecipeUrl(''); 
        setManualTranscript('');
        setTranscript('');
        setError('');
        setSuccess('');
        setGeneratedRecipe(null);
        setIngredientMatches(null);
        setStep('input');
        setConversionId(null);
        setProgress(0);
        setStatusMessage('');
        setVideoTitle('');
    };

    return (
        <div className="transcript-to-recipe-container">
            <h2>🎥 Video to Recipe Converter</h2>

            {/* Tabs */}
            {step === 'input' && (
                <div className="transcript-tabs">
                    {[
                        { id: 'youtube', label: '▶️ YouTube', icon: '▶️' },
                        { id: 'tiktok', label: '🎵 TikTok', icon: '🎵' },
                        { id: 'instagram', label: '📷 Instagram', icon: '📷' },
                        { id: 'url', label: '🔗 Website', icon: '🔗' },
                        { id: 'manual', label: '✍️ Manual', icon: '✍️' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Messages */}
            {error && <div className="transcript-error-message">❌ {error}</div>}
            {success && <div className="transcript-success-message">✅ {success}</div>}

            {/* YouTube Input */}
            {activeTab === 'youtube' && step === 'input' && (
                <form onSubmit={handleExtractYouTube} className="transcript-form">
                    <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        required
                        disabled={loading}
                        className="transcript-input"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Extracting...' : '▶️ Extract Recipe'}
                    </button>
                </form>
            )}

            {/* TikTok URL Input */}
            {activeTab === 'tiktok' && step === 'input' && (
                <form onSubmit={handleExtractTikTok} className="transcript-form">
                    <input
                        type="url"
                        placeholder="https://www.tiktok.com/@username/video/... or https://vt.tiktok.com/..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        disabled={loading}
                        className="transcript-input"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Extracting...' : '🎵 Extract Recipe'}
                    </button>
                    <p className="tab-info">💡 Tip: If automatic extraction fails, you can paste the transcript manually below</p>
                </form>
            )}

            {/* Website URL Input */}
                {activeTab === 'url' && step === 'input' && (
                    <form onSubmit={handleExtractFromURL} className="transcript-form">
                        <input
                            type="url"
                            placeholder="https://www.750g.com/recettes/... or any recipe website URL"
                            value={recipeUrl}
                            onChange={(e) => setRecipeUrl(e.target.value)}
                            required
                            disabled={loading}
                            className="transcript-input"
                        />
                        <button type="submit" disabled={loading} className="transcript-submit-btn">
                            {loading ? '🔄 Extracting...' : '🔗 Extract Recipe'}
                        </button>
                        <p className="tab-info">💡 Supports: 750g.com, Marmiton.org, AllRecipes.com, SeriousEats.com, PinchOfYum.com, and more!</p>
                    </form>
                )}

            {/* Instagram/Manual Input */}
            {(activeTab === 'instagram' || activeTab === 'manual') && step === 'input' && (
                <form onSubmit={handleManualTranscriptSubmit} className="transcript-form">
                    <textarea
                        placeholder={`Paste ${activeTab === 'instagram' ? 'Instagram' : 'cooking'} video transcript or recipe text here...\nTip: Copy from video captions, description, or comments`}
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        required
                        disabled={loading}
                        rows="8"
                        className="transcript-textarea"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Converting...' : '🍳 Convert to Recipe'}
                    </button>
                </form>
            )}


            {/* Progress Indicator */}
            {loading && step === 'extracting' && (
                <div className="transcript-loading">
                    <div className="spinner"></div>
                    <p className="status-message">{statusMessage}</p>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="progress-text">{progress}%</p>
                </div>
            )}

            {/* Recipe Preview */}
            {step === 'ready' && generatedRecipe && (
                <div className="recipe-preview">
                    <div className="recipe-header">
                        <h3>🍳 {generatedRecipe.title}</h3>
                        {generatedRecipe.description && <p className="recipe-description">{generatedRecipe.description}</p>}
                        <p className="video-source">📺 From: <strong>{videoTitle}</strong></p>
                    </div>

                    {/* Recipe Metadata */}
                    <div className="recipe-meta">
                        {generatedRecipe.servings && (
                            <span className="meta-item">👥 {generatedRecipe.servings} servings</span>
                        )}
                        {generatedRecipe.prep_time && (
                            <span className="meta-item">⏱️ Prep: {generatedRecipe.prep_time} min</span>
                        )}
                        {generatedRecipe.cook_time && (
                            <span className="meta-item">🔥 Cook: {generatedRecipe.cook_time} min</span>
                        )}
                        {generatedRecipe.difficulty && (
                            <span className="meta-item">📊 {generatedRecipe.difficulty}</span>
                        )}
                        {generatedRecipe.course_type && (
                            <span className="meta-item">🍽️ {generatedRecipe.course_type}</span>
                        )}
                    </div>

                    {/* Ingredient Matching Summary */}
                    {ingredientMatches && (
                        <div className="ingredient-match-summary">
                            <h4>📊 Ingredient Database Match</h4>
                            <div className="match-stats">
                                <div className="stat-item matched">
                                    <strong>✅ {ingredientMatches.matched.length}</strong>
                                    <span>Found in DB</span>
                                </div>
                                <div className="stat-item unmatched">
                                    <strong>⚠️ {ingredientMatches.unmatched.length}</strong>
                                    <span>Not in DB</span>
                                </div>
                                <div className="stat-item percentage">
                                    <strong>{ingredientMatches.matchPercentage}%</strong>
                                    <span>Match Rate</span>
                                </div>
                            </div>
                            {ingredientMatches.unmatched.length > 0 && (
                                <div className="match-note">
                                    ⚠️ <strong>{ingredientMatches.unmatched.length}</strong> ingredient(s) will be created automatically
                                </div>
                            )}
                        </div>
                    )}

                    {/* Ingredients Preview */}
                    {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 && (
                        <div className="ingredients-preview">
                            <h4>📝 Ingredients ({generatedRecipe.ingredients.length})</h4>
                            <div className="ingredients-grid">
                                {generatedRecipe.ingredients.map((ing, idx) => {
                                    const match = ingredientMatches?.all?.find(m => m.name === ing.name);
                                    return (
                                        <div key={idx} className={`ingredient-preview ${match?.found ? 'matched' : 'unmatched'}`}>
                                            <span className="ingredient-icon">{match?.icon || '⚠️'}</span>
                                            <span className="ingredient-text">
                                                <strong>{ing.quantity || '?'} {ing.unit || ''}</strong> {ing.name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Steps Preview */}
                    {generatedRecipe.steps && generatedRecipe.steps.length > 0 && (
                        <div className="steps-preview">
                            <h4>👩‍🍳 Instructions ({generatedRecipe.steps.length})</h4>
                            <ol className="steps-list-preview">
                                {generatedRecipe.steps.slice(0, 5).map((step, idx) => (
                                    <li key={idx}>{step}</li>
                                ))}
                                {generatedRecipe.steps.length > 5 && (
                                    <li className="more-steps">... and {generatedRecipe.steps.length - 5} more steps</li>
                                )}
                            </ol>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="recipe-actions">
                        <button
                            onClick={handleReviewRecipe}
                            className="transcript-submit-btn primary"
                        >
                            ✏️ Review & Edit Recipe
                        </button>
                        <button
                            onClick={handleReset}
                            className="transcript-reset-btn"
                        >
                            🔄 Convert Another
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TranscriptToRecipe;
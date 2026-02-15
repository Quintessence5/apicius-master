import React, { useState } from 'react';
import axios from 'axios';
import '../styles/transcriptToRecipe.css';

const TranscriptToRecipe = ({ onRecipeGenerated }) => {
    const [activeTab, setActiveTab] = useState('youtube'); // youtube, tiktok, instagram, manual
    const [videoUrl, setVideoUrl] = useState('');
    const [manualTranscript, setManualTranscript] = useState('');
    const [transcript, setTranscript] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [generatedRecipe, setGeneratedRecipe] = useState(null);
    const [step, setStep] = useState('input'); // input, converting, mapping, ready
    const [ingredientMapping, setIngredientMapping] = useState(null);

    // __________-------------Extract YouTube Transcript-------------__________
    const handleExtractYouTube = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post('http://localhost:5010/api/transcripts/extract-youtube', {
                videoUrl
            });

            if (response.data.success) {
                setTranscript(response.data.transcript);
                setSuccess('YouTube transcript extracted! Proceeding to recipe conversion...');
                setTimeout(() => handleConvertToRecipe(response.data.transcript, 'youtube', videoUrl), 1500);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to extract YouTube transcript');
            console.error('YouTube extraction error:', err);
        } finally {
            setLoading(false);
        }
    };

    // __________-------------Convert Transcript to Recipe-------------__________
    const handleConvertToRecipe = async (transcriptText, source, sourceUrl = null) => {
        setLoading(true);
        setError('');
        setStep('converting');

        try {
            console.log(`🔄 Converting ${source} transcript to recipe...`);

            const response = await axios.post('http://localhost:5010/api/transcripts/convert-to-recipe', {
                transcript: transcriptText || transcript,
                videoUrl: sourceUrl || videoUrl,
                source: source || activeTab
            });

            if (response.data.success && response.data.recipe) {
                setGeneratedRecipe(response.data.recipe);
                setSuccess('Recipe generated successfully!');
                setStep('mapping');
                
                // Proceed to ingredient mapping
                await handleMapIngredients(response.data.recipe.ingredients);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to convert transcript to recipe');
            setStep('input');
            console.error('Conversion error:', err);
        } finally {
            setLoading(false);
        }
    };

    // __________-------------Map Ingredients to Database-------------__________
    const handleMapIngredients = async (ingredients) => {
        try {
            const response = await axios.post('http://localhost:5010/api/transcripts/map-ingredients', {
                ingredients
            });

            setIngredientMapping(response.data);
            setStep('ready');
            setSuccess(`✅ Mapping complete: ${response.data.mappingStats.mapped}/${response.data.mappingStats.total} ingredients found in database`);
        } catch (err) {
            console.error('Mapping error:', err);
            setError('Could not map all ingredients, but you can add them manually');
            setStep('ready');
        }
    };

    // __________-------------Handle Manual Transcript Input-------------__________
    const handleManualTranscriptSubmit = (e) => {
        e.preventDefault();
        if (!manualTranscript.trim()) {
            setError('Please enter a transcript');
            return;
        }
        handleConvertToRecipe(manualTranscript, activeTab);
    };

    // __________-------------Auto-fill Recipe Form with Generated Data-------------__________
    const handleAutoFillRecipe = () => {
        if (generatedRecipe && onRecipeGenerated) {
            // Pass the recipe data to parent component (AddRecipe.jsx)
            onRecipeGenerated({
                ...generatedRecipe,
                ingredients: ingredientMapping?.mappedIngredients || generatedRecipe.ingredients
            });
            setSuccess('Recipe form auto-filled! Review and save.');
        }
    };

    // __________-------------Reset Form-------------__________
    const handleReset = () => {
        setVideoUrl('');
        setManualTranscript('');
        setTranscript('');
        setGeneratedRecipe(null);
        setIngredientMapping(null);
        setError('');
        setSuccess('');
        setStep('input');
    };

    return (
        <div className="transcript-to-recipe-container">
            <h2>🎥 Convert Video to Recipe</h2>
            
            {/* Tabs for different sources */}
            {step === 'input' && (
                <div className="transcript-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
                        onClick={() => setActiveTab('youtube')}
                    >
                        📺 YouTube
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'tiktok' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tiktok')}
                    >
                        🎵 TikTok
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'instagram' ? 'active' : ''}`}
                        onClick={() => setActiveTab('instagram')}
                    >
                        📷 Instagram
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('manual')}
                    >
                        ✍️ Manual
                    </button>
                </div>
            )}

            {/* Error & Success Messages */}
            {error && <div className="transcript-error-message">❌ {error}</div>}
            {success && <div className="transcript-success-message">✅ {success}</div>}

            {/* YouTube Tab */}
            {activeTab === 'youtube' && step === 'input' && (
                <form onSubmit={handleExtractYouTube} className="transcript-form">
                    <input
                        type="url"
                        placeholder="Paste YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Extracting...' : '📥 Extract Transcript'}
                    </button>
                </form>
            )}

            {/* TikTok & Instagram Tabs - Manual Paste */}
            {(activeTab === 'tiktok' || activeTab === 'instagram') && step === 'input' && (
                <form onSubmit={handleManualTranscriptSubmit} className="transcript-form">
                    <textarea
                        placeholder={`Paste ${activeTab === 'tiktok' ? 'TikTok' : 'Instagram'} video transcript here...`}
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        required
                        disabled={loading}
                        rows="6"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Converting...' : '🍳 Convert to Recipe'}
                    </button>
                </form>
            )}

            {/* Manual Transcript Input */}
            {activeTab === 'manual' && step === 'input' && (
                <form onSubmit={handleManualTranscriptSubmit} className="transcript-form">
                    <textarea
                        placeholder="Paste any recipe transcript or text here..."
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        required
                        disabled={loading}
                        rows="6"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Converting...' : '🍳 Convert to Recipe'}
                    </button>
                </form>
            )}

            {/* Converting Progress */}
            {loading && step === 'converting' && (
                <div className="transcript-loading">
                    <div className="spinner"></div>
                    <p>🤖 AI is generating your recipe... (This may take 10-30 seconds)</p>
                </div>
            )}

            {/* Recipe Review & Mapping */}
            {step === 'ready' && generatedRecipe && (
                <div className="recipe-preview">
                    <div className="recipe-header">
                        <h3>{generatedRecipe.title}</h3>
                        <div className="recipe-meta">
                            <span>👥 {generatedRecipe.servings} servings</span>
                            <span>⏱️ {generatedRecipe.prep_time}min prep + {generatedRecipe.cook_time}min cook</span>
                            <span>📊 {generatedRecipe.difficulty}</span>
                        </div>
                    </div>

                    {/* Ingredients with Mapping Status */}
                    {ingredientMapping && (
                        <div className="ingredients-mapping">
                            <h4>Ingredients ({ingredientMapping.mappingStats.mappingPercentage}% matched)</h4>
                            
                            {/* Mapped Ingredients */}
                            {ingredientMapping.mappedIngredients.length > 0 && (
                                <div className="mapped-section">
                                    <h5>✅ Found in Database</h5>
                                    <ul>
                                        {ingredientMapping.mappedIngredients.map((ing, idx) => (
                                            <li key={idx} className="mapped-ingredient">
                                                {ing.quantity} {ing.unit} {ing.ingredientName}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Unmapped Ingredients */}
                            {ingredientMapping.unmappedIngredients.length > 0 && (
                                <div className="unmapped-section">
                                    <h5>⚠️ Not Found (Can Add Manually)</h5>
                                    <ul>
                                        {ingredientMapping.unmappedIngredients.map((ing, idx) => (
                                            <li key={idx} className="unmapped-ingredient">
                                                {ing.quantity} {ing.unit} {ing.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Steps */}
                    <div className="recipe-steps">
                        <h4>Steps</h4>
                        <ol>
                            {generatedRecipe.steps.map((step, idx) => (
                                <li key={idx}>{step}</li>
                            ))}
                        </ol>
                    </div>

                    {/* Notes */}
                    {generatedRecipe.notes && (
                        <div className="recipe-notes">
                            <h4>Notes</h4>
                            <p>{generatedRecipe.notes}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="recipe-actions">
                        <button 
                            onClick={handleAutoFillRecipe}
                            className="transcript-submit-btn"
                        >
                            ✅ Use This Recipe
                        </button>
                        <button 
                            onClick={handleReset}
                            className="transcript-reset-btn"
                        >
                            🔄 Start Over
                        </button>
                    </div>
                </div>
            )}

            {/* Mapping in Progress */}
            {step === 'mapping' && (
                <div className="transcript-loading">
                    <div className="spinner"></div>
                    <p>🔍 Matching ingredients to database...</p>
                </div>
            )}
        </div>
    );
};

export default TranscriptToRecipe;
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
    const [step, setStep] = useState('input'); // input, extracting, converting, mapping, ready
    const [ingredientMapping, setIngredientMapping] = useState(null);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [conversionId, setConversionId] = useState(null);

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5010/api';

    // __________-------------Extract YouTube Transcript-------------__________
    const handleExtractYouTube = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        setProgress(20);
        setStatusMessage('🎬 Downloading video...');
        setStep('extracting');

        try {
            console.log("📼 Extracting YouTube transcript...");

            const response = await axios.post(`${API_BASE_URL}/transcripts/extract-youtube`, {
                videoUrl
            });

            if (response.data.success) {
                setTranscript(response.data.transcript);
                setConversionId(response.data.conversionId);
                setProgress(60);
                setStatusMessage('📝 Transcribing...');
                setSuccess(`✅ ${response.data.method === 'audio-download-and-transcribe' 
                    ? 'Video transcribed!' 
                    : 'Transcript extracted!'}`);
                
                // Auto-proceed to recipe conversion
                setTimeout(() => handleConvertToRecipe(response.data.transcript, 'youtube', videoUrl), 1000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to extract YouTube transcript');
            setStep('input');
            console.error('YouTube extraction error:', err);
        } finally {
            setLoading(false);
            setProgress(0);
        }
    };

    // __________-------------Convert Transcript to Recipe-------------__________
    const handleConvertToRecipe = async (transcriptText, source, sourceUrl = null) => {
        setLoading(true);
        setError('');
        setProgress(70);
        setStatusMessage('🤖 Generating recipe...');
        setStep('converting');

        try {
            console.log(`🔄 Converting ${source} transcript to recipe...`);

            const response = await axios.post(`${API_BASE_URL}/transcripts/convert-to-recipe`, {
                transcript: transcriptText || transcript,
                videoUrl: sourceUrl || videoUrl,
                source: source || activeTab
            });

            if (response.data.success && response.data.recipe) {
                setGeneratedRecipe(response.data.recipe);
                setConversionId(response.data.conversionId);
                setSuccess('✅ Recipe generated successfully!');
                setProgress(85);
                setStatusMessage('🔗 Mapping ingredients...');
                setStep('mapping');
                
                // Proceed to ingredient mapping
                await handleMapIngredients(response.data.recipe.ingredients);
                
                setProgress(100);
                setStep('ready');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to convert transcript to recipe');
            setStep('input');
            console.error('Conversion error:', err);
        } finally {
            setLoading(false);
            setProgress(0);
        }
    };

    // __________-------------Map Ingredients to Database-------------__________
    const handleMapIngredients = async (ingredients) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/transcripts/map-ingredients`, {
                ingredients
            });

            setIngredientMapping(response.data);
            setSuccess(`✅ ${response.data.mappingStats.mapped}/${response.data.mappingStats.total} ingredients found`);
            
            console.log("Mapping stats:", response.data.mappingStats);
        } catch (err) {
            console.error('Mapping error:', err);
            setError('Could not map all ingredients, but you can add them manually later');
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
            onRecipeGenerated({
                ...generatedRecipe,
                mappedIngredients: ingredientMapping?.mappedIngredients || [],
                unmappedIngredients: ingredientMapping?.unmappedIngredients || [],
                conversionId
            });
        }
    };

    // __________-------------Reset Form-------------__________
    const handleReset = () => {
        setActiveTab('youtube');
        setVideoUrl('');
        setManualTranscript('');
        setTranscript('');
        setError('');
        setSuccess('');
        setGeneratedRecipe(null);
        setStep('input');
        setIngredientMapping(null);
        setConversionId(null);
        setProgress(0);
        setStatusMessage('');
    };

    return (
        <div className="transcript-to-recipe-container">
            <h2>🎥 Video to Recipe Converter</h2>

            {/* Tabs */}
            {step === 'input' && (
                <div className="transcript-tabs">
                    {['youtube', 'tiktok', 'instagram', 'manual'].map(tab => (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'youtube' && '▶️ YouTube'}
                            {tab === 'tiktok' && '🎵 TikTok'}
                            {tab === 'instagram' && '📷 Instagram'}
                            {tab === 'manual' && '✍️ Manual'}
                        </button>
                    ))}
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
                        placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Extracting...' : '▶️ Extract & Convert'}
                    </button>
                </form>
            )}

            {/* TikTok / Instagram Tabs (Manual Transcript Input) */}
            {(activeTab === 'tiktok' || activeTab === 'instagram') && step === 'input' && (
                <form onSubmit={handleManualTranscriptSubmit} className="transcript-form">
                    <textarea
                        placeholder={`Paste ${activeTab} video transcript here...\nTip: Use browser tools or copy from video captions`}
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

            {/* Manual Input Tab */}
            {activeTab === 'manual' && step === 'input' && (
                <form onSubmit={handleManualTranscriptSubmit} className="transcript-form">
                    <textarea
                        placeholder="Paste any cooking transcript or recipe text here..."
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        required
                        disabled={loading}
                        rows="8"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Converting...' : '🍳 Convert to Recipe'}
                    </button>
                </form>
            )}

            {/* Progress Indicator */}
            {loading && (step === 'extracting' || step === 'converting' || step === 'mapping') && (
                <div className="transcript-loading">
                    <div className="spinner"></div>
                    <p>{statusMessage}</p>
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
                        {generatedRecipe.description && <p>{generatedRecipe.description}</p>}
                    </div>

                    <div className="recipe-meta">
                        {generatedRecipe.servings && <span>👥 {generatedRecipe.servings} servings</span>}
                        {generatedRecipe.prep_time && <span>⏱️ Prep: {generatedRecipe.prep_time} min</span>}
                        {generatedRecipe.cook_time && <span>🔥 Cook: {generatedRecipe.cook_time} min</span>}
                        {generatedRecipe.difficulty && <span>📊 {generatedRecipe.difficulty}</span>}
                    </div>

                    {/* Ingredients */}
                    {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 && (
                        <div className="ingredients-mapping">
                            <h4>📝 Ingredients</h4>
                            
                            {ingredientMapping && (
                                <>
                                    {ingredientMapping.mappedIngredients.length > 0 && (
                                        <div className="mapped-section">
                                            <h5>✅ Found in Database ({ingredientMapping.mappedIngredients.length})</h5>
                                            <ul>
                                                {ingredientMapping.mappedIngredients.map((ing, idx) => (
                                                    <li key={idx} className="mapped-ingredient">
                                                        <strong>{ing.quantity || 'to taste'} {ing.unit || ''}</strong> {ing.ingredientName}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    
                                    {ingredientMapping.unmappedIngredients.length > 0 && (
                                        <div className="unmapped-section">
                                            <h5>⚠️ Not Found in Database ({ingredientMapping.unmappedIngredients.length})</h5>
                                            <ul>
                                                {ingredientMapping.unmappedIngredients.map((ing, idx) => (
                                                    <li key={idx} className="unmapped-ingredient">
                                                        <strong>{ing.quantity || 'to taste'} {ing.unit || ''}</strong> {ing.name}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Steps */}
                    {generatedRecipe.steps && generatedRecipe.steps.length > 0 && (
                        <div className="recipe-steps">
                            <h4>👩‍🍳 Instructions</h4>
                            <ol>
                                {generatedRecipe.steps.map((step, idx) => (
                                    <li key={idx}>{step}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {/* Notes */}
                    {generatedRecipe.notes && (
                        <div className="recipe-notes">
                            <h4>💡 Notes</h4>
                            <p>{generatedRecipe.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="recipe-actions">
                        <button 
                            onClick={handleAutoFillRecipe} 
                            className="transcript-submit-btn"
                        >
                            💾 Save Recipe
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
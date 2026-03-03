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
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [selectedFileName, setSelectedFileName] = useState('');
    
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5010/api';


    // Platform detection
    const detectPlatform = (url) => {
        if (url.match(/(youtube\.com|youtu\.be)/i)) return 'youtube';
        if (url.match(/(tiktok\.com)/i)) return 'tiktok';
        if (url.match(/(instagram\.com|instagr\.am)/i)) return 'instagram';
        return null;
    };

    // Unified video extraction handler
    const handleExtractVideo = async (e) => {
    e.preventDefault();
    const platform = detectPlatform(videoUrl);
    if (!platform) {
        setError('❌ Unsupported platform. Please use YouTube, TikTok, or Instagram.');
        return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setProgress(0);
    setStep('extracting');

    // Define progress steps with messages
    const progressSteps = [
        { progress: 10, message: '✅ Validating URL...' },
        { progress: 20, message: `🎬 Extracting from ${platform}...` },
        { progress: 40, message: `📡 Getting Metadata from ${platform}...` },
        { progress: 50, message: `🔍 Testing Solution 1 for ${platform} ...` },
        { progress: 65, message: `🌐 Testing Solution 2 for ${platform} ...` },
        { progress: 80, message: `🎤 Testing Solution 3 for ${platform} ...` },
        { progress: 90, message: '📊 Matching ingredients with database...' },
    ];

    // Set up timers for each step
    const timers = [];
    let currentStepIndex = 0;

    const scheduleNext = () => {
        if (currentStepIndex < progressSteps.length) {
            const step = progressSteps[currentStepIndex];
            const timer = setTimeout(() => {
                setProgress(step.progress);
                setStatusMessage(step.message);
                currentStepIndex++;
                scheduleNext();
            }, 2000); // 2 seconds between steps – adjust as needed
            timers.push(timer);
        }
    };

    // Start the first timer immediately (progress 10%)
    setProgress(10);
    setStatusMessage(progressSteps[0].message);
    currentStepIndex = 1;
    scheduleNext();

    try {
        let response;
        switch (platform) {
            case 'youtube':
                response = await axios.post(`${API_BASE_URL}/transcripts/extract-youtube`, { videoUrl });
                break;
            case 'tiktok':
                response = await axios.post(`${API_BASE_URL}/transcripts/extract-tiktok`, { videoUrl });
                break;
            case 'instagram':
                response = await axios.post(`${API_BASE_URL}/transcripts/extract-instagram`, { videoUrl });
                break;
            default:
                throw new Error('Unsupported platform');
        }

        // Clear all timers – request finished
        timers.forEach(timer => clearTimeout(timer));

        const data = response.data;

        if (data.redirect && data.recipeId) {
            setSuccess('✅ Recipe already exists! Redirecting...');
            setTimeout(() => navigate(`/recipe/${data.recipeId}`), 1500);
            return;
        }

        if (data.requiresManualInput) {
            setError(`${data.message}. Please paste the video transcript manually below.`);
            setStep('input');
            setLoading(false);
            return;
        }

        if (data.success) {
            setProgress(90);
            setStatusMessage('📊 Matching ingredients with database...');

            setGeneratedRecipe(data.recipe);
            setIngredientMatches(data.ingredientMatches || null);
            setConversionId(data.conversionId);
            setVideoTitle(data.videoTitle || `${platform} Video`);
            setVideoThumbnail(data.videoThumbnail);
            setSuccess(`✅ Recipe extracted from ${platform}! Redirecting to review page...`);
            setProgress(100);
            setStatusMessage('✨ Complete!');
            setStep('review');

            setTimeout(() => {
                navigate('/recipe-review/create', {
                    state: {
                        recipe: data.recipe,
                        ingredientMatches: data.ingredientMatches,
                        conversionId: data.conversionId,
                        videoTitle: data.videoTitle,
                        videoThumbnail: data.videoThumbnail
                    }
                });
            }, 1000);
        } else {
            setError(data.message || 'Failed to extract recipe');
            setStep('input');
            setLoading(false);
        }
    } catch (err) {
        console.error('Extraction error:', err);
        timers.forEach(timer => clearTimeout(timer));
        const errorMsg = err.response?.data?.message || err.message || 'Failed to extract recipe';
        setError(`❌ ${errorMsg}`);
        setStep('input');
        setLoading(false);
    }
};

    // __________-------------Extract Recipe from Website URL-------------__________
const handleExtractWebsite = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  setSuccess('');
  setProgress(0);
  setStep('extracting');
  setStatusMessage('🌐 Fetching website recipe...');

  try {
    const response = await axios.post(`${API_BASE_URL}/transcripts/extract-url`, {
      url: websiteUrl,
    });

    if (response.data.redirect && response.data.recipeId) {
      // Recipe already exists - redirect directly to recipe page
      setSuccess('✅ Recipe already exists! Redirecting...');
      setTimeout(() => {
        navigate(`/recipe/${response.data.recipeId}`);
      }, 1500);
      return;
    }

    if (response.data.success) {
      console.log("✅ Website recipe extracted successfully");
      setProgress(90);
      setStatusMessage('📊 Processing...');
      
      setGeneratedRecipe(response.data.recipe);
      setIngredientMatches(response.data.ingredientMatches || null);
      setConversionId(response.data.conversionId);
      setVideoTitle(response.data.videoTitle || 'Website Recipe');
      setVideoThumbnail(response.data.videoThumbnail);
      setSuccess('✅ Recipe extracted! Redirecting to review page...');
      setProgress(100);
      setStatusMessage('✨ Complete!');
      setStep('review');
      
      // Wait a moment then redirect
      setTimeout(() => {
        console.log("🔀 Redirecting to review page...");
        navigate('/recipe-review/create', {
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
      setError(response.data.message || 'Failed to extract recipe from website');
      setStep('input');
    }
  } catch (err) {
    console.error('Website extraction error:', err);
    const errorMsg = err.response?.data?.message || err.message || 'Failed to extract recipe from website';
    setError(`❌ ${errorMsg}`);
    setStep('input');
  } finally {
    setLoading(false);
  }
};

   // Manual tab – redirect to Add Recipe page
    const handleManualRedirect = () => {
        navigate('/add-recipe');
    };

// Add handleImageUpload function:
const handleImageUpload = async (e) => {
  e.preventDefault();
  if (!imageFile) {
    setError('Please select an image file');
    return;
  }

  setLoading(true);
  setError('');
  setSuccess('');
  setProgress(0);
  setStep('extracting');
  setStatusMessage('📤 Uploading image...');

  const progressSteps = [
    { progress: 10, message: '📤 Uploading image...' },
    { progress: 40, message: '🔍 Analyzing image with AI...' },
    { progress: 70, message: '📊 Matching ingredients with database...' },
    { progress: 90, message: '✨ Finalizing recipe...' },
  ];

  let currentStepIndex = 0;
  const timers = [];

  const scheduleNext = () => {
    if (currentStepIndex < progressSteps.length) {
      const step = progressSteps[currentStepIndex];
      const timer = setTimeout(() => {
        setProgress(step.progress);
        setStatusMessage(step.message);
        currentStepIndex++;
        scheduleNext();
      }, 2000);
      timers.push(timer);
    }
  };

  setProgress(10);
  setStatusMessage(progressSteps[0].message);
  currentStepIndex = 1;
  scheduleNext();

  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await axios.post(`${API_BASE_URL}/transcripts/extract-from-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    timers.forEach(timer => clearTimeout(timer));

    const data = response.data;

    if (data.success) {
      setProgress(100);
      setStatusMessage('✅ Complete!');
      setSuccess('✅ Recipe extracted! Redirecting to review...');

      setTimeout(() => {
        navigate('/recipe-review/create', {
          state: {
            recipe: data.recipe,
            ingredientMatches: data.ingredientMatches,
            conversionId: data.conversionId,
            videoTitle: data.videoTitle,
            videoThumbnail: data.videoThumbnail,
          },
        });
      }, 1500);
    } else {
      setError(data.message || 'Failed to extract recipe');
      setStep('input');
    }
  } catch (err) {
    timers.forEach(timer => clearTimeout(timer));
    console.error('Image upload error:', err);
    setError(err.response?.data?.message || err.message || 'Failed to process image');
    setStep('input');
  } finally {
    setLoading(false);
  }
};

    // __________-------------Navigate to Review Page-------------__________
    const handleReviewRecipe = () => {
        if (!generatedRecipe) return;

        navigate('/recipe-review/create', {
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
            <h2>Add a new recipe 🥙</h2>

            {/* Tabs */}
            {step === 'input' && (
                <div className="transcript-tabs">
                    {[
                        { id: 'video', label: '🎥 Video Upload', icon: '🎥' },
                        { id: 'url', label: '🔗 Website', icon: '🔗' },
                        { id: 'image', label: '📸 Image', icon: '📸' },
                        { id: 'manual', label: '✍️ Manual', icon: '✍️' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
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

             {/* Video Upload Tab */}
            {activeTab === 'video' && step === 'input' && (
                <form onSubmit={handleExtractVideo} className="transcript-form">
                    <input
                        type="url"
                        placeholder="Paste YouTube, TikTok, or Instagram video URL..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        required
                        disabled={loading}
                        className="transcript-input"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Extracting...' : '🎥 Extract Recipe'}
                    </button>
                    <p className="tab-info">💡 Supports YouTube, TikTok, and Instagram videos</p>
                </form>
            )}

            {/* Image Tab – Placeholder */}
            {activeTab === 'image' && step === 'input' && (
  <form onSubmit={handleImageUpload} className="transcript-form">
    <div className="file-upload-wrapper">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files[0];
          setImageFile(file);
          setSelectedFileName(file ? file.name : '');
        }}
        disabled={loading}
        className="transcript-input"
        id="image-upload"
      />
      {selectedFileName && (
        <div className="file-upload-success">
          <span className="success-icon">✅</span>
          <span className="file-name">{selectedFileName}</span>
          <span className="success-text">Upload successful</span>
        </div>
      )}
    </div>
    <button type="submit" disabled={loading || !imageFile} className="transcript-submit-btn">
      {loading ? '🔄 Processing...' : '📸 Extract from Image'}
    </button>
    <p className="tab-info">
      📸 Upload a clear image of a recipe (cookbook page, handwritten note, screenshot)
    </p>
  </form>
)}

            {/* Website Input */}
            {activeTab === 'url' && step === 'input' && (
                <form onSubmit={handleExtractWebsite} className="transcript-form">
                    <input
                        type="url"
                        placeholder="Enter recipe website URL (e.g., https://www.recipe.com/...)"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        required
                        disabled={loading}
                        className="transcript-input"
                    />
                    <button type="submit" disabled={loading} className="transcript-submit-btn">
                        {loading ? '🔄 Extracting...' : '🌐 Extract from Website'}
                    </button>
                    <p className="tab-info">
                        💡 Supports: 750g.com, Marmiton.org, AllRecipes.com, SeriousEats.com, PinchOfYum.com, and many more!
                    </p>
                </form>
            )}

            {/* Manual Tab – Redirect to Add Recipe */}
            {activeTab === 'manual' && step === 'input' && (
                <div className="transcript-form">
                    <p>Create a recipe from scratch using our manual entry form.</p>
                    <button onClick={handleManualRedirect} className="transcript-submit-btn">
                        ✍️ Go to Manual Recipe Entry
                    </button>
                </div>
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
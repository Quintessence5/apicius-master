import React from 'react';
import { useNavigate } from 'react-router-dom';
import TranscriptToRecipe from '../components/TranscriptToRecipe';
import '../styles/transcriptPage.css';

const TranscriptPage = () => {
    const navigate = useNavigate();

    const handleRecipeGenerated = (recipe) => {
        // Navigate to AddRecipe with the generated recipe as state
        navigate('/add-recipe', { 
            state: { 
                generatedRecipe: recipe,
                prefilledData: {
                    title: recipe.title,
                    steps: recipe.steps || [],
                    notes: recipe.notes || '',
                    prep_time: recipe.prep_time || 0,
                    cook_time: recipe.cook_time || 0,
                    total_time: recipe.total_time || 0,
                    difficulty: recipe.difficulty || '',
                    course_type: recipe.course_type || '',
                    meal_type: recipe.meal_type || '',
                    cuisine_type: recipe.cuisine_type || '',
                    portions: recipe.servings || 1,
                    source: recipe.source || '',
                }
            } 
        });
    };

    return (
        <div className="transcript-page-container">
            <div className="transcript-page-header">
                <h1>🎥 Video to Recipe Converter</h1>
                <p>Extract recipes from YouTube, TikTok, Instagram, or paste any cooking transcript</p>
            </div>

            <div className="transcript-page-content">
                <TranscriptToRecipe onRecipeGenerated={handleRecipeGenerated} />
            </div>

            <div className="transcript-page-info">
                <div className="info-card">
                    <h3>📺 YouTube</h3>
                    <p>Automatically extracts transcripts from YouTube cooking videos (with subtitles)</p>
                </div>
                <div className="info-card">
                    <h3>🎵 TikTok & 📷 Instagram</h3>
                    <p>Paste the video transcript manually (use browser tools or copy from captions)</p>
                </div>
                <div className="info-card">
                    <h3>✍️ Manual Input</h3>
                    <p>Paste any cooking text or transcript to convert it to a structured recipe</p>
                </div>
            </div>
        </div>
    );
};

export default TranscriptPage;
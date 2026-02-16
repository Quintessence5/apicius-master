import React from 'react';
import TranscriptToRecipe from '../components/TranscriptToRecipe';
import "../styles/transcriptToRecipe.css"

const TranscriptPage = () => {
    return (
        <div className="transcript-page-container">
            <div className="transcript-page-header">
                <h1>🎥 Video to Recipe Converter</h1>
                <p>Extract structured recipes from YouTube videos, paste transcripts, or manually enter cooking instructions</p>
            </div>

            <div className="transcript-page-content">
                <TranscriptToRecipe />
            </div>

            <div className="transcript-page-info">
                <div className="info-card">
                    <h3>📺 YouTube & Shorts</h3>
                    <p>Automatically extracts recipes from video descriptions using AI-powered ingredient parsing</p>
                </div>
                <div className="info-card">
                    <h3>🎯 Smart Matching</h3>
                    <p>Ingredients are automatically matched with your database and standardized to common units</p>
                </div>
                <div className="info-card">
                    <h3>✏️ Full Control</h3>
                    <p>Review, edit, and verify every detail before saving to your recipe collection</p>
                </div>
            </div>
        </div>
    );
};

export default TranscriptPage;
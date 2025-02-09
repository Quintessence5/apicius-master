import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Timer from '../components/timerComp';
import '../styles/timer.css';

const TimerPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const steps = location.state?.steps || [];
    const recipeName = location.state?.recipeName || '';
    const [currentTimerIndex, setCurrentTimerIndex] = useState(0);
    const [timers, setTimers] = useState(steps.map((step, index) => ({ 
        id: index + 1, 
        duration: 150, // Default duration for recipe steps (2 minutes 30 seconds)
        description: step 
    })));
    const [showAddTimerForm, setShowAddTimerForm] = useState(false);
    const [newTimerHours, setNewTimerHours] = useState(0);
    const [newTimerMinutes, setNewTimerMinutes] = useState(2);
    const [newTimerSeconds, setNewTimerSeconds] = useState(30);
    const [newTimerDescription, setNewTimerDescription] = useState('');
    const [allTimersCompleted, setAllTimersCompleted] = useState(false);
    const [cookingTimers, setCookingTimers] = useState([]);
    const [showRecap, setShowRecap] = useState(steps.length > 0);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editFormData, setEditFormData] = useState({ duration: 0, description: '' });

    
    const handleStartCooking = () => {
        setShowRecap(false);
        setCurrentTimerIndex(0);
    };
    
    const handleLetItCook = () => {
        setCookingTimers(prev => [...new Set([...prev, currentTimerIndex])]);
        handleNext();
    };

    const handleAddTimer = () => {
        const duration = newTimerHours * 3600 + newTimerMinutes * 60 + newTimerSeconds;
        if (duration > 0) {
            const newTimer = {
                id: timers.length + 1,
                duration,
                description: newTimerDescription || `Step ${timers.length + 1}`,
            };
            setTimers([...timers, newTimer]);
            setNewTimerDescription('');
            setNewTimerHours(0);
            setNewTimerMinutes(2);
            setNewTimerSeconds(30);
            setShowAddTimerForm(false);
        }
    };

    const handleEditStart = (index) => {
        setEditingIndex(index);
        setEditFormData({
            duration: timers[index].duration,
            description: timers[index].description
        });
    };

    const handleEditTimer = (index) => {
        const updatedTimers = [...timers];
        updatedTimers[index] = { 
            ...updatedTimers[index], 
            duration: editFormData.duration,
            description: editFormData.description
        };
        setTimers(updatedTimers);
        setEditingIndex(null);
    };

    const handleDeleteTimer = (index) => {
        const updatedTimers = timers.filter((_, i) => i !== index);
        setTimers(updatedTimers);
        if (currentTimerIndex >= updatedTimers.length) {
            setCurrentTimerIndex(updatedTimers.length - 1);
        }
    };

    const handlePrevious = () => {
        if (currentTimerIndex > 0) {
            setCurrentTimerIndex(currentTimerIndex - 1);
        }
    };

    const handleNext = () => {
        if (currentTimerIndex < timers.length - 1) {
            setCurrentTimerIndex(currentTimerIndex + 1);
        } else {
            setAllTimersCompleted(true);
        }
    };

    const handleBackToRecipes = () => {
        navigate('/all-recipes');
    };

    const handleCookingTimerComplete = (index) => {
        setCookingTimers(prev => prev.filter(i => i !== index));
    };

    return (
        <div className={`timer-page ${showRecap ? 'recap-mode' : ''}`}>
            {/* Recap Page */}
            {showRecap ? (
                <div className="recap-container">
                    <h2 className="recap-title">
                      <span className="regular-text">Cooking Plan for</span> <br />
                      <span className="bold-text">{recipeName}</span>
                    </h2>
            <div className="recap-steps-grid">
                {timers.map((timer, index) => (
                            <div key={index} className="recap-step-card">
                                {editingIndex === index ? (
                                    <div className="edit-step-form">
                                        <div className="time-edit-inputs">
                                            <div className="time-input-group" data-unit="h">
                                                <input
                                                    type="number"
                                                    value={Math.floor(editFormData.duration / 3600)}
                                                    onChange={(e) => {
                                                        const hours = parseInt(e.target.value) || 0;
                                                        setEditFormData(prev => ({
                                                            ...prev,
                                                            duration: hours * 3600 + (prev.duration % 3600)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div className="time-input-group" data-unit="mn">
                                                <input
                                                    type="number"
                                                    value={Math.floor((editFormData.duration % 3600) / 60)}
                                                    onChange={(e) => {
                                                        const minutes = parseInt(e.target.value) || 0;
                                                        setEditFormData(prev => ({
                                                            ...prev,
                                                            duration: Math.floor(prev.duration / 3600) * 3600 + 
                                                                minutes * 60 + 
                                                                (prev.duration % 60)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div className="time-input-group" data-unit="s">
                                                <input
                                                    type="number"
                                                    value={editFormData.duration % 60}
                                                    onChange={(e) => {
                                                        const seconds = parseInt(e.target.value) || 0;
                                                        setEditFormData(prev => ({
                                                            ...prev,
                                                            duration: Math.floor(prev.duration / 3600) * 3600 + 
                                                                Math.floor((prev.duration % 3600) / 60) * 60 + 
                                                                seconds
                                                        }));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                <input
                                    type="text"
                                    value={timer.description}
                                    onChange={(e) => 
                                        handleEditTimer(index, timer.duration, e.target.value)
                                    }
                                    className="step-description-input"
                                />
                                <div className="edit-form-actions">
                                            <button onClick={() => handleEditTimer(index)}>Save</button>
                                            <button onClick={() => setEditingIndex(null)}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="step-header">
                                    <span className="step-number">Step {timer.id}</span>
                                        <span className="step-description">{timer.description}</span>
                                </div>
                                <div className="step-controls">
                                    <div className="step-duration-review">
                                        <span className="duration-label">Duration:</span>
                                        <span className="duration-value">
                                            {formatTime(timer.duration)}
                                        </span>
                                    </div>
                                    <button
                                        className="edit-step-button"
                                        onClick={() => handleEditStart(index)}
                                    >
                                        Edit
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <div className="recap-actions">
                <button className="start-cooking-button" onClick={handleStartCooking}>
                    Start Cooking
                </button>
            </div>
        </div>
            ) : (
                /* Timer Interface */
                <>
                <h2 className="recap-title">
                      <span className="bold-text">{recipeName}</span>
                    </h2>
                    <div className="add-timer-section">
                        {showAddTimerForm ? (
                            <div className="add-timer-form">
                                <div className="time-add-inputs">
                                    <div className="time-input-group" data-unit="h">
                                        <input
                                            type="number"
                                            value={newTimerHours}
                                            onChange={(e) => setNewTimerHours(parseInt(e.target.value, 10))}
                                            placeholder="Hours"
                                            min="0"
                                        />
                                    </div>
                                    <div className="time-input-group" data-unit="mn">
                                        <input
                                            type="number"
                                            value={newTimerMinutes}
                                            onChange={(e) => setNewTimerMinutes(parseInt(e.target.value, 10))}
                                            placeholder="Minutes"
                                            min="0"
                                            max="59"
                                        />
                                    </div>
                                    <div className="time-input-group" data-unit="s">
                                        <input
                                            type="number"
                                            value={newTimerSeconds}
                                            onChange={(e) => setNewTimerSeconds(parseInt(e.target.value, 10))}
                                            placeholder="Seconds"
                                            min="0"
                                            max="59"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={newTimerDescription}
                                        onChange={(e) => setNewTimerDescription(e.target.value)}
                                        placeholder="Description (optional)"
                                    />
                                    <button onClick={handleAddTimer}>Add</button>
                                </div>
                            </div>
                        ) : (
                            <button className="add-timer-button" onClick={() => setShowAddTimerForm(true)}>
                                Add Timer
                            </button>
                        )}
                    </div>

                    <div className="timer-container">
                        {allTimersCompleted ? (
                            <div className="well-done-card">
                                <h2>Well Done, and Enjoy!</h2>
                                <button onClick={handleBackToRecipes}>Back to Recipes</button>
                            </div>
                        ) : timers.length > 0 ? (
                            <>
                                {currentTimerIndex > 0 && (
                                    <div className="step-card greyed-step">
                                        <span>Step {timers[currentTimerIndex - 1].id} - {timers[currentTimerIndex - 1].description}</span>
                                        <span className="step-duration">
                                            {formatTime(timers[currentTimerIndex - 1].duration)}
                                        </span>
                                    </div>
                                )}
                                
                                <div className="current-step">
                                    <div className="step-info">
                                        <span>Step {timers[currentTimerIndex].id} - {timers[currentTimerIndex].description}</span>
                                    </div>
                                    <Timer
                                        key={currentTimerIndex}
                                        duration={timers[currentTimerIndex].duration}
                                        description={timers[currentTimerIndex].description}
                                        onNext={handleNext}
                                        onDelete={() => handleDeleteTimer(currentTimerIndex)}
                                        onEdit={(duration, description) =>
                                            handleEditTimer(currentTimerIndex, duration, description)
                                        }
                                        onPrevious={handlePrevious}
                                        isFirst={currentTimerIndex === 0}
                                        isLast={currentTimerIndex === timers.length - 1}
                                        autoStart={currentTimerIndex > 0}
                                        onLetItCook={handleLetItCook}
                                    />
                                </div>

                                {currentTimerIndex < timers.length - 1 && (
                                    <div className="step-card greyed-step">
                                        <span>Step {timers[currentTimerIndex + 1].id} - {timers[currentTimerIndex + 1].description}</span>
                                        <span className="step-duration">
                                            {formatTime(timers[currentTimerIndex + 1].duration)}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p>No timers available.</p>
                        )}

                        {/* Cooking Timers Section */}
                        {cookingTimers.length > 0 && (
                            <div className="cooking-timers-section">
                                <h3 className="cooking-header">Cooking in Progress 🔥</h3>
                                {cookingTimers.map((index) => (
                                    <div key={index} className="cooking-timer-wrapper">
                                        <div className="step-info cooking-step">
                                            {timers[index].id} - {timers[index].description}
                                        </div>
                                        <div className="cooking-timer">
                                            <Timer
                                                key={index}
                                                duration={timers[index].duration}
                                                description={timers[index].description}
                                                onComplete={() => handleCookingTimerComplete(index)}
                                                showControls={true}
                                                autoStart={true}
                                                isCooking={true}
                                                onEdit={(duration, description) => handleEditTimer(index, duration, description)}
                                                onDelete={() => handleCookingTimerComplete(index)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0 ? `${hours}h ${minutes}m ${secs}s` : `${minutes}m ${secs}s`;
};

export default TimerPage;
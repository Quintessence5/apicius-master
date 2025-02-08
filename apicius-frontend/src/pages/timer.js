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

    const handleEditTimer = (index, duration, description) => {
        const updatedTimers = [...timers];
        updatedTimers[index] = { ...updatedTimers[index], duration, description };
        setTimers(updatedTimers);
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

    return (
        <div className="timer-page">
            {recipeName && <h1 className="recipe-name">{recipeName}</h1>}
            <div className="add-timer-section">
                {showAddTimerForm ? (
                    <div className="add-timer-form">
                        <input
                            type="number"
                            value={newTimerHours}
                            onChange={(e) => setNewTimerHours(parseInt(e.target.value, 10))}
                            placeholder="Hours"
                            min="0"
                        />
                        <input
                            type="number"
                            value={newTimerMinutes}
                            onChange={(e) => setNewTimerMinutes(parseInt(e.target.value, 10))}
                            placeholder="Minutes"
                            min="0"
                            max="59"
                        />
                        <input
                            type="number"
                            value={newTimerSeconds}
                            onChange={(e) => setNewTimerSeconds(parseInt(e.target.value, 10))}
                            placeholder="Seconds"
                            min="0"
                            max="59"
                        />
                        <input
                            type="text"
                            value={newTimerDescription}
                            onChange={(e) => setNewTimerDescription(e.target.value)}
                            placeholder="Description (optional)"
                        />
                        <button onClick={handleAddTimer}>Add</button>
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
            </div>
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
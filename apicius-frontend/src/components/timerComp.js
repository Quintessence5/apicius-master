import React, { useState, useEffect, useRef } from 'react';
import Bell from '../assets/sound/bell.mp3';

const Timer = ({
    duration,
    description,
    onNext,
    onDelete,
    onEdit,
    onPrevious,
    isFirst,
    isLast,
    onTimeUpdate,
    autoStart, // Auto-start the timer for all steps
}) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editDuration, setEditDuration] = useState(duration);
    const [editDescription, setEditDescription] = useState(description);
    const intervalRef = useRef(null);

    // Auto-start the timer if `autoStart` is true
    useEffect(() => {
        if (autoStart) {
            startTimer();
        }
    }, [autoStart]);

    // Reset timer when duration changes
    useEffect(() => {
        setTimeLeft(duration);
        setIsRunning(false);
        setIsPaused(false);
    }, [duration]);

    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft((prevTime) => prevTime - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            clearInterval(intervalRef.current);
            playSound(5); // 5 bips when timer ends
            onNext();
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, timeLeft, onNext]);

    useEffect(() => {
        if (timeLeft === 60) {
            playSound(1); // 1 bip at 1 minute
        } else if (timeLeft === 30) {
            playSound(2); // 2 bips at 30 seconds
        } else if (timeLeft === 10) {
            playSound(5); // 5 bips at 10 seconds
        }
    }, [timeLeft]);

    const playSound = (numBips) => {
        for (let i = 0; i < numBips; i++) {
            setTimeout(() => {
                new Audio(Bell).play();
            }, i * 300);
        }
    };

    const startTimer = () => {
        setIsRunning(true);
        setIsPaused(false);
    };

    const pauseTimer = () => {
        setIsRunning(false);
        setIsPaused(true);
    };

    const stopTimer = () => {
        setIsRunning(false);
        setIsPaused(false);
        setTimeLeft(duration);
    };

    const handleEditSave = () => {
        onEdit(editDuration, editDescription);
        setIsEditing(false);
        setTimeLeft(editDuration);
    };

    const handlePrevious = () => {
        stopTimer(); // Stop the current timer
        onPrevious(); // Move to the previous step
    };

    const handleNext = () => {
        stopTimer(); // Stop the current timer
        onNext(); // Move to the next step
    };

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return { hours, minutes, secs };
    };

    const { hours, minutes, secs } = formatTime(timeLeft);

    return (
        <div className="timer">
            {isEditing ? (
                <div className="edit-form">
                    <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(parseInt(e.target.value, 10))}
                        placeholder="Duration (seconds)"
                    />
                    <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                    />
                    <button onClick={handleEditSave}>Save</button>
                    <button onClick={() => setIsEditing(false)}>Cancel</button>
                </div>
            ) : (
                <>
                    <div className="time-display">
                        {hours > 0 && (
                            <>
                                <div className="time-section">
                                    <span className="time-value">{String(hours).padStart(2, '0')}</span>
                                    <span className="time-label">Hours</span>
                                </div>
                                <span className="time-colon">:</span>
                            </>
                        )}
                        <div className="time-section">
                            <span className="time-value">{String(minutes).padStart(2, '0')}</span>
                            <span className="time-label">Minutes</span>
                        </div>
                        <span className="time-colon">:</span>
                        <div className="time-section">
                            <span className="time-value">{String(secs).padStart(2, '0')}</span>
                            <span className="time-label">Seconds</span>
                        </div>
                    </div>
                    <div className="timer-controls">
                        {!isFirst && <button onClick={handlePrevious}>Previous</button>}
                        {!isRunning && !isPaused && (
                            <>
                                <button onClick={startTimer}>Start</button>
                                <button onClick={() => setIsEditing(true)}>Edit</button>
                                <button onClick={onDelete}>Delete</button>
                            </>
                        )}
                        {isRunning && (
                            <>
                                <button onClick={pauseTimer}>Pause</button>
                                <button onClick={stopTimer}>Stop</button>
                            </>
                        )}
                        {isPaused && (
                            <>
                                <button onClick={startTimer}>Resume</button>
                                <button onClick={stopTimer}>Stop</button>
                            </>
                        )}
                        {!isLast && <button onClick={handleNext}>Next</button>}
                    </div>
                </>
            )}
        </div>
    );
};

export default Timer;
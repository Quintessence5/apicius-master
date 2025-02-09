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
    autoStart,
    onLetItCook,
    showControls = true,
    isCooking = false,
    onComplete,
}) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editDuration, setEditDuration] = useState(duration);
    const [editDescription, setEditDescription] = useState(description);
    const [isCompleted, setIsCompleted] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        setTimeLeft(duration);
        setIsRunning(false);
        setIsPaused(false);
        if (autoStart) {
            startTimer();
        }
    }, [duration, autoStart]);

    useEffect(() => {
        if (isRunning && timeLeft > 0) {
          intervalRef.current = setInterval(() => {
            setTimeLeft((prevTime) => prevTime - 1);
          }, 1000);
        } else if (timeLeft === 0) {
          clearInterval(intervalRef.current);
          playSound(5);
          setIsCompleted(true);
          // Only call onNext for regular timers
          if (!isCooking && onNext) {
            onNext();
          }
        }
        return () => clearInterval(intervalRef.current);
      }, [isRunning, timeLeft, onNext, isCooking]);

      useEffect(() => {
        if (timeLeft === 60) {
            playSound(1); 
        } else if (timeLeft === 30) {
            playSound(2);
        } else if (timeLeft === 10) {
            playSound(4); 
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
        stopTimer();
        onPrevious();
    };

    const handleRemoveCompleted = () => {
        if (isCooking && onComplete) {
          onComplete();
        }
        setIsCompleted(false);
        setTimeLeft(duration);
      };

    const handleNext = () => {
        stopTimer();
        onNext();
    };

    const addTime = (seconds) => {
        setTimeLeft((prev) => prev + seconds);
        setIsCompleted(false);
        startTimer();
    };

    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return { hours, minutes, secs };
    };

    const { hours, minutes, secs } = formatTime(timeLeft);

    return (
        <div className={`timer ${isCooking ? 'cooking' : ''}`}>
            {isEditing ? (
              <div className="edit-form">
              <div className="time-edit-inputs">
                <div className="time-input-group" data-unit="h">
                  <input
                    type="number"
                    value={Math.floor(editDuration / 3600)}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value) || 0;
                      const newDuration = hours * 3600 + 
                            (Math.floor(editDuration / 60) % 60) * 60 + 
                            (editDuration % 60);
                      setEditDuration(newDuration);
                    }}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="time-input-group" data-unit="mn">
                  <input
                    type="number"
                    value={Math.floor((editDuration % 3600) / 60)}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 0;
                      const newDuration = Math.floor(editDuration / 3600) * 3600 + 
                            minutes * 60 + 
                            (editDuration % 60);
                      setEditDuration(newDuration);
                    }}
                    placeholder="0"
                    min="0"
                    max="59"
                  />
                </div>
                <div className="time-input-group" data-unit="s">
                  <input
                    type="number"
                    value={editDuration % 60}
                    onChange={(e) => {
                      const seconds = parseInt(e.target.value) || 0;
                      const newDuration = Math.floor(editDuration / 3600) * 3600 + 
                            Math.floor((editDuration % 3600) / 60) * 60 + 
                            seconds;
                      setEditDuration(newDuration);
                    }}
                    placeholder="0"
                    min="0"
                    max="59"
                  />
                </div>
              </div>
              
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Step description"
              />
              
              <div className="edit-form-buttons">
                <button onClick={handleEditSave}>Save</button>
                <button onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            </div>
                        ) : (
                        <>
                    <div className="time-display">
                        {isCompleted ? (
                            <div className="completed-message">Take it out!</div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                    {isCompleted && isCooking && (
                          <div className="completed-controls">
                            <button onClick={() => addTime(60)}>Add 1 min</button>
                            <button onClick={() => addTime(120)}>Add 2 min</button>
                            <button onClick={() => addTime(300)}>Add 5 min</button>
                            <button onClick={handleRemoveCompleted}>Done</button>
                          </div>
                        )}
                    {showControls && !isCompleted && (
                        <div className="timer-controls">
                            {!isCooking && !isFirst && <button onClick={handlePrevious}>Previous</button>}
                            {isCooking && (<button onClick={() => setIsEditing(true)}>Edit</button>)}
    
                    {!isRunning && !isPaused && (
                                <>
                                    <button onClick={startTimer}>Start</button>
                                    {!isCooking && <button onClick={() => setIsEditing(true)}>Edit</button>}
                                    <button onClick={onDelete}>Delete</button>
                                </>
                            )}
                            {isRunning && (
                                <>
                                    <button onClick={pauseTimer}>Pause</button>
                                    <button onClick={stopTimer}>Stop</button>
                                    {onLetItCook && <button className="let-it-cook-btn" onClick={onLetItCook}>Let it cook</button>}
                                </>
                            )}
                            {isPaused && (
                                <>
                                    <button onClick={startTimer}>Resume</button>
                                    <button onClick={stopTimer}>Stop</button>
                                    {onLetItCook && <button className="let-it-cook-btn" onClick={onLetItCook}>Let it cook</button>}
                                </>
                            )}
                            {!isCooking && !isLast && <button onClick={handleNext}>Next</button>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Timer;
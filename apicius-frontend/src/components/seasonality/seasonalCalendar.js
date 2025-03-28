import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import apiClient from '../../services/apiClient';
import Modal from "../../components/modal";

const SeasonalCalendar = () => {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [seasonalData, setSeasonalData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Get month boundaries based on currentDate
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfMonth = (monthStart.getDay() + 6) % 7; // Monday start
  const gridDays = [...Array(firstDayOfMonth).fill(null), ...daysInMonth];

  useEffect(() => {
    const fetchMonthData = async () => {
      try {
        setIsLoading(true);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        const response = await apiClient.get('/seasonality/calendar', {
          params: { year, month }
        });

        // Convert date strings to Date objects and create map
        const dataMap = response.data.reduce((acc, entry) => {
          const dateKey = format(parseISO(entry.date), 'yyyy-MM-dd');
          acc[dateKey] = {
            fruits: entry.fruits || [],
            vegetables: entry.vegetables || []
          };
          return acc;
        }, {});
        
        setSeasonalData(dataMap);
        setErrorMessage('');
      } catch (err) {
        setErrorMessage('Failed to load calendar data');
        console.error('Calendar error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMonthData();
  }, [currentDate]);

  const handleMonthChange = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    });
  };

  return (
    <div className="calendar-container">
      {isLoading && <div className="loading">Loading calendar...</div>}
      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      <div className="calendar-header">
        <button onClick={() => handleMonthChange(-1)}>&lt;</button>
        <h2>{format(currentDate, 'MMMM yyyy')}</h2>
        <button onClick={() => handleMonthChange(1)}>&gt;</button>
      </div>

      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}

        {gridDays.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="calendar-day empty"></div>;
          
          const dateKey = format(date, 'yyyy-MM-dd');
          const data = seasonalData[dateKey] || { fruits: [], vegetables: [] };
          const hasProduce = data.fruits.length > 0 || data.vegetables.length > 0;
          const isCurrentMonth = isSameMonth(date, currentDate);

          return (
            <div 
              key={dateKey}
              className={`calendar-day 
                ${isToday(date) ? 'today' : ''} 
                ${!isCurrentMonth ? 'other-month' : ''}`}
              onClick={() => isCurrentMonth && setSelectedDate(date)}
            >
              <div className="day-number">{format(date, 'd')}</div>
              {hasProduce && <div className="seasonal-indicator" />}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? format(selectedDate, 'MMMM do, yyyy') : ''}
      >
        {selectedDate && (
          <div className="modal-content">
            <div className="produce-section">
              <h4 className="section-title fruits">Fruits</h4>
              {seasonalData[format(selectedDate, 'yyyy-MM-dd')]?.fruits?.length > 0 ? (
                <ul className="produce-list">
                  {seasonalData[format(selectedDate, 'yyyy-MM-dd')].fruits.map(fruit => (
                    <li key={fruit.id} className="produce-item">
                      <div className="produce-icon">
                        {fruit.image_url ? (
                          <img src={fruit.image_url} alt={fruit.name} />
                        ) : (
                          <div className="icon-placeholder"></div>
                        )}
                      </div>
                      <span className="produce-name">{fruit.name}</span>
                      <span className="country-tag">{fruit.country}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="no-items">No seasonal fruits</p>}
            </div>

            <div className="produce-section">
              <h4 className="section-title vegetables">Vegetables</h4>
              {seasonalData[format(selectedDate, 'yyyy-MM-dd')]?.vegetables?.length > 0 ? (
                <ul className="produce-list">
                  {seasonalData[format(selectedDate, 'yyyy-MM-dd')].vegetables.map(vegetable => (
                    <li key={vegetable.id} className="produce-item">
                      <div className="produce-icon">
                        {vegetable.image_url ? (
                          <img src={vegetable.image_url} alt={vegetable.name} />
                        ) : (
                          <div className="icon-placeholder"></div>
                        )}
                      </div>
                      <span className="produce-name">{vegetable.name}</span>
                      <span className="country-tag">{vegetable.country}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="no-items">No seasonal vegetables</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SeasonalCalendar;
import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import apiClient from '../../services/apiClient';
import Modal from "../../components/modal";

const SeasonalCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [seasonalData, setSeasonalData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
  const fetchMonthData = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/api/seasonality/calendar?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`);
      const dataMap = response.data.reduce((acc, item) => {
        const dateKey = format(new Date(item.date), 'yyyy-MM-dd');
        acc[dateKey] = {
          fruits: item.fruits || [],
          vegetables: item.vegetables || []
        };
        return acc;
      }, {});
      setSeasonalData(dataMap);
    } catch (err) {
      setErrorMessage('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  };

  fetchMonthData();
}, [currentDate]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handleMonthChange = (direction) => {
    setCurrentDate(prev => new Date(prev.setMonth(prev.getMonth() + direction)));
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
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}

        {daysInMonth.map(date => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const data = seasonalData[dateKey] || { fruits: [], vegetables: [] };
          
          return (
            <div 
              key={dateKey}
              className={`calendar-day ${isSameMonth(date, currentDate) ? '' : 'other-month'}`}
              onClick={() => handleDateClick(date)}
            >
              <div className="day-number">{format(date, 'd')}</div>
              {(data.fruits?.length || 0) + (data.vegetables?.length || 0) > 0 && (
                <div className="seasonal-indicator"></div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={`Seasonal Produce for ${format(selectedDate, 'MMMM do, yyyy')}`}
      >
        {selectedDate && (
          <div className="modal-content">
            {seasonalData[format(selectedDate, 'yyyy-MM-dd')]?.fruits?.length > 0 ? (
              <>
                <h4>Fruits</h4>
                <ul>
                  {seasonalData[format(selectedDate, 'yyyy-MM-dd')].fruits.map(fruit => (
                    <li key={fruit.id}>{fruit.name}</li>
                  ))}
                </ul>
              </>
            ) : <p>No seasonal fruits</p>}

            {seasonalData[format(selectedDate, 'yyyy-MM-dd')]?.vegetables?.length > 0 ? (
              <>
                <h4>Vegetables</h4>
                <ul>
                  {seasonalData[format(selectedDate, 'yyyy-MM-dd')].vegetables.map(veg => (
                    <li key={veg.id}>{veg.name}</li>
                  ))}
                </ul>
              </>
            ) : <p>No seasonal vegetables</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SeasonalCalendar;
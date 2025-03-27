import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import SeasonalToday from '../components/seasonality/seasonalToday';
import SeasonalCalendar from '../components/seasonality/seasonalCalendar';
import ManageSeasonality from '../components/seasonality/manageSeasonality';
import '../styles/seasonality.css';

const SeasonalityPage = () => {
    return (
      <div className="seasonality-container">
        <div className="seasonality-nav">
          <NavLink 
            to="/seasons" 
            end 
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            Today's Seasonal
          </NavLink>
          <NavLink 
            to="/seasons/calendar" 
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            Calendar
          </NavLink>
          <NavLink 
            to="/seasons/manage" 
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            Manage Seasonality
          </NavLink>
        </div>
        
        <div className="seasonality-content">
          <Routes>
            <Route index element={<SeasonalToday />} />
            <Route path="calendar" element={<SeasonalCalendar />} />
            <Route path="manage" element={<ManageSeasonality />} />
          </Routes>
        </div>
      </div>
    );
  };
  
export default SeasonalityPage;
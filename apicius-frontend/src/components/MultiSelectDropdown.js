import React from 'react';
import '../styles/allRecipes.css';

const MultiSelectDropdown = ({ options, selected, setSelected, placeholder }) => {
  const handleSelect = (e) => {
    const value = e.target.value;
    if (value && !selected.includes(value)) {
      setSelected([...selected, value]);
    }
  };

  return (
    <div className="multi-select">
      <select onChange={handleSelect} value="">
        <option value="" disabled>{placeholder}</option>
        {options.map((option, index) => (
          <option key={index} value={option.name}>{option.name}</option>
        ))}
      </select>
      <div className="selected-tags">
        {selected.map((item, index) => (
          <span 
            key={index} 
            className="tag"
            onClick={() => setSelected(selected.filter(i => i !== item))}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MultiSelectDropdown;
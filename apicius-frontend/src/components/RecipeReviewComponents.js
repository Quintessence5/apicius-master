import React from 'react';

export const MetaField = ({ label, value, onChange, type = "text", placeholder }) => (
  <div className="meta-item">
    <label>{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value) || null : e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

export const SelectField = ({ label, value, onChange, options, required = false }) => (
  <div className="form-group">
    <label>{label} {required && <span className="required">*</span>}</label>
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

export const IngredientSearchInput = ({ value, onChange, onFocus, results, onSelect, searching }) => (
  <div className="ingredient-search-wrapper">
    <input
      type="text"
      placeholder="Search ingredient..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      className="ingredient-search-input"
      autoComplete="off"
    />
    {searching && results.length > 0 && (
      <div className="search-results-dropdown">
        {results.map((result) => (
          <button
            key={result.id}
            className="search-result-item"
            onClick={(e) => {
              e.preventDefault();
              onSelect(result);
            }}
            type="button"
          >
            <span className="result-name">{result.name}</span>
            {result.form && <span className="result-form">({result.form})</span>}
          </button>
        ))}
      </div>
    )}
  </div>
);
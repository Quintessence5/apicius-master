import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import '../../styles/IngredientSubmissions.css';

const IngredientSubmissions = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState({});
  const [searchQuery, setSearchQuery] = useState({});
  const [activeMatch, setActiveMatch] = useState(null);
  const [selectedIngredient, setSelectedIngredient] = useState(null); // { submissionId, ingredientId, ingredientName }

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await apiClient.get('/ingredients/submissions/pending');
      setSubmissions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (submissionId, query) => {
    setSearchQuery(prev => ({ ...prev, [submissionId]: query }));
    if (!query.trim()) {
      setSearchResults(prev => ({ ...prev, [submissionId]: [] }));
      return;
    }
    try {
      const res = await apiClient.get(`/ingredients/suggestions?search=${encodeURIComponent(query)}`);
      setSearchResults(prev => ({ ...prev, [submissionId]: res.data }));
    } catch (err) {
      console.error('Search failed', err);
    }
  };

  const handleMatch = async (submissionId, ingredientId) => {
    try {
      await apiClient.post(`/ingredients/submissions/${submissionId}/match`, { ingredientId });
      alert('Ingredient matched and approved!');
      setActiveMatch(null);
      setSelectedIngredient(null);
      fetchSubmissions();
    } catch (err) {
      alert('Failed to match ingredient');
    }
  };

  const handleCreate = (submission) => {
    navigate('/ingredients/add', {
      state: { initialName: submission.name, fromSubmission: submission.id }
    });
  };

  if (loading) return <div>Loading submissions...</div>;

  return (
    <div className="ingredient-submissions">
      <h2>Pending Ingredient Submissions</h2>
      {submissions.length === 0 ? (
        <p>No pending submissions.</p>
      ) : (
        <table className="submissions-table">
          <thead>
            <tr>
              <th>Original Name</th>
              <th>Category</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map(sub => (
              <tr key={sub.id}>
                <td>
                  <strong>{sub.name}</strong>
                  <span className="original-label"> (extracted name)</span>
                </td>
                <td>{sub.category}</td>
                <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                <td className="actions-cell">
                  {activeMatch === sub.id ? (
  <div className="match-search">
    <div className="search-row">
      <input
        type="text"
        placeholder="Search existing ingredient..."
        value={searchQuery[sub.id] || ''}
        onChange={(e) => handleSearch(sub.id, e.target.value)}
        autoFocus
        className="search-input"
      />
      <button className="close-btn" onClick={() => setActiveMatch(null)}>
        Close
      </button>
    </div>
    {searchResults[sub.id]?.length > 0 && (
      <div className="search-results">
        {searchResults[sub.id].map(result => (
          <button
            key={result.id}
            className="result-item"
            onClick={() => setSelectedIngredient({
              submissionId: sub.id,
              ingredientId: result.id,
              ingredientName: result.name
            })}
          >
            {result.name} {result.form && `(${result.form})`}
          </button>
        ))}
      </div>
    )}
    {selectedIngredient && selectedIngredient.submissionId === sub.id && (
      <div className="selected-preview">
        <span>Selected: {selectedIngredient.ingredientName}</span>
        <div className="selected-actions">
          <button className="ok-btn" onClick={() => handleMatch(selectedIngredient.submissionId, selectedIngredient.ingredientId)}>
            OK
          </button>
          <button className="cancel-btn" onClick={() => setSelectedIngredient(null)}>
            Cancel
          </button>
        </div>
      </div>
    )}
                    </div>
                  ) : (
                    <>
                      <button className="match-btn" onClick={() => setActiveMatch(sub.id)}>
                        Match
                      </button>
                      <button className="create-btn" onClick={() => handleCreate(sub)}>
                        Create
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default IngredientSubmissions;
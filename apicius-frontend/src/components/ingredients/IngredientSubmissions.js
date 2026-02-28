import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';

const IngredientSubmissions = () => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const handleApprove = async (id) => {
        try {
            await apiClient.post(`/ingredients/submissions/${id}/approve`);
            fetchSubmissions(); // refresh
        } catch (err) {
            alert('Approval failed');
        }
    };

    const handleReject = async (id) => {
        try {
            await apiClient.delete(`/ingredients/submissions/${id}/reject`);
            fetchSubmissions();
        } catch (err) {
            alert('Rejection failed');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <h2>Pending Ingredient Submissions</h2>
            {submissions.length === 0 ? (
                <p>No pending submissions.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.map(sub => (
                            <tr key={sub.id}>
                                <td>{sub.name}</td>
                                <td>{sub.category}</td>
                                <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                                <td>
                                    <button onClick={() => handleApprove(sub.id)}>Approve</button>
                                    <button onClick={() => handleReject(sub.id)}>Reject</button>
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
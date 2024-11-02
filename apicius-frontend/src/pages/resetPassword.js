import React, { useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleReset = async (e) => {
        e.preventDefault();
        const token = searchParams.get('token');
        try {
            const response = await axios.post('http://localhost:5010/api/users/reset-password', { token, newPassword });
            setMessage(response.data.message);
        } catch (error) {
            setMessage('Failed to reset password. Please try again.');
        }
    };

    return (
        <div>
            <h2>Reset Password</h2>
            <form onSubmit={handleReset}>
                <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
                <button type="submit">Reset Password</button>
            </form>
            <p>{message}</p>
        </div>
    );
}

export default ResetPassword;

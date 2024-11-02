import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5010/api/users/register', { email, password });
            navigate('/login'); // Redirect to login after registration
        } catch (err) {
            setError('Registration failed. Please try again.');
            console.error('Registration error:', err); // Log the error for debugging
        }
    };

    return (
        <div>
            <h2>Register</h2>
            <form onSubmit={handleRegister}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Register</button>
                {error && <p>{error}</p>} {/* Show error message if registration fails */}
            </form>

            {/* Button to navigate to Login */}
            <p>Already have an account?</p>
            <button onClick={() => navigate('/login')}>Go to Login</button>
        </div>
    );
};

export default Register;

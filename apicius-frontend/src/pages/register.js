import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import logo from '../assets/images/apicius-icon.png';
import googleLogo from '../assets/images/google-icon.png';
import '../styles/loginSignup.css';
import '../App.css';

const Register = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    // Regular Email/Password Registration
    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(
                'http://localhost:5010/api/users/register', 
                { email, password },
                { withCredentials: true } 
            );
    
            const { userId, accessToken, refreshToken } = response.data;
    
            // Store tokens in localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
    
            // Redirect to the registration form with the userId
            navigate('/registerForm', { state: { userId } });
        } catch (err) {
            setError('Registration failed. Please try again.');
            console.error('Registration error:', err);
        }
    };

    return (
        <div className="register-page">
            <header className="headerL">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                <button className="header-btnL" onClick={() => navigate('/login')}>Login</button>
            </header>

            <div className="register-card">
                <h2>Join our tasty community!</h2>
                {/* Social Login Buttons */}
                <div className="social-login-buttons">
                    <button className="google-btn" onClick={() => navigate('/login')}>
                        <img src={googleLogo} alt="Google logo" className="icon" />Sign in with Google
                    </button> 
                </div>

                <p>Or register with your e-mail.</p>

                <form onSubmit={handleRegister} className="register-form">
                    <input
                        type="email"
                        placeholder="E-mail"
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
                    <button type="submit">Create an account</button>
                    {error && <p className="error-message">{error}</p>}
                </form>
                <p>Already have an account?</p>
                <button className="loginR-btn" onClick={() => navigate('/login')}>Login</button>
            </div>
        </div>
    );
};

export default Register;

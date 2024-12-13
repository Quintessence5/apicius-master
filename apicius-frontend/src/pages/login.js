import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import logo from '../assets/images/apicius-icon.png';
import googleLogo from '../assets/images/google-icon.png';
import '../styles/loginSignup.css';
import '../App.css';

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    
    
    // Handles standard email/password login
    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await axios.post(
                'http://localhost:5010/api/users/login',
                { email, password },
                { withCredentials: true } // Include credentials to receive cookies
            );
            setMessage('Login successful! Redirecting...');
            navigate('/dashboard'); // Redirect to the dashboard
        } catch (error) {
            console.error('Login failed:', error);
            setMessage('Login failed. Please check your credentials.');
        }
    };

    return (
        <div className="login-page">
            <header className="headerL">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                <button className="header-btnL" onClick={() => navigate('/register')}>Register</button>
            </header>
            
            <div className="login-card">
                <h2>Great to see you again !</h2>
                
                {/* Social Login Buttons */}
                <div className="social-login-buttons">
                    <button className="google-btn" onClick={() => navigate('/login')}>
                        <img src={googleLogo} alt="Google logo" className="icon" />
                        Login with Google
                        </button> 
                </div>
                
                <p>Or login with your e-mail.</p>
                
                <form className="login-form" onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Enter your e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Enter your Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <Link to="/forgot-password" className="forgot-password">Forgot your password ?</Link>
                    <button type="submit" className="login-btn">Login</button>
                </form>

                {message && <p>{message}</p>}
            </div>
        </div>
    );
}

export default Login;

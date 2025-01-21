import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { auth, googleProvider } from '../config/firebaseConfig';
import { signInWithPopup } from 'firebase/auth';

import logo from '../assets/images/apicius-icon.png';
import googleLogo from '../assets/images/google-icon.png';
import '../styles/loginSignup.css';
import '../App.css';

function Login({ setUser }) { // Add setUser as a prop
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    // Handles standard email/password login
    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(
                'http://localhost:5010/api/users/login',
                { email, password }
            );

            const { userId, accessToken, refreshToken } = response.data;

            // Store tokens in localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('userId', userId);

            // Update user state
            setUser({ userId, accessToken });

            setMessage('Login successful! Redirecting...');
            navigate('/dashboard'); // Redirect to the dashboard
        } catch (error) {
            console.error('Login failed:', error);
            setMessage('Login failed. Please check your credentials.');
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const token = await result.user.getIdToken();

            // Send the Google token to your backend
            const response = await axios.post('http://localhost:5010/api/users/google-login', { token });

            const { userId, accessToken, refreshToken, isNewUser } = response.data;

            // Store tokens and userId in localStorage
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('userId', userId);

            // Update user state
            setUser({ userId, accessToken });

            if (isNewUser) {
                // Redirect new users to the registration form
                navigate('/registerForm', { state: { userId } });
            } else {
                // Redirect existing users to the dashboard
                setMessage('Google login successful! Redirecting...');
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('Google login failed:', error);
            setMessage('Google login failed. Please try again.');
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
                    <button className="google-btn" onClick={handleGoogleLogin}>
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
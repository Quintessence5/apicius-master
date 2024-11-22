import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { auth, googleProvider } from '../config/firebaseConfig';
import { signInWithPopup } from 'firebase/auth';

import logo from '../assets/images/apicius-icon.png';
import googleLogo from '../assets/images/google-icon.png';
import appleLogo from '../assets/images/apple-icon.png';
import facebookLogo from '../assets/images/facebook-icon.png';
import '../styles/loginSignup.css';
import '../App.css';

const Register = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    // Google Sign-in
    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const userData = { token: await user.getIdToken(), email: user.email };
            await axios.post('http://localhost:5010/api/users/google-login', userData);
            navigate('/registerForm');
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            setError('Google Sign-In failed. Please try again.');
        }
    };

    // Regular Email/Password Registration
    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(
                'http://localhost:5010/api/users/register', 
                { email, password },
                { withCredentials: true } // Include cookies in the request
            );
            const { userId } = response.data;
            navigate('/registerForm', { state: { userId } });
        } catch (err) {
            setError('Registration failed. Please try again.');
            console.error('Registration error:', err);
        }
    };

    return (
        <div className="register-page">
            <header className="header">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                <button className="header-btn" onClick={() => navigate('/login')}>Login</button>
            </header>

            <div className="register-card">
                <h2>Join our tasty community!</h2>
                {/* Social Login Buttons */}
                <div className="social-login-buttons">
                    <button className="google-btn" onClick={handleGoogleSignIn}>
                        <img src={googleLogo} alt="Google logo" className="icon" />Google
                    </button>
                    <button className="apple-btn">
                        <img src={appleLogo} alt="Apple logo" className="icon" />Apple
                    </button>
                    <button className="facebook-btn">
                        <img src={facebookLogo} alt="Facebook logo" className="icon" />Facebook
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

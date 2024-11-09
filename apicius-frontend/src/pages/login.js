import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { auth, googleProvider } from '../config/firebaseConfig';
import { signInWithPopup } from 'firebase/auth';

import logo from '../assets/images/apicius-icon.png';
import googleLogo from '../assets/images/google-icon.png';
import appleLogo from '../assets/images/apple-icon.png';
import facebookLogo from '../assets/images/facebook-icon.png';
import '../styles/loginSignup.css';

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    // Google Sign in
    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const token = await user.getIdToken(); // Get Firebase ID token
            // Send the token to your backend to handle further authentication
            await axios.post('http://localhost:5010/api/users/google-login', { token });
            navigate('/dashboard'); // Redirect to dashboard
        } catch (error) {
            console.error('Google Sign-In Error:', error);
        }
    };
    
    // Handles standard email/password login
    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5010/api/users/login', { email, password });
            localStorage.setItem('token', response.data.token);
            setMessage('Login successful! Redirecting...');
            navigate('/dashboard');
        } catch (error) {
            console.error('Login failed:', error);
            setMessage('Login failed. Please check your credentials.');
        }
    };

    return (
        <div className="login-page">
            <header className="header">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                <button className="register-btn" onClick={() => navigate('/register')}>Register</button>
            </header>
            
            <div className="login-card">
                <h2>C’est un plaisir de vous revoir !</h2>
                
                {/* Social Login Buttons */}
                <div className="social-login-buttons">
                    <button className="google-btn" onClick={handleGoogleSignIn}>
                        <img src={googleLogo} alt="Google logo" className="icon" />
                        Google
                        </button>
                    <button className="apple-btn">
                        <img src={appleLogo} alt="Apple logo" className="icon" />
                        Apple
                    </button>
                    <button className="facebook-btn">
                        <img src={facebookLogo} alt="Facebook logo" className="icon" />
                        Facebook
                    </button>    
                </div>
                
                <p>Ou identifiez-vous avec votre adresse e-mail.</p>
                
                <form onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Entrer votre e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Entrer votre Mot de passe"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <Link to="/forgot-password" className="forgot-password">Mot de passe oublié ?</Link>
                    <button type="submit">Se connecter</button>
                </form>

                {message && <p>{message}</p>}
            </div>
        </div>
    );
}

export default Login;

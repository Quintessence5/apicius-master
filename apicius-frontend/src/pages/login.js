import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    // Handles standard email/password login
    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post('http://localhost:5010/api/users/login', {
                email,
                password,
            });

            // Store token and redirect upon success
            localStorage.setItem('token', response.data.token);
            setMessage('Login successful! Redirecting...');
            navigate('/dashboard');
        } catch (error) {
            console.error('Login failed:', error);
            setMessage('Login failed. Please check your credentials.');
        }
    };

    // Handles Google login with Firebase authentication
    const handleGoogleLogin = async () => {
        const auth = getAuth();
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken(); // Get Firebase ID token

            // Send token to backend for verification and additional processing
            const response = await axios.post('http://localhost:5010/api/users/login-google', { token });

            // Store JWT token from server and redirect
            localStorage.setItem('token', response.data.token);
            setMessage('Google Login successful! Redirecting...');
            navigate('/dashboard');
        } catch (error) {
            console.error('Google Login failed:', error);
            setMessage('Google Login failed. Please try again.');
        }
    };

    return (
        <div>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
                <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Login</button>
            </form>
            <button onClick={handleGoogleLogin}>Login with Google</button>

            {/* Display status messages */}
            {message && <p>{message}</p>}

            {/* Links to other actions */}
            <p>
                <Link to="/forgot-password">Forgot Password?</Link>
            </p>
        </div>
    );
}

export default Login;

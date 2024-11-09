import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from '../assets/images/apicius-icon.png';
import googleLogo from '../assets/images/google-icon.png';
import appleLogo from '../assets/images/apple-icon.png';
import facebookLogo from '../assets/images/facebook-icon.png';
import '../styles/loginSignup.css';

const Register = () => {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5010/api/users/register', {email, password, firstName, lastName, birthdate, });
            navigate('/login'); // Redirect to login after registration
        } catch (err) {
            setError('Registration failed. Please try again.');
            console.error('Registration error:', err); // Log the error for debugging
        }
    };

    return (
        
        <div className="login-page">
            <header className="header">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
                <button className="login-btn" onClick={() => navigate('/login')}>Login</button>
                </header>
            
            
            <div className="register-card">
            <h2>Inscrivez-vous sur Apicius</h2>

                {/* Social Login Buttons */}
                <div className="social-login-buttons">
                    <button className="google-btn"><img src={googleLogo} alt="Google logo" className="icon" />Google</button>
                    <button className="apple-btn"><img src={appleLogo} alt="Apple logo" className="icon" />Apple</button>
                    <button className="facebook-btn"><img src={facebookLogo} alt="Facebook logo" className="icon" />Facebook</button>    
                </div>
            
            <p>Ou inscrivez-vous avec votre adresse e-mail.</p>

            <form onSubmit={handleRegister} className="register-form">
                <input
                    type="text"
                    placeholder="Prénom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                />
                <input
                    type="text"
                    placeholder="Nom de famille"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                />
                <input
                    type="date"
                    placeholder="Date de naissance"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    required
                />
                <input
                    type="email"
                    placeholder="E-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Créer un compte</button>
                {error && <p className="error-message">{error}</p>}
            </form>
            <p>Vous avez déjà un compte ?</p>
            <button className="login-btn" onClick={() => navigate('/login')}>Connectez-vous</button>
        </div>
    </div>
    );
};

export default Register;

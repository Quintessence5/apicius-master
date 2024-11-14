
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import logo from '../assets/images/apicius-icon.png';
import '../styles/loginSignup.css';

const RegisterForm = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [originCountry, setOriginCountry] = useState('');
    const [language, setLanguage] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneCode, setPhoneCode] = useState('');
    const [newsletter, setNewsletter] = useState(false);
    const [termsCondition, setTermsCondition] = useState(false);
    const [phoneCodes, setPhoneCodes] = useState([]);
    const [countries, setCountries] = useState([]);
    const [languages, setLanguages] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const countriesResponse = await axios.get('http://localhost:5010/api/country/countries');
                const languagesResponse = await axios.get('http://localhost:5010/api/country/languages');
                const phoneCodesResponse = await axios.get('http://localhost:5010/api/country/phonecodes');

                setCountries(countriesResponse.data);
                setLanguages(languagesResponse.data.map(lang => lang.language));
                setPhoneCodes(phoneCodesResponse.data);
            } catch (error) {
                console.error('Error fetching dropdown data:', error);
            }
        };
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!termsCondition) {
            setError('You must agree to the terms and conditions.');
            return;
        }

        try {
            await axios.post('http://localhost:5010/api/user_profile', {
                username,
                first_name: firstName,
                last_name: lastName,
                birthdate,
                origin_country: originCountry,
                language,
                phone: `${phoneCode}${phone}`,
                newsletter,
                terms_condition: termsCondition
            });
            navigate('/dashboard');
        } catch (err) {
            setError('Submission failed. Please try again.');
            console.error('Error submitting form:', err);
        }
    };

    return (
        <div className="register-page">
            <header className="header">
                <div className="title-container">
                    <img src={logo} alt="Logo" className="logo" />
                    <div className="app-title">Apicius</div>
                </div>
            </header>
            <div className="register-card">
                <h2>Complete Your Profile</h2>
                <form onSubmit={handleSubmit} className="register-form">
                    <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    <input type="date" placeholder="Date of Birth" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} required />

                    <div className="form-group">
                        <select value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} required>
                            <option value="">Select Country of Origin</option>
                            {countries.map((country) => (
                                <option key={country.iso} value={country.name}>{country.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} required>
                            <option value="">Select Preferred Language</option>
                            {languages.map((lang, index) => (
                                <option key={index} value={lang}>{lang}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group phone-group">
                      <div className="phone-field">
                        <select className="phone-code" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} required>
                            <option value="">Code</option>
                            {phoneCodes.map((code, index) => (
                            <option key={index} value={code}>{code}</option>
                            ))}
                        </select>
                    <div className="divider"></div> {/* Divider */}
                    <input className="phone-number" type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                    </div>


                    <label className="checkbox-label">
                        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
                        Subscribe to Newsletter
                    </label>
                    
                    <label className="checkbox-label">
                        <input type="checkbox" checked={termsCondition} onChange={(e) => setTermsCondition(e.target.checked)} required />
                        Agree to Terms and Conditions
                    </label>

                    <button type="submit">Submit Profile</button>
                    {error && <p className="error-message">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default RegisterForm;

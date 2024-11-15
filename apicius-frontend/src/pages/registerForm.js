import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

import logo from '../assets/images/apicius-icon.png';
import '../styles/loginSignup.css';

const RegisterForm = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const userId = state?.userId;

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
    const [error, setError] = useState(null);

    const [countries, setCountries] = useState([]);
    const [languages, setLanguages] = useState([]);
    const [phoneCodes, setPhoneCodes] = useState([]);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);

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
                user_id: userId,
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
            navigate('/dashboard'); // Redirect to dashboard after completion
        } catch (err) {
            setError('Submission failed. Please try again.');
            console.error('Error submitting form:', err);
        }
    };

    const handleCountrySelect = (country) => {
        setOriginCountry(country.name);
        setShowCountryDropdown(false);
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

                    {/* Custom Country Dropdown with Flags */}
                    <div className="form-group">
                        <div className="custom-select" onClick={() => setShowCountryDropdown(!showCountryDropdown)}>
                            <div className="dropdown-option">
                                {originCountry ? originCountry : "Select Country of Origin"}
                            </div>
                            {showCountryDropdown && (
                                <div className="options-container">
                                    {countries.map((country) => (
                                        <div
                                            key={country.iso}
                                            className="countryname-option"
                                            onClick={() => handleCountrySelect(country)}
                                        >
                                            <img src={country.flag} alt={`${country.name} flag`} className="flag-icon" />
                                            {country.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preferred Language Dropdown */}
                    <div className="language-field">
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} required>
                            <option value="">Select Preferred Language</option>
                            {languages.map((lang, index) => (
                                <option key={index} value={lang}>{lang}</option>
                            ))}
                        </select>
                    </div>

                    {/* Phone Code and Number Fields */}
                    <div className="form-group phone-group">
                        <div className="phone-field">
                            <select className="phone-code" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} required>
                                <option value="">Phone code</option>
                                {phoneCodes.map((code, index) => (
                                    <option key={index} value={code}>{code}</option>
                                ))}
                            </select>
                            <div className="divider"></div> {/* Divider */}
                            <input className="phone-number" type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                        </div>
                    </div>

                    {/* Newsletter Subscription */}
                    <label className="checkbox-label">
                        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
                        Subscribe to Newsletter
                    </label>
                    
                    {/* Terms and Conditions */}
                    <label className="checkbox-label">
                        <input type="checkbox" checked={termsCondition} onChange={(e) => setTermsCondition(e.target.checked)} required />
                        Agree to Terms and Conditions
                    </label>

                    {/* Submit Button */}
                    <button type="submit">Submit Profile</button>
                    {error && <p className="error-message">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default RegisterForm;

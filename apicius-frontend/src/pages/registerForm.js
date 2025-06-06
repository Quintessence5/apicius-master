import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiArrowDown } from 'react-icons/fi';

import logo from '../assets/images/apicius-icon.png';
import '../styles/loginSignup.css';
import '../styles/registerForm.css';
import '../styles/datePicker.css';
import '../App.css';

const RegisterForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userId, setUserId] = useState(null);

    // Form state
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthdate, setBirthdate] = useState(null);
    const [originCountry, setOriginCountry] = useState('');
    const [language, setLanguage] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneCode, setPhoneCode] = useState('');
    const [newsletter, setNewsletter] = useState(false);
    const [termsCondition, setTermsCondition] = useState(false);
    const [error, setError] = useState(null);

    // Dropdown data
    const [countries, setCountries] = useState([]);
    const [languages, setLanguages] = useState([]);
    const [phoneCodes, setPhoneCodes] = useState([]);

    // Fetch dropdown data
    useEffect(() => {
        // Set userId from location state
        if (location.state?.userId) {
            setUserId(location.state.userId);
            console.log('UserId set to:', location.state.userId);
        } else {
            console.error('No userId found in location state');
            navigate('/register');
        }

        // Fetch countries, languages, and phone codes
        const fetchData = async () => {
            try {
                const countriesResponse = await axios.get('http://localhost:5010/api/country/countries');
                const languagesResponse = await axios.get('http://localhost:5010/api/country/languages');
                const phoneCodesResponse = await axios.get('http://localhost:5010/api/country/phonecodes');

                setCountries(countriesResponse.data);
                setLanguages(languagesResponse.data.map((lang) => lang.language));
                setPhoneCodes(phoneCodesResponse.data);
            } catch (error) {
                console.error('Error fetching dropdown data:', error);
            }
        };

        fetchData();
    }, [navigate, location.state.userId]);

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
    
        if (!termsCondition) {
            setError('You must agree to the terms and conditions.');
            return;
        }
    
        try {
            const extractedPhoneCode = phoneCode ? phoneCode.split(' ')[1] : '';
            const formattedPhone = phone ? `${extractedPhoneCode} ${phone}` : '';
    
            await axios.post(
                'http://localhost:5010/api/users/user_profile',
                {
                    user_id: userId,
                    username,
                    first_name: firstName,
                    last_name: lastName,
                    birthdate,
                    origin_country: originCountry,
                    language,
                    phone: formattedPhone,
                    newsletter,
                    terms_condition: termsCondition,
                },
                { withCredentials: true }
            );
    
            // Redirect to the dashboard
            navigate('/dashboard', { state: { userId } });
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
            <div className="header-spacer"></div>
            <div className="register-card">
                <h2>Complete Your Profile</h2>
                <form onSubmit={handleSubmit} className="register-form">
                    {/* Username */}
                    <div className="input-container">
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        <label htmlFor="username" className={username ? 'float' : ''}>
                            Username
                        </label>
                    </div>

                    {/* First Name */}
                    <div className="input-container">
                        <input
                            type="text"
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />
                        <label htmlFor="firstName" className={firstName ? 'float' : ''}>
                            First Name
                        </label>
                    </div>

                    {/* Last Name */}
                    <div className="input-container">
                        <input
                            type="text"
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />
                        <label htmlFor="lastName" className={lastName ? 'float' : ''}>
                            Last Name
                        </label>
                    </div>

                    {/* Date of Birth */}
                    <div className="datepicker-container">
                        <ReactDatePicker
                            selected={birthdate}
                            onChange={(date) => setBirthdate(date)}
                            placeholderText=" "
                            className="custom-date-picker"
                            wrapperClassName="responsive-date-picker-wrapper"
                            dateFormat="dd/MM/yyyy"
                            maxDate={new Date()}
                            minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 120))}
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            filterDate={(date) => new Date().getFullYear() - date.getFullYear() >= 10}
                        />
                        <label htmlFor="birthdate" className={birthdate ? 'float' : ''}>
                            Date of Birth
                        </label>
                    </div>

                    {/* Origin Country Dropdown */}
                    <div className="origin-country-container">
                        <div className="custom-select-wrapper">
                            <select
                                value={originCountry}
                                onChange={(e) => setOriginCountry(e.target.value)}
                                required
                                className="custom-origin-select"
                            >
                                <option value="" disabled></option>
                                {countries.map((country) => (
                                    <option key={country.iso} value={country.name}>
                                        {country.name}
                                    </option>
                                ))}
                            </select>
                            <FiArrowDown className="dropdown-icon" />
                            <label htmlFor="originCountry" className={originCountry ? 'float' : ''}>
                                Country of Origin
                            </label>
                        </div>
                    </div>

                    {/* Language Dropdown */}
                    <div className="origin-country-container">
                        <div className="custom-select-wrapper">
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                required
                                className="custom-origin-select"
                            >
                                <option value="" disabled></option>
                                {languages.map((lang, index) => (
                                    <option key={index} value={lang}>
                                        {lang}
                                    </option>
                                ))}
                            </select>
                            <FiArrowDown className="dropdown-icon" />
                            <label htmlFor="language" className={language ? 'float' : ''}>
                                Preferred Language
                            </label>
                        </div>
                    </div>

                    {/* Phone Code and Number Fields */}
                    <div className="phone-group">
                        <div className="phone-field">
                            <select
                                className="phone-code"
                                id="phoneCode"
                                value={phoneCode}
                                onChange={(e) => setPhoneCode(e.target.value)}
                            >
                                <option value="">Phone code</option>
                                {phoneCodes.map((code, index) => (
                                    <option key={index} value={code}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                            <label
                                htmlFor="phoneCode"
                                className={`phone-code-label ${phoneCode ? 'float' : ''}`}
                            >
                                Phone Code
                            </label>
                            <div className="divider"></div>
                            <input
                                className="phone-number"
                                id="phoneNumber"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                            <label
                                htmlFor="phoneNumber"
                                className={`phone-number-label ${phone ? 'float' : ''}`}
                            >
                                Phone number
                            </label>
                        </div>
                    </div>

                    {/* Newsletter Subscription */}
                    <label className="checkbox-labells">
                        <input
                            type="checkbox"
                            checked={newsletter}
                            onChange={(e) => setNewsletter(e.target.checked)}
                        />
                        Subscribe to Newsletter
                    </label>

                    {/* Terms and Conditions */}
                    <label className="checkbox-labells">
                        <input
                            type="checkbox"
                            checked={termsCondition}
                            onChange={(e) => setTermsCondition(e.target.checked)}
                            required
                        />
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
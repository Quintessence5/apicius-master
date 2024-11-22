import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { HiArrowCircleDown } from 'react-icons/hi';

import logo from '../assets/images/apicius-icon.png';
import '../styles/loginSignup.css';
import '../styles/registerForm.css';
import '../styles/datePicker.css';
import '../App.css';

const RegisterForm = () => {
    const navigate = useNavigate();
    useLocation(); // Keep this if you need it for navigation or future features
    const [userId, setUserId] = useState();


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

    const decodeToken = (token) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const decodedPayload = JSON.parse(atob(base64));
            console.log('Decoded Payload:', decodedPayload); // Debug: Log payload
            return decodedPayload;
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    };
    
    useEffect(() => {
            // Debug cookies
            const accessToken = document.cookie
                .split('; ')
                .find((row) => row.startsWith('accessToken='))
                ?.split('=')[1];
        
            if (accessToken) {
                const decoded = decodeToken(accessToken);
                if (decoded?.userId) {
                    setUserId(decoded.userId);
                    console.log('UserId set to:', decoded.userId);
                } else {
                    console.error('Invalid access token');
                    navigate('/register');
                }
            } else {
                console.error('No access token found');
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
        }, [navigate]);        

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!termsCondition) {
            setError('You must agree to the terms and conditions.');
            return;
        }
    
        try {
            const extractedPhoneCode = phoneCode ? phoneCode.split(' ')[1] : '';
            const formattedPhone = phone ? `${extractedPhoneCode}${phone}` : '';
            await axios.post('http://localhost:5010/api/users/user_profile', {
                user_id: userId, // Ensure this is passed correctly
                username,
                first_name: firstName,
                last_name: lastName,
                birthdate,
                origin_country: originCountry,
                language,
                phone: formattedPhone,
                newsletter,
                terms_condition: termsCondition,
                withCredentials: true // Ensure cookies are sent with the request
            });
            navigate('/dashboard', { state: { userId } }); // Redirect after submission keeping the user id
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
                    
                <div className="input-container">
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        />
                    <label htmlFor="username" className={username ? "float" : ""}>
                        Username
                    </label>
                </div>

                <div className="input-container">
                    <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        />
                    <label htmlFor="firstName" className={firstName ? "float" : ""}>
                        First Name
                    </label>
                </div>

                <div className="input-container">
                    <input
                        type="text"
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        />
                    <label htmlFor="lastName" className={lastName ? "float" : ""}>
                    Last Name
                    </label>
                </div>

                <div className="datepicker-container">
                        <ReactDatePicker
                        selected={birthdate}
                        onChange={(date) => setBirthdate(date)}
                        placeholderText=" " // Keeps browser placeholder hidden
                        className="custom-date-picker"
                        wrapperClassName="responsive-date-picker-wrapper"
                        dateFormat="dd/MM/yyyy" // Custom date format
                        maxDate={new Date()} // Disallow future dates
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                    />
                        <label htmlFor="birthdate" className={birthdate ? "float" : ""}>
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
                            <HiArrowCircleDown className="dropdown-icon" />
                            <label
                            htmlFor="originCountry"
                        className={originCountry ? "float" : ""}
                        >
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
                            <option key={index} value={lang}>{lang}</option>
                            ))}
                        </select>
                        <HiArrowCircleDown className="dropdown-icon" />
                        <label
                        htmlFor="language"
                        className={language ? "float" : ""}
                        >
                        Preferred Language
                        </label>
                    </div>
                    </div>

                    {/* Phone Code and Number Fields */}
                    <div className="form-group phone-group">
                        <div className="phone-field">
                            <select className="phone-code" id="phoneCode" placeholder=" " value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} >
                                <option value="">Phone code</option>
                                {phoneCodes.map((code, index) => (
                                    <option key={index} value={code}>{code}</option>
                                ))}
                            </select>
                            <label
                            htmlFor="phoneCode"
                            className={`phone-code-label ${phoneCode ? "float" : ""}`}
                            >
                            Phone Code
                        </label>
                            <div className="divider"></div> {/* Divider */}
                            <input className="phone-number" id="phoneNumber" type="tel" placeholder=" " value={phone} onChange={(e) => setPhone(e.target.value)} />
                            <label htmlFor="phoneNumber" className={`phone-number-label ${phone ? "float" : ""}`}>
                            Phone number
                            </label>
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

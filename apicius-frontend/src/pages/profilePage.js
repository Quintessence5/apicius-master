import React, { useState, useEffect } from "react";
import axios from "axios";
import apiClient from '../services/apiClient';
import Modal from "../components/modal";
import HamburgerMenu from "../components/hamburgerMenu";

import logo from "../assets/images/apicius-icon.png";
import "../App.css";
import "../styles/profilePage.css";
import "../styles/modal.css";

const ProfilePage = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [countries, setCountries] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [phoneCodes, setPhoneCodes] = useState([]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get("http://localhost:5010/api/users/profile", {
        withCredentials: true,
      });
      setUserProfile(response.data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [countriesRes, languagesRes, phoneCodesRes] = await Promise.all([
          axios.get("http://localhost:5010/api/country/countries"),
          axios.get("http://localhost:5010/api/country/languages"),
          axios.get("http://localhost:5010/api/country/phonecodes"),
        ]);
  
        setCountries(countriesRes.data);
        setLanguages(languagesRes.data.map((lang) => lang.language));
        setPhoneCodes(phoneCodesRes.data);
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
      }
    };
  
    fetchDropdownData();

    fetchUserProfile();
  }, []);

  const openModal = (modalType) => {
    setActiveModal(modalType);
    if (modalType === "profile" || modalType === "preferences") {
      setFormData(userProfile || {}); // Pre-fill form with user data
    }
  };  

  const getModalContent = () => {
    switch (activeModal) {
      case "security":
        return {
          type: "Security",
          icon: "🔒",
          text: "Update your email and password securely.",
        };
      case "profile":
        return {
          type: "Profile",
          icon: "👤",
          text: "Edit your name, phone, and other personal information.",
        };
      case "preferences":
        return {
          type: "Preferences",
          icon: "🍴",
          text: "Set your food preferences, dietary restrictions, or allergens.",
        };
      case "achievements":
        return {
          type: "Achievements",
          icon: "🏆",
          text: "Track your achievements and milestones here. Coming soon!",
        };
      default:
        return {};
    }
  };
  const modalContent = getModalContent();

  const closeModal = () => {
    setActiveModal(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const saveChanges = async () => {
    try {
      const updatedData = { ...formData };
      if (formData.phone_code && formData.phone_number) {
        updatedData.phone = `${formData.phone_code}${formData.phone_number}`;
      }
  
      await axios.put("http://localhost:5010/api/users/profile", updatedData, {
        withCredentials: true,
      });
  
      alert("Changes saved successfully!");
      fetchUserProfile(); // Refresh data
      closeModal();
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes.");
    }
  };
  
  const handleLogout = async () => {
    try {
        await apiClient.post('/users/logout');
        clearInterval(window.refreshInterval); // Clear the refresh interval
        window.localStorage.clear(); // Clear storage if used
        window.location.href = '/login';
    } catch (error) {
        console.error('Error logging out:', error);
    }
};

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="header">
        <div className="title-container">
          <img src={logo} alt="Logo" className="logo" />
          <div className="app-title">Apicius</div>
        </div>
        <button className="header-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <HamburgerMenu />

        {/* Profile Cards */}
        <div className="profile-title"><h1>Connexion et sécurité</h1></div>
        <div className="profile-text"><p>
          Gérez les réglages relatifs à la connexion à votre compte, à la sécurité du compte,
          et à la récupération de vos données.
        </p></div>
        <div className="profile-cards">
          <ProfileCard
            title="E-mails & Password"
            description="Update email and password"
            icon="🔒"
            text="Update your email and password securely."
            onClick={() => openModal("security")}
          />
          <ProfileCard
            title="Profile"
            description="Edit your profile details"
            icon="👤"
            text="Edit your name, phone, and other personal information."
            onClick={() => openModal("profile")}
          />
          <ProfileCard
            title="Preferences"
            description="Manage food preferences"
            icon="🍴"
            text="Set your food preferences, dietary restrictions, or allergens."
            onClick={() => openModal("preferences")}
          />
          <ProfileCard
            title="Achievements"
            description="Coming soon"
            icon="🏆"
            text="Track your achievements and milestones here. Coming soon!"
            onClick={() => alert("Coming soon!")}
          />
        </div>

      {/* Modal Component */}
      <Modal
        isOpen={!!activeModal}
        onClose={closeModal}
        title={activeModal ? activeModal.toUpperCase() : ""}
        icon={modalContent.icon}
        text={modalContent.text}
        onSave={saveChanges}
      >
        {activeModal === "security" && (
          <form onSubmit={(e) => e.preventDefault()}>
            <div>
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password || ""}
                onChange={handleInputChange}
              />
            </div>
          </form>
        )}

          {activeModal === "profile" && (
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Username */}
              <div>
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  placeholder={formData.username || ""}
                  onChange={handleInputChange}
                />
              </div>
          
              {/* First Name */}
              <div>
                <label>First Name</label>
                <input
                  type="text"
                  name="first_name"
                  placeholder={formData.first_name || ""}
                  onChange={handleInputChange}
                />
              </div>
          
              {/* Last Name */}
              <div>
                <label>Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  placeholder={formData.last_name || ""}
                  onChange={handleInputChange}
                />
              </div>

               {/* Birthday */}
               <div>
                <label>Birth Date</label>
                <input
                  type="date"
                  name="birthdate"
                  className="modal-date-picker"
                  placeholder={formData.birthdate || ""}
                  onChange={handleInputChange}
                />
              </div>
          
               {/* Origin Country Dropdown */}
              <div className="modal-content">
                <label className="modal-label">Country</label>
                <select
                  name="origin_country"
                  className="modal-country-dropdown"
                  value={formData.origin_country || ""}
                  onChange={handleInputChange}
                >
                  <option value="" disabled>Select your country</option>
                  {countries.map((country) => (
                    <option key={country.iso} value={country.name}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Dropdown */}
              <div className="modal-content-row">
                <label className="modal-label">Language</label>
                <select
                  name="language"
                  className="modal-country-dropdown"
                  value={formData.language || ""}
                  onChange={handleInputChange}
                >
                  <option value="" disabled>Select your language</option>
                  {languages.map((lang, index) => (
                    <option key={index} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              {/* Phone Field with Code Dropdown */}
              <div>
                <label>Phone</label>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <select
                    name="phone_code"
                    className="modal-phonecode"
                    value={formData.phone_code || ""}
                    onChange={handleInputChange}
                  >
                    <option value="">Code</option>
                    {phoneCodes.map((code, index) => (
                      <option key={index} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="phone_number"
                    className="modal-phonez"
                    value={formData.phone_number || ""}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

                <div>
                    <label>Newsletter</label>
                    <select
                        name="newsletter"
                        className="modal-country-dropdown"
                        value={formData.newsletter || ""}
                        onChange={handleInputChange}
                    >
                        <option value="" disabled>Subscribe to our awesome Newsletter ?</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                </div>
          </form>
        )}

        {activeModal === "preferences" && (
          <form onSubmit={(e) => e.preventDefault()}>
            <div>
              <label>Dietary Preferences</label>
              <input
                type="text"
                name="preferences"
                value={formData.preferences || ""}
                onChange={handleInputChange}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

const ProfileCard = ({ title, description, icon, onClick }) => (
  <div className="profile-card" onClick={onClick}>
    <div className="card-content">
      <div className="card-icon">{icon}</div>
      <div className="card-title">{title}</div>
      <div className="card-description">{description}</div>
    </div>
  </div>
);

export default ProfilePage;
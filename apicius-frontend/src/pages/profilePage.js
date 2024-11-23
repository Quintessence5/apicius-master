import React, { useState, useEffect } from "react";
import axios from "axios";
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
    fetchUserProfile();
  }, []);

  const openModal = (modalType) => {
    setActiveModal(modalType);
    if (modalType === "profile" || modalType === "preferences") {
      setFormData(userProfile || {}); // Pre-fill form with existing user data
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
      let endpoint;
      switch (activeModal) {
        case "security":
          endpoint = "http://localhost:5010/api/users/security";
          break;
        case "profile":
          endpoint = "http://localhost:5010/api/users/profile";
          break;
        case "preferences":
          endpoint = "http://localhost:5010/api/users/preferences";
          break;
        default:
          return;
      }
      await axios.put(endpoint, formData, { withCredentials: true });
      alert("Changes saved successfully!");
      fetchUserProfile(); // Refresh user data
      closeModal();
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes.");
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("http://localhost:5010/api/users/logout", {}, { withCredentials: true });
      window.location.href = "/login";
    } catch (error) {
      console.error("Error logging out:", error);
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
            <div>
              <label>Username</label>
              <input
                type="text"
                name="Username"
                value={formData.username || ""}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label>Bio</label>
              <input
                type="text"
                name="bio"
                value={formData.bio || ""}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label>First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name || ""}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label>Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name || ""}
                onChange={handleInputChange}
              />
            </div>
            
            <div>
              <label>Origin Country</label>
              <input
                type="tel"
                name="origin_country"
                value={formData.origin_country || ""}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label>Language</label>
              <input
                type="text"
                name="language"
                value={formData.language || ""}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label>Phone</label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone || ""}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label>Newsletter</label>
              <input
                type="text"
                name="newsletter"
                value={formData.newsletter || ""}
                onChange={handleInputChange}
              />
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

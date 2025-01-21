import React, { useState, useEffect } from "react";
import Modal from "../components/modal";
import apiClient from '../services/apiClient';

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
  const [tags, setTags] = useState({ allergy: [], intolerance: [], diets: [] });
  const [selectedTags, setSelectedTags] = useState({ allergy: [], intolerance: [], diets: [] });
  const [notification, setNotification] = useState({ message: "", visible: false });

  // Function to show notification
  const showNotification = (message) => {
    setNotification({ message, visible: true });
    setTimeout(() => {
      setNotification({ message: "", visible: false });
    }, 3000);
  };

  const fetchUserProfile = async () => {
    try {
      const { data } = await apiClient.get("/users/profile"); // Destructure `data` directly
  
      // Extract phone code and number separately
      const phoneData = data.phone || ""; // Default empty if not provided
      const phoneCode = phoneData.match(/^\+?\d+/)?.[0] || ""; // Extract code part
      const phoneNumber = phoneData.replace(phoneCode, "").trim(); // Extract number part
  
      setUserProfile(data);
      setFormData((prevFormData) => ({
        ...prevFormData,
        email: data.email || "",
        phone_number: phoneNumber, // Phone number
        newsletter: data.newsletter_preferences ? "Yes" : "No", // Map boolean to Yes/No
        origin_country: data.country_of_origin || "",
      }));
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };
  
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
          const [countriesRes, languagesRes, phoneCodesRes, tagsRes] = await Promise.all([
              apiClient.get("/country/countries"), // Use apiClient
              apiClient.get("/country/languages"), // Use apiClient
              apiClient.get("/country/phonecodes"), // Use apiClient
              apiClient.get("/users/tags"), // Use apiClient
          ]);
  
          setCountries(countriesRes.data);
          setLanguages(languagesRes.data.map((lang) => lang.language));
          setPhoneCodes(phoneCodesRes.data);
          setTags(tagsRes.data);
      } catch (error) {
          console.error("Error fetching dropdown data:", error);
      }
  };
    fetchDropdownData();
    fetchUserProfile();
    fetchUserPreferences();
  }, []);

  // Tags from DB
  const fetchUserPreferences = async () => {
    try {
      const { data } = await apiClient.get("/users/preferences"); // Destructure `data` directly
  
      // Initialize selectedTags from database
      setSelectedTags({
        allergy: data.allergy || [],
        intolerance: data.intolerance || [],
        diets: data.diets || [],
      });
  
      // Optional: Log the data for debugging
      console.log("User preferences fetched:", data);
    } catch (error) {
      console.error("Error fetching user preferences:", error);
    }
  };

  // Handle tag selection
  const handleTagChange = (category, tag) => {
    setSelectedTags((prev) => {
        const currentTags = Array.isArray(prev[category]) ? prev[category] : [];
        const isTagSelected = currentTags.includes(tag);

        // Toggle the tag in the category
        const updatedCategoryTags = isTagSelected
            ? currentTags.filter((t) => t !== tag) // Remove if already selected
            : [...currentTags, tag]; // Add if not selected

        return { ...prev, [category]: updatedCategoryTags };
    });
};

  // Modal Logic
  const openModal = (modalType) => {
    setActiveModal(modalType);
  
    if (modalType === "profile" || modalType === "preferences" || modalType === "security") {
      setFormData((prevFormData) => ({
        ...prevFormData,
        ...userProfile, // Ensure userProfile fields, including user_id, are transferred
      }));
    }
  };
  
  const closeModal = () => {
    setActiveModal(null);
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
      case "customization":
          return {
          type: "Customization",
          icon: "🖍️",
          text: "Edit your profile picture and the visibility of your profile.",
        };
        
        case "contributions":
          return {
          type: "Contributions",
          icon: "🧱",
          text: "Track your reviews and manage your submitted recipes.",
        }

      default:
        return {};
    }
  };
  const modalContent = getModalContent();


  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevFormData) => ({
      ...prevFormData,
      [name]: value,
    }));
  };
  
  // Save Changes
  const saveChanges = async () => {
    if (activeModal === "preferences") {
      await savePreferences();
    } else {
      await saveProfileChanges();
  }};
  
  const saveProfileChanges = async () => {
    try {
      // Create a copy of formData to work with
      const updatedData = { ...formData };
  
      // Combine phone code and number, but exclude the country name
      if (formData.phone_code && formData.phone_number) {
        // Extract only the numeric phone code part, excluding the country name
        const extractedPhoneCode = formData.phone_code.match(/\+\d+/)?.[0] || "";
        updatedData.phone = `${extractedPhoneCode}${formData.phone_number}`.trim(); // Combine properly
      }
  
      // Validate password fields
      if (formData.newPassword && formData.confirmNewPassword) {
        if (formData.newPassword !== formData.confirmNewPassword) {
          showNotification("Passwords do not match. Please try again.");
          return;
        }
      }
  
      // Check if user_id exists before proceeding
      if (!updatedData.user_id) {
        console.error("User ID is missing from the payload");
        showNotification("An error occurred: User ID is missing");
        return;
      }
  
      // Send the updated data to the backend using apiClient
      await apiClient.put("/users/profile", updatedData, {
        withCredentials: true,
      });
  
      showNotification("Changes saved successfully!");
      fetchUserProfile(); // Refresh data after saving
      closeModal();
    } catch (error) {
      console.error("Error saving changes:", error);
      showNotification("Failed to save changes.");
    }
  };

  const savePreferences = async () => {
    try {
      // Ensure user_id is included in the payload
      const payload = {
        user_id: userProfile.user_id, // Ensure user ID is taken from the userProfile
        allergy: selectedTags.allergy || [],
        intolerance: selectedTags.intolerance || [],
        diets: selectedTags.diets || [],
      };
  
      console.log("Save Preferences Payload:", payload); // Debug the payload before sending
  
      await apiClient.post("/users/preferences", payload, {
        withCredentials: true,
      });
  
      showNotification("Preferences saved successfully");
      closeModal(); // Close the modal on success
    } catch (error) {
      console.error("Error saving preferences:", error);
      showNotification("Failed to save preferences.");
    }
  };

  return (
    <div className="profile-page">

        {/* Profile Cards */}
        <div className="profile-title"><h1>Profile and Preferences</h1></div>
        <div className="profile-text"><p>
        Manage your account settings, account security, and preferences.
        Customize what you, and other users can see on your profile.
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
            title="Achievement"
            description="Badges & Rewards"
            icon="🏆"
            text="Track your achievements and milestones here. Coming soon!"
            onClick={() => showNotification("Coming soon!")}
          />
          <ProfileCard
            title="Customization"
            description="Visibility for community"
            icon="🖍️"
            text="Edit your profile picture and the visibility of your profile."
            onClick={() => showNotification("Coming soon!")}
          />
          <ProfileCard
            title="Contributions"
            description="Reviews and recipe"
            icon="🧱"
            text="Track your reviews and manage your submitted recipes."
            onClick={() => showNotification("Coming soon!")}
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
                placeholder={formData.email || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label>New Password</label>
              <input
                type="password"
                name="newPassword"
                placeholder="Enter your New Password"
                value={formData.newPassword || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label>Confirm Password</label>
              <input
                type="password"
                name="confirmNewPassword"
                placeholder="Confirm your New Password"
                value={formData.confirmNewPassword || ""}
                onChange={handleInputChange}
              />
            </div>
          </form>
               )}

          {activeModal === "profile" && (
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Bio */}
              <div>
                <label>Bio</label>
                <input
                  type="text"
                  name="bio"
                  placeholder={formData.bio || ""}
                  onChange={handleInputChange}
                />
              </div>
              
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
          
               {/* Origin Country Dropdown */}
              <div className="modal-content">
                <label className="modal-label">Country</label>
                <select
                  name="origin_country"
                  className="modal-country-dropdown"
                  value={formData.origin_country || ""}
                  onChange={handleInputChange}
                  style={{
                    color: formData.origin_country ? "#999" : "#000000",
                  }}>
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
                  style={{
                    color: formData.origin_country ? "#999" : "#000000",
                  }}>
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
                    <option value="">PhoneCode</option>
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
                    placeholder="Enter your phone number"
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
                        style={{
                          color: formData.origin_country ? "#999" : "#000000",
                        }}>
                        <option value="" disabled>Subscribe to our awesome Newsletter ?</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                </div>
              </form>
               )}

          {activeModal === "preferences" && (
                    <form onSubmit={(e) => e.preventDefault()} className="preferences-form">
                        {/* Allergy Section */}
                        <div>
                            <label>Allergy</label>
                            <div className="tag-container">
                                {tags.allergy.map((tag) => (
                                    <div
                                        key={tag}
                                        className={`tag ${selectedTags.allergy.includes(tag) ? "selected" : ""}`}
                                        onClick={() => handleTagChange("allergy", tag)}
                                    >
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Intolerance Section */}
                        <div>
                            <label>Intolerances</label>
                            <div className="tag-container">
                               {tags.intolerance.map((tag) => (
                                    <div
                                        key={tag}
                                        className={`tag ${selectedTags.intolerance.includes(tag) ? "selected" : ""}`}
                                        onClick={() => handleTagChange("intolerance", tag)}
                                    >
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Diets Section */}
                        <div>
                            <label>Diets</label>
                            <div className="tag-container">
                                {tags.diets.map((tag) => (
                                    <div
                                        key={tag}
                                        className={`tag ${selectedTags.diets.includes(tag) ? "selected" : ""}`}
                                        onClick={() => handleTagChange("diets", tag)}
                                    >
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
               )}
                      </Modal>
                    {notification.visible && (
                        <div className="notification-container">
                          <div className="notification">
                             {notification.message}
                        </div>
                        </div>
              )}

                    </div>
                                  );
};

const ProfileCard = ({ title, description, icon, onClick }) => (
  <div className="profile-card" onClick={onClick}>
      <div className="card-content">
          <div className="card-title">{title}</div>
          <div className="card-description">{description}</div>
      </div>
      <div className="card-icon">{icon}</div>
  </div>
);

export default ProfilePage;
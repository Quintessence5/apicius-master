import React, { useState, useEffect } from "react";
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import Modal from "../components/modal";
import apiClient from '../services/apiClient';

import "../App.css";
import "../styles/profilePage.css";
import "../styles/interactions.css";
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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const { 
    data: userRatings,
    isLoading: ratingsLoading,
    error: ratingsError 
  } = useQuery('userRatings', 
    () => apiClient.get(`/interactions/users/${userProfile?.user_id}/ratings`)
      .then(res => res.data),
    { 
      enabled: activeModal === 'contributions' && !!userProfile?.user_id,
      onError: (error) => console.error('Ratings fetch error:', error)
    }
  );
  const { 
    data: userComments,
    isLoading: commentsLoading,
    error: commentsError
  } = useQuery('userComments',
    () => apiClient.get(`/interactions/users/${userProfile?.user_id}/comments`)
      .then(res => res.data),
    { 
      enabled: activeModal === 'contributions' && !!userProfile?.user_id,
      onError: (error) => console.error('Comments fetch error:', error)
    }
  );
  

  // Notification
  const showNotification = (message) => {
    setNotification({ message, visible: true });
    setTimeout(() => {
      setNotification({ message: "", visible: false });
    }, 3000);
  };

  const fetchUserProfile = async () => {
    try {
      const { data } = await apiClient.get("/users/profile");
      console.log('User profile data:', data);
      console.log('User ID:', data.user_id);
      
      // Extract phone code and number separately
      const phoneData = data.phone || ""; 
  
      // Extract the phone code (e.g., +33) and phone number (e.g., 123321123)
      const phoneCodeMatch = phoneData.match(/^\+?\d{1,3}/); // Match the country code (1-3 digits)
      const phoneCode = phoneCodeMatch ? phoneCodeMatch[0] : ""; // Extract the matched code
      const phoneNumber = phoneCode ? phoneData.slice(phoneCode.length).trim() : phoneData; // Extract the number
  
      setUserProfile(data);
      setFormData((prevFormData) => ({
        ...prevFormData,
        email: data.email || "",
        phone_code: phoneCode, // Phone code (e.g., +33)
        phone_number: phoneNumber, // Phone number (e.g., 123321123)
        newsletter: data.newsletter ? "Yes" : "No", // Map boolean to Yes/No
        origin_country: data.origin_country || "",
      }));
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };
  
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
          const [countriesRes, languagesRes, phoneCodesRes, tagsRes] = await Promise.all([
              apiClient.get("/country/countries"),  
              apiClient.get("/country/languages"),  
              apiClient.get("/country/phonecodes"),  
              apiClient.get("/users/tags"),  
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
      const { data } = await apiClient.get("/users/preferences");
  
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
            ? currentTags.filter((t) => t !== tag)
            : [...currentTags, tag];

        return { ...prev, [category]: updatedCategoryTags };
    });
};

  // Modal Logic
  const openModal = (modalType) => {
    setActiveModal(modalType);
  
    if (modalType === "profile" || modalType === "preferences" || modalType === "security") {
      setFormData((prevFormData) => ({
        ...prevFormData,
        ...userProfile,
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
          text: "Review your ratings and comments history",
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
  
      // Validate password fields
    if (updatedData.newPassword || updatedData.confirmNewPassword) {
      if (!updatedData.newPassword || !updatedData.confirmNewPassword) {
        showNotification("Both password fields are required.");
        return;
      }
      if (updatedData.newPassword !== updatedData.confirmNewPassword) {
        showNotification("Passwords do not match. Please try again.");
        return;
      }
    }

      // Combine phone code and number, but exclude the country name
      if (formData.phone_code && formData.phone_number) {
        // Extract only the numeric phone code part, excluding the country name
        const extractedPhoneCode = formData.phone_code.match(/\+\d+/)?.[0] || "";
        updatedData.phone = `${extractedPhoneCode}${formData.phone_number}`.trim();
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
      fetchUserProfile(); 
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
        user_id: userProfile.user_id,
        allergy: selectedTags.allergy || [],
        intolerance: selectedTags.intolerance || [],
        diets: selectedTags.diets || [],
      };
  
      console.log("Save Preferences Payload:", payload);
  
      await apiClient.post("/users/preferences", payload, {
        withCredentials: true,
      });
  
      showNotification("Preferences saved successfully");
      closeModal();
    } catch (error) {
      console.error("Error saving preferences:", error);
      showNotification("Failed to save preferences.");
    }
  };

  const calculateAverage = (ratings) => {
    if (!ratings || ratings.length === 0) return 0;
    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    return (total / ratings.length).toFixed(1);
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
            onClick={() => openModal("contributions")}
          />
        </div>

      {/* Modal Component */}
      <Modal
        isOpen={!!activeModal}
        onClose={closeModal}
        title={activeModal ? activeModal.toUpperCase() : ""}
        icon={modalContent.icon}
        text={modalContent.text}
        onSave={activeModal === 'contributions' ? null : saveChanges} 
        hideSave={activeModal === 'contributions'}
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
  <div className="password-input-container">
    <input
      type={showNewPassword ? "text" : "password"}
      name="newPassword"
      placeholder="Enter your New Password"
      value={formData.newPassword || ""}
      onChange={handleInputChange}
    />
    <span
      className="password-toggle-icon"
      onClick={() => setShowNewPassword(!showNewPassword)}
    >
      {showNewPassword ? "👁️" : "👁️‍🗨️"}
    </span>
  </div>
</div>
<div>
  <label>Confirm Password</label>
  <div className="password-input-container">
    <input
      type={showConfirmPassword ? "text" : "password"}
      name="confirmNewPassword"
      placeholder="Confirm your New Password"
      value={formData.confirmNewPassword || ""}
      onChange={handleInputChange}
    />
    <span
      className="password-toggle-icon"
      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
    >
      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
    </span>
  </div>
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
    <div className="modal-phone-field">
  <label>Phone</label>
  <div className="modal-phone-input-container">
    <select
      name="phone_code"
      className="modal-phonecode"
      value={formData.phone_code || ""}
      onChange={handleInputChange}
    >
      <option value="">PhoneCode</option>
      {phoneCodes.map((code, index) => {
        const phoneCode = code.match(/\+?\d{1,3}/)?.[0] || "";
        return (
          <option key={index} value={phoneCode}>
            {code}
          </option>
        );
      })}
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

    {/* Newsletter Subscription */}
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

{activeModal === "contributions" && (
  <div className="contributions-modal">
    {ratingsLoading || commentsLoading ? (
      <div className="loading-message">Loading contributions...</div>
    ) : (
      <>
        {/* Ratings Section */}
        <div className="contributions-section">
          <div 
            className="section-header"
            onClick={() => setExpandedSection(expandedSection === 'ratings' ? null : 'ratings')}
          >
            <h3>Ratings</h3>
            <div className="stats">
              <span>{userRatings?.length || 0} ratings</span>
              {!expandedSection && (
                <span className="average">
                  Average: {calculateAverage(userRatings)}/5
                </span>
              )}
            </div>
          </div>
          
          {expandedSection === 'ratings' ? (
            <div className="expanded-list">
              {userRatings?.slice(0, 3).map(rating => (
                <div key={rating.id} className="contribution-item">
                  <div className="contribution-header">
                    <Link to={`/recipe/${rating.recipe_id}`} className="expanded-recipe-title">
                      {rating.recipe_title || "Unknown Recipe"}
                    </Link>
                    <time className="contribution-date">
                      {new Date(rating.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </time>
                  </div>
                  <div className="rating-stars">
                    {Array.from({ length: rating.rating }).map((_, i) => (
                      <span key={i} className="star active">★</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="summary">
              {userRatings?.slice(0, 2).map(r => (
                <div key={r.id} className="rating-summary">
                  {r.rating} stars - {r.recipe_title?.substring(0, 20)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="contributions-section">
          <div 
            className="section-header"
            onClick={() => setExpandedSection(expandedSection === 'comments' ? null : 'comments')}
          >
            <h3>Comments</h3>
            <div className="stats">
              <span>{userComments?.length || 0} comments</span>
            </div>
          </div>
          
          {expandedSection === 'comments' ? (
            <div className="expanded-list">
              {userComments?.slice(0, 3).map(comment => (
                <div key={comment.id} className="contribution-item">
                  <div className="contribution-header">
                    <Link to={`/recipe/${comment.recipe_id}`} className="expanded-recipe-title">
                      {comment.recipe_title || "Unknown Recipe"}
                    </Link>
                    <time className="contribution-date">
                      {new Date(comment.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </time>
                  </div>
                  <p className="comment-preview">{comment.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="summary">
              {userComments?.slice(0, 2).map(c => (
                <div key={c.id} className="comment-summary">
                  {c.comment.substring(0, 50)}...
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )}

    {/* Error messages - Moved outside the fragment but inside modal */}
    {ratingsError && (
      <div className="error-message">
        Error loading ratings: {ratingsError.message}
      </div>
    )}
    {commentsError && (
      <div className="error-message">
        Error loading comments: {commentsError.message}
      </div>
    )}
  </div>
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
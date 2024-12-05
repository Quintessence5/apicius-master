import React from "react";

const Modal = ({ isOpen, onClose, title, children, onSave, icon, text }) => {
  if (!isOpen) return null;

  // Close the modal if the click is outside the modal container
  const handleOverlayClick = (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
        {icon && <div className="modal-icon">{icon}</div>}
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        {text && <p className="modal-text">{text}</p>}
        <div className="modal-content">{children}</div>
        <button className="modal-save" onClick={onSave}>
          Save
        </button>
      </div>
    </div>
  );
};

export default Modal;

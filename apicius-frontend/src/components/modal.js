const Modal = ({ isOpen, onClose, title, children, onSave, icon, text }) => {
    if (!isOpen) return null;
  
    return (
      <div className="modal-overlay">
        <div className="modal-container">
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
          <div> {icon && <div className="modal-icon">{icon}</div>}</div>
          <div className="modal-header">
            <h2>{title}</h2>
          </div>
          <div>{text && <p className="modal-text">{text}</p>}</div>
          <div className="modal-content">{children}</div>
          <button className="modal-save" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    );
  };
  
  export default Modal;
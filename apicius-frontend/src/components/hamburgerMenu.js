import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import { AiOutlineClose } from 'react-icons/ai';
import '../styles/hamburgerMenu.css'; // Style file

const HamburgerMenu = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    return (
        <>
            <button className="menu-toggle" onClick={toggleMenu}>
                {isOpen ? <AiOutlineClose /> : <FaBars />}
            </button>
            <div className={`side-menu ${isOpen ? "open" : ""}`}>
                <nav className="menu-links">
                    <ul>
                        <li>
                            <Link to="/dashboard" onClick={toggleMenu}>Dashboard</Link>
                        </li>
                        <li>
                            <Link to="/profile" onClick={toggleMenu}>Profile</Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </>
    );
};

export default HamburgerMenu;

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/hamburgerMenu.css';

const HamburgerMenu = ({ username, handleLogout }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null); // Reference for the menu

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="hamburger-container">
            {/* Trigger Button */}
            <button className="header-btn" onClick={toggleMenu}>
            {username} {/* Display the username */}
            </button>

            {/* Menu */}
            {isOpen && (
                <div ref={menuRef} className="side-menu">
                    <nav className="menu-links">
                        <ul>
                            <li>
                                <Link to="/dashboard" onClick={toggleMenu}>
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link to="/add-recipe" onClick={toggleMenu}>
                                    Add Recipe
                                </Link>
                            </li>
                            <li>
                                <Link to="/all-recipes" onClick={toggleMenu}>
                                    Recipes
                                </Link>
                            </li>
                            <li>
                                <Link to="/timer" onClick={toggleMenu}>
                                    Timer
                                </Link>
                            </li>
                            <li>
                                <Link to="/profile" onClick={toggleMenu}>
                                    Preferences
                                </Link>
                            </li>
                            <li>
                                <button
                                    className="menu-logout"
                                    onClick={() => {
                                        handleLogout();
                                        toggleMenu();
                                    }}
                                >
                                    Logout
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            )}
        </div>
    );
};

export default HamburgerMenu;

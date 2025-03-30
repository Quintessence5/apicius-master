import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/interactions.css';
import defaultAvatar from '../assets/images/default-avatar.jpg';

const CommentSection = ({ recipeId, userId, userRole }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState('');

  // Fetch comments when component mounts
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await axios.get(`/api/interactions/comments/${recipeId}`);
        setComments(response.data);
      } catch (err) {
        setError('Failed to load comments');
      }
    };
    fetchComments();
  }, [recipeId]);

  // Handle comment submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      alert('Please login to comment');
      return;
    }

    try {
      const response = await axios.post(
        `/api/interactions/comments/${recipeId}`,
        { comment: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setComments([response.data, ...comments]);
      setNewComment('');
    } catch (err) {
      setError('Failed to post comment');
    }
  };

  // Handle comment deletion
  const handleDelete = async (commentId) => {
    const token = localStorage.getItem('accessToken');
    
    try {
      const response = await axios.delete(`/api/interactions/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (response.status === 403) {
        alert('You are not authorized to delete this comment');
        return;
      }
  
      setComments(comments.filter(comment => comment.id !== commentId));
    } catch (err) {
      if (err.response?.status === 403) {
        alert('You are not authorized to delete this comment');
      } else {
        setError('Failed to delete comment');
      }
    }
  };

  return (
    <div className="comment-section">
      <h3>Comments ({comments.length})</h3>
      
      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="comment-form">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write your comment..."
          required
        />
        <button type="submit" className="comment-submit-btn">Post Comment</button>
      </form>

      {/* Comments List */}
      {error && <p className="error-message">{error}</p>}
      <div className="comments-list">
        {comments.map(comment => (
          <div key={comment.id} className="comment-card">
            <div className="comment-header">
              <img 
                src={comment.profile_picture || defaultAvatar}
                alt={comment.username || 'User'}
                className="comment-avatar"
              />
              <div className="comment-user-info">
    <h4 className="comment-username">{comment.username}</h4>
    <span className="comment-date">
      {new Date(comment.created_at).toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })}
    </span>
  </div>
</div>
            <p className="comment-text">{comment.comment}</p>
            
            {/* Delete Button */}
            {(userId === comment.user_id || userRole === 'admin') && (
              <button 
                onClick={() => handleDelete(comment.id)}
                className="delete-comment-btn"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentSection;
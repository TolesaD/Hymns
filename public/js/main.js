// Enhanced Main JavaScript - Hymns Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Hymns App Initialized');
    
    initializeFlashMessages();
    initializeSearch();
    initializeFavorites();
    initializeAudioPlayers();
    initializeNewsletter();
    initializeCommentSystem();
    initializeNotificationSystem();
    initializePWA();
    initializeRatingSystem();
    
    // Check for new content periodically
    startContentPolling();
});

// =============================================
// FLASH MESSAGES MANAGEMENT
// =============================================

function initializeFlashMessages() {
    // Close flash messages
    const flashCloseButtons = document.querySelectorAll('.alert-close, .flash-close');
    flashCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            const alert = this.closest('.alert');
            if (alert) {
                alert.style.opacity = '0';
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.remove();
                    }
                }, 300);
            }
        });
    });
    
    // Auto-hide flash messages after 5 seconds with better animation
    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (message.parentNode) {
                    message.remove();
                }
            }, 300);
        }, 5000);
        
        // Pause auto-hide on hover
        message.addEventListener('mouseenter', () => {
            message.style.animationPlayState = 'paused';
        });
        
        message.addEventListener('mouseleave', () => {
            message.style.animationPlayState = 'running';
        });
    });
}

// =============================================
// SEARCH FUNCTIONALITY
// =============================================

function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    
    if (searchInput && searchSuggestions) {
        let timeoutId;
        let currentQuery = '';
        
        searchInput.addEventListener('input', function() {
            clearTimeout(timeoutId);
            const query = this.value.trim();
            currentQuery = query;
            
            if (query.length < 2) {
                hideSearchSuggestions();
                return;
            }
            
            // Show loading state
            searchSuggestions.innerHTML = `
                <div class="suggestion-item loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Searching...</span>
                </div>
            `;
            searchSuggestions.style.display = 'block';
            
            timeoutId = setTimeout(() => {
                fetchSearchSuggestions(query);
            }, 300);
        });
        
        // Handle keyboard navigation
        searchInput.addEventListener('keydown', function(e) {
            const items = searchSuggestions.querySelectorAll('.suggestion-item:not(.loading)');
            const currentActive = searchSuggestions.querySelector('.suggestion-item.active');
            let activeIndex = Array.from(items).indexOf(currentActive);
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    activeIndex = (activeIndex + 1) % items.length;
                    setActiveSuggestion(items, activeIndex);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    activeIndex = (activeIndex - 1 + items.length) % items.length;
                    setActiveSuggestion(items, activeIndex);
                    break;
                    
                case 'Enter':
                    if (currentActive) {
                        e.preventDefault();
                        currentActive.click();
                    }
                    break;
                    
                case 'Escape':
                    hideSearchSuggestions();
                    break;
            }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
                hideSearchSuggestions();
            }
        });
    }
}

function setActiveSuggestion(items, index) {
    items.forEach(item => item.classList.remove('active'));
    if (items[index]) {
        items[index].classList.add('active');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

function hideSearchSuggestions() {
    const searchSuggestions = document.getElementById('search-suggestions');
    if (searchSuggestions) {
        searchSuggestions.style.display = 'none';
    }
}

async function fetchSearchSuggestions(query) {
    try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error('Search failed');
        
        const suggestions = await response.json();
        displaySearchSuggestions(suggestions, query);
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        displaySearchError();
    }
}

function displaySearchSuggestions(suggestions, query) {
    const searchSuggestions = document.getElementById('search-suggestions');
    
    if (!searchSuggestions) return;
    
    if (suggestions.length === 0) {
        searchSuggestions.innerHTML = `
            <div class="suggestion-item no-results">
                <i class="fas fa-search"></i>
                <span>No results found for "<strong>${query}</strong>"</span>
            </div>
        `;
    } else {
        searchSuggestions.innerHTML = suggestions.map(suggestion => 
            `<a href="/hymns/${suggestion._id}" class="suggestion-item" data-hymn-id="${suggestion._id}">
                <i class="fas fa-music"></i>
                <div class="suggestion-details">
                    <div class="suggestion-title">${escapeHtml(suggestion.title)}</div>
                    <div class="suggestion-meta">
                        ${suggestion.hymnLanguage || suggestion.language} • ${suggestion.category}
                        ${suggestion.rating ? ` • ⭐ ${suggestion.rating}` : ''}
                    </div>
                </div>
            </a>`
        ).join('');
    }
    
    searchSuggestions.style.display = 'block';
}

function displaySearchError() {
    const searchSuggestions = document.getElementById('search-suggestions');
    if (searchSuggestions) {
        searchSuggestions.innerHTML = `
            <div class="suggestion-item error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Search temporarily unavailable</span>
            </div>
        `;
        searchSuggestions.style.display = 'block';
    }
}

// =============================================
// FAVORITES SYSTEM
// =============================================

function initializeFavorites() {
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    
    favoriteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const hymnId = this.getAttribute('data-hymn-id');
            const hymnTitle = this.getAttribute('data-hymn-title') || 'this hymn';
            toggleFavorite(hymnId, this, hymnTitle);
        });
    });
}

async function toggleFavorite(hymnId, button, hymnTitle = 'this hymn') {
    try {
        // Show loading state
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
        
        const response = await fetch(`/users/favorites/${hymnId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const icon = button.querySelector('i');
            
            if (result.action === 'added') {
                icon.className = 'fas fa-heart favorite-active';
                showNotification(`❤️ Added "${hymnTitle}" to favorites`, 'success');
                
                // Add animation
                button.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 300);
            } else {
                icon.className = 'far fa-heart';
                showNotification(`💔 Removed "${hymnTitle}" from favorites`, 'info');
            }
            
            // Update favorite count if exists
            updateFavoriteCount(hymnId, result.action);
        } else {
            showNotification(result.error || 'Please log in to manage favorites', 'error');
            button.innerHTML = originalHTML;
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showNotification('Error updating favorites. Please try again.', 'error');
        button.innerHTML = originalHTML;
    } finally {
        button.disabled = false;
    }
}

function updateFavoriteCount(hymnId, action) {
    const favoriteCount = document.querySelector(`[data-favorite-count="${hymnId}"]`);
    if (favoriteCount) {
        let currentCount = parseInt(favoriteCount.textContent) || 0;
        currentCount = action === 'added' ? currentCount + 1 : Math.max(0, currentCount - 1);
        favoriteCount.textContent = currentCount;
    }
}

// =============================================
// COMMENT & RATING SYSTEM
// =============================================

function initializeCommentSystem() {
    initializeCommentForm();
    initializeRatingDisplay();
    initializeCommentActions();
}

function initializeCommentForm() {
    const commentForm = document.querySelector('form[action*="/comments"]');
    if (!commentForm) return;
    
    const ratingInputs = commentForm.querySelectorAll('input[name="rating"], select[name="rating"]');
    const contentInput = commentForm.querySelector('textarea[name="content"]');
    
    // Enhanced rating requirement system
    ratingInputs.forEach(input => {
        const container = input.closest('.rating-container') || input.parentElement;
        
        // Create requirement message
        const requirementMsg = document.createElement('div');
        requirementMsg.className = 'rating-requirement-message';
        requirementMsg.innerHTML = `
            <small style="color: #e74c3c; display: flex; align-items: center; gap: 5px;">
                <i class="fas fa-exclamation-circle"></i>
                <span>Rating is required before commenting</span>
            </small>
        `;
        requirementMsg.style.marginTop = '8px';
        requirementMsg.style.display = 'none';
        
        if (container) {
            container.appendChild(requirementMsg);
        }
        
        // Real-time validation
        input.addEventListener('change', function() {
            validateRatingInput(this, requirementMsg);
        });
        
        // Initialize validation
        validateRatingInput(input, requirementMsg);
    });
    
    // Character counter for comment content
    if (contentInput) {
        const charCounter = document.createElement('div');
        charCounter.className = 'char-counter';
        charCounter.style.fontSize = '0.8rem';
        charCounter.style.color = '#666';
        charCounter.style.textAlign = 'right';
        charCounter.style.marginTop = '5px';
        
        contentInput.parentNode.appendChild(charCounter);
        
        contentInput.addEventListener('input', function() {
            const length = this.value.length;
            const maxLength = this.getAttribute('maxlength') || 1000;
            charCounter.textContent = `${length}/${maxLength} characters`;
            
            if (length > maxLength * 0.8) {
                charCounter.style.color = '#e74c3c';
            } else if (length > maxLength * 0.6) {
                charCounter.style.color = '#f39c12';
            } else {
                charCounter.style.color = '#666';
            }
        });
        
        // Trigger initial count
        contentInput.dispatchEvent(new Event('input'));
    }
    
    // Form submission validation
    commentForm.addEventListener('submit', function(e) {
        let hasValidRating = false;
        
        ratingInputs.forEach(input => {
            if (input.value && input.value !== '0') {
                hasValidRating = true;
            }
        });
        
        if (!hasValidRating) {
            e.preventDefault();
            showNotification('⭐ Please rate the hymn (1-5 stars) before submitting your comment', 'error');
            
            // Highlight rating inputs
            ratingInputs.forEach(input => {
                input.style.borderColor = '#e74c3c';
                input.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
                
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.style.boxShadow = '';
                }, 2000);
            });
            
            // Scroll to rating section
            const ratingSection = commentForm.querySelector('.rating-container') || ratingInputs[0];
            if (ratingSection) {
                ratingSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
            
            return false;
        }
        
        // Validate content
        if (contentInput && (!contentInput.value.trim() || contentInput.value.trim().length < 2)) {
            e.preventDefault();
            showNotification('📝 Please write a meaningful comment (at least 2 characters)', 'error');
            contentInput.focus();
            return false;
        }
        
        // Show loading state
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            submitBtn.disabled = true;
        }
    });
}

function validateRatingInput(input, requirementMsg) {
    if (!input.value || input.value === '0') {
        requirementMsg.style.display = 'flex';
        input.style.borderColor = '#e74c3c';
    } else {
        requirementMsg.style.display = 'none';
        input.style.borderColor = '#27ae60';
        
        // Show rating confirmation
        const stars = '⭐'.repeat(parseInt(input.value));
        const ratingContainer = input.closest('.rating-container');
        if (ratingContainer) {
            let confirmation = ratingContainer.querySelector('.rating-confirmation');
            if (!confirmation) {
                confirmation = document.createElement('div');
                confirmation.className = 'rating-confirmation';
                confirmation.style.marginTop = '5px';
                ratingContainer.appendChild(confirmation);
            }
            confirmation.innerHTML = `
                <small style="color: #27ae60;">
                    <i class="fas fa-check-circle"></i>
                    ${stars} You rated this ${input.value} star${input.value > 1 ? 's' : ''}
                </small>
            `;
        }
    }
}

function initializeRatingDisplay() {
    // Initialize star rating displays
    const ratingDisplays = document.querySelectorAll('[data-rating]');
    
    ratingDisplays.forEach(display => {
        const rating = parseFloat(display.getAttribute('data-rating'));
        if (!isNaN(rating) && rating > 0) {
            display.innerHTML = generateStarRating(rating);
        }
    });
}

function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return '★'.repeat(fullStars) + 
           (hasHalfStar ? '½' : '') + 
           '☆'.repeat(emptyStars) +
           ` <small>(${rating.toFixed(1)})</small>`;
}

function initializeCommentActions() {
    // Edit comment buttons
    const editButtons = document.querySelectorAll('.edit-comment-btn');
    editButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const commentId = this.getAttribute('data-comment-id');
            enableCommentEdit(commentId);
        });
    });
    
    // Delete comment buttons
    const deleteButtons = document.querySelectorAll('.delete-comment-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const commentId = this.getAttribute('data-comment-id');
            const hymnId = this.getAttribute('data-hymn-id');
            confirmDeleteComment(commentId, hymnId);
        });
    });
}

function enableCommentEdit(commentId) {
    const commentElement = document.querySelector(`[data-comment="${commentId}"]`);
    const contentElement = commentElement.querySelector('.comment-content');
    const currentContent = contentElement.textContent.trim();
    
    // Replace with textarea
    const textarea = document.createElement('textarea');
    textarea.value = currentContent;
    textarea.className = 'form-control';
    textarea.style.minHeight = '100px';
    textarea.maxLength = 1000;
    
    contentElement.innerHTML = '';
    contentElement.appendChild(textarea);
    
    // Show edit controls
    const editControls = document.createElement('div');
    editControls.className = 'edit-controls';
    editControls.style.marginTop = '10px';
    editControls.innerHTML = `
        <button class="btn btn-sm btn-success save-comment" data-comment-id="${commentId}">
            <i class="fas fa-check"></i> Save
        </button>
        <button class="btn btn-sm btn-secondary cancel-edit" data-comment-id="${commentId}">
            <i class="fas fa-times"></i> Cancel
        </button>
        <small class="char-count" style="margin-left: 10px;">${currentContent.length}/1000</small>
    `;
    
    contentElement.appendChild(editControls);
    
    // Character counter
    textarea.addEventListener('input', function() {
        const count = editControls.querySelector('.char-count');
        count.textContent = `${this.value.length}/1000`;
    });
    
    // Save handler
    editControls.querySelector('.save-comment').addEventListener('click', function() {
        saveCommentEdit(commentId, textarea.value);
    });
    
    // Cancel handler
    editControls.querySelector('.cancel-edit').addEventListener('click', function() {
        cancelCommentEdit(commentId, currentContent);
    });
}

async function saveCommentEdit(commentId, newContent) {
    try {
        const response = await fetch(`/hymns/${getCurrentHymnId()}/comments/${commentId}/edit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: newContent })
        });
        
        if (response.ok) {
            showNotification('Comment updated successfully!', 'success');
            location.reload(); // Reload to show updated comment
        } else {
            throw new Error('Update failed');
        }
    } catch (error) {
        console.error('Error updating comment:', error);
        showNotification('Error updating comment. Please try again.', 'error');
    }
}

function cancelCommentEdit(commentId, originalContent) {
    const commentElement = document.querySelector(`[data-comment="${commentId}"]`);
    const contentElement = commentElement.querySelector('.comment-content');
    contentElement.textContent = originalContent;
}

function confirmDeleteComment(commentId, hymnId) {
    if (confirm('Are you sure you want to delete your comment? This action cannot be undone.')) {
        deleteComment(commentId, hymnId);
    }
}

async function deleteComment(commentId, hymnId) {
    try {
        const response = await fetch(`/hymns/${hymnId}/comments/${commentId}/delete`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('Comment deleted successfully', 'success');
            location.reload(); // Reload to reflect changes
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        showNotification('Error deleting comment. Please try again.', 'error');
    }
}

// =============================================
// RATING SYSTEM
// =============================================

function initializeRatingSystem() {
    // Quick rating buttons
    const quickRatingButtons = document.querySelectorAll('.quick-rating-btn');
    quickRatingButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const rating = this.getAttribute('data-rating');
            submitQuickRating(rating);
        });
    });
    
    // Star rating hover effects
    const starRatings = document.querySelectorAll('.star-rating');
    starRatings.forEach(rating => {
        const stars = rating.querySelectorAll('.star');
        stars.forEach((star, index) => {
            star.addEventListener('mouseenter', () => {
                highlightStars(stars, index);
            });
            
            star.addEventListener('click', () => {
                const ratingValue = index + 1;
                rating.setAttribute('data-rating', ratingValue);
                stars.forEach(s => s.classList.remove('active'));
                highlightStars(stars, index);
            });
        });
        
        rating.addEventListener('mouseleave', () => {
            const currentRating = parseInt(rating.getAttribute('data-rating')) || 0;
            highlightStars(stars, currentRating - 1);
        });
    });
}

function highlightStars(stars, upToIndex) {
    stars.forEach((star, index) => {
        star.classList.toggle('active', index <= upToIndex);
    });
}

async function submitQuickRating(rating) {
    if (!isUserLoggedIn()) {
        showNotification('Please log in to rate hymns', 'error');
        return;
    }
    
    try {
        const hymnId = getCurrentHymnId();
        const response = await fetch(`/hymns/${hymnId}/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rating: rating })
        });
        
        if (response.ok) {
            showNotification(`⭐ Thank you for your ${rating}-star rating!`, 'success');
            setTimeout(() => {
                location.reload(); // Reload to show updated rating
            }, 1500);
        } else {
            const result = await response.json();
            showNotification(result.error || 'Error submitting rating', 'error');
        }
    } catch (error) {
        console.error('Error submitting rating:', error);
        showNotification('Error submitting rating. Please try again.', 'error');
    }
}

// =============================================
// NOTIFICATION SYSTEM
// =============================================

function initializeNotificationSystem() {
    // Check for new hymns every 2 minutes
    setInterval(checkForNewHymns, 120000);
    
    // Initial check after page load
    setTimeout(checkForNewHymns, 10000);
}

async function checkForNewHymns() {
    try {
        const response = await fetch('/api/notifications/check-new-hymns');
        const data = await response.json();
        
        if (response.ok && data.hasNewHymns) {
            showNotification(
                `🎵 ${data.newHymnsCount} new hymn${data.newHymnsCount > 1 ? 's' : ''} added recently!`, 
                'info',
                8000
            );
        }
    } catch (error) {
        console.error('Error checking for new hymns:', error);
    }
}

// =============================================
// AUDIO PLAYER SYSTEM
// =============================================

function initializeAudioPlayers() {
    const audioPlayers = document.querySelectorAll('.audio-player');
    
    audioPlayers.forEach(player => {
        const audio = player.querySelector('audio');
        if (!audio) return;
        
        initializeSingleAudioPlayer(player, audio);
    });
}

function initializeSingleAudioPlayer(player, audio) {
    const playBtn = player.querySelector('.play-btn');
    const progressBar = player.querySelector('.progress-bar');
    const progress = player.querySelector('.progress');
    const currentTime = player.querySelector('.current-time');
    const duration = player.querySelector('.duration');
    const volumeBtn = player.querySelector('.volume-btn');
    const volumeSlider = player.querySelector('.volume-slider');
    
    // Play/Pause
    if (playBtn) {
        playBtn.addEventListener('click', function() {
            togglePlayPause(audio, this);
        });
    }
    
    // Progress bar
    if (progressBar && progress) {
        progressBar.addEventListener('click', function(e) {
            seekAudio(audio, e, this);
        });
    }
    
    // Volume control
    if (volumeBtn && volumeSlider) {
        volumeBtn.addEventListener('click', function() {
            toggleMute(audio, this);
        });
        
        volumeSlider.addEventListener('input', function() {
            setVolume(audio, this.value);
        });
    }
    
    // Audio event listeners
    audio.addEventListener('timeupdate', function() {
        updateProgress(this, progress, currentTime);
    });
    
    audio.addEventListener('loadedmetadata', function() {
        if (duration) duration.textContent = formatTime(this.duration);
    });
    
    audio.addEventListener('ended', function() {
        resetPlayer(playBtn, progress, currentTime);
    });
    
    audio.addEventListener('volumechange', function() {
        updateVolumeUI(this, volumeBtn, volumeSlider);
    });
}

function togglePlayPause(audio, button) {
    if (audio.paused) {
        audio.play().then(() => {
            button.innerHTML = '<i class="fas fa-pause"></i>';
            button.classList.add('playing');
        }).catch(error => {
            console.error('Error playing audio:', error);
            showNotification('Error playing audio. Please try again.', 'error');
        });
    } else {
        audio.pause();
        button.innerHTML = '<i class="fas fa-play"></i>';
        button.classList.remove('playing');
    }
}

function seekAudio(audio, event, progressBar) {
    const clickX = event.offsetX;
    const width = progressBar.offsetWidth;
    const duration = audio.duration;
    
    audio.currentTime = (clickX / width) * duration;
}

function toggleMute(audio, button) {
    audio.muted = !audio.muted;
    button.innerHTML = audio.muted ? 
        '<i class="fas fa-volume-mute"></i>' : 
        '<i class="fas fa-volume-up"></i>';
}

function setVolume(audio, volume) {
    audio.volume = volume / 100;
}

function updateProgress(audio, progress, currentTime) {
    if (progress) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${percent}%`;
    }
    if (currentTime) {
        currentTime.textContent = formatTime(audio.currentTime);
    }
}

function updateVolumeUI(audio, volumeBtn, volumeSlider) {
    if (volumeBtn) {
        volumeBtn.innerHTML = audio.muted ? 
            '<i class="fas fa-volume-mute"></i>' : 
            audio.volume < 0.5 ? 
            '<i class="fas fa-volume-down"></i>' : 
            '<i class="fas fa-volume-up"></i>';
    }
    if (volumeSlider) {
        volumeSlider.value = audio.volume * 100;
    }
}

function resetPlayer(playBtn, progress, currentTime) {
    if (playBtn) {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.classList.remove('playing');
    }
    if (progress) progress.style.width = '0%';
    if (currentTime) currentTime.textContent = '0:00';
}

// =============================================
// NEWSLETTER SYSTEM
// =============================================

function initializeNewsletter() {
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const emailInput = this.querySelector('input[type="email"]');
            const email = emailInput ? emailInput.value.trim() : '';
            subscribeNewsletter(email, this);
        });
    }
}

async function subscribeNewsletter(email, form) {
    if (!isValidEmail(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    try {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
        submitBtn.disabled = true;
        
        const response = await fetch('/api/newsletter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('🎉 Successfully subscribed to newsletter!', 'success');
            if (form) form.reset();
        } else {
            showNotification(result.error || 'Subscription failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        showNotification('Network error. Please check your connection and try again.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// =============================================
// PWA FUNCTIONALITY
// =============================================

function initializePWA() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registered:', registration);
                })
                .catch(registrationError => {
                    console.log('❌ Service Worker registration failed:', registrationError);
                });
        });
    }
}

// =============================================
// CONTENT POLLING
// =============================================

function startContentPolling() {
    // Check for updates every 5 minutes
    setInterval(() => {
        checkForContentUpdates();
    }, 300000);
}

async function checkForContentUpdates() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            // System is healthy
            console.log('✅ System health check passed');
        }
    } catch (error) {
        console.error('❌ System health check failed:', error);
    }
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications of same type
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => {
        if (notification.getAttribute('data-type') === type) {
            notification.remove();
        }
    });
    
    const notification = document.createElement('div');
    notification.className = `custom-notification notification-${type}`;
    notification.setAttribute('data-type', type);
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#custom-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'custom-notification-styles';
        styles.textContent = `
            .custom-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 350px;
                animation: slideInRight 0.3s ease;
                border-left: 4px solid;
            }
            
            .notification-success {
                border-left-color: #27ae60;
                background: linear-gradient(135deg, #f8fff8, #ffffff);
            }
            
            .notification-error {
                border-left-color: #e74c3c;
                background: linear-gradient(135deg, #fff8f8, #ffffff);
            }
            
            .notification-info {
                border-left-color: #3498db;
                background: linear-gradient(135deg, #f8fbff, #ffffff);
            }
            
            .notification-warning {
                border-left-color: #f39c12;
                background: linear-gradient(135deg, #fffbf8, #ffffff);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                margin-left: auto;
                color: #666;
                padding: 5px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .notification-close:hover {
                background: rgba(0,0,0,0.1);
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @media (max-width: 768px) {
                .custom-notification {
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function isUserLoggedIn() {
    return document.body.classList.contains('user-logged-in') || 
           document.querySelector('.user-avatar') !== null;
}

function getCurrentHymnId() {
    const path = window.location.pathname;
    const match = path.match(/\/hymns\/([^\/]+)/);
    return match ? match[1] : null;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for global access
window.showNotification = showNotification;
window.toggleFavorite = toggleFavorite;
window.submitQuickRating = submitQuickRating;

console.log('🎵 Hymns App JavaScript Loaded Successfully');
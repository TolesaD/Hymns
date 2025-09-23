// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation Toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
    
    // Close flash messages
    const flashCloseButtons = document.querySelectorAll('.flash-close');
    flashCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.flash-message').style.display = 'none';
        });
    });
    
    // Auto-hide flash messages after 5 seconds
    const flashMessages = document.querySelectorAll('.flash-message');
    flashMessages.forEach(message => {
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
    });
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    
    if (searchInput) {
        let timeoutId;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(timeoutId);
            const query = this.value.trim();
            
            if (query.length < 2) {
                searchSuggestions.style.display = 'none';
                return;
            }
            
            timeoutId = setTimeout(() => {
                fetchSearchSuggestions(query);
            }, 300);
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
                searchSuggestions.style.display = 'none';
            }
        });
    }
    
    // Favorite buttons
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    favoriteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const hymnId = this.getAttribute('data-hymn-id');
            toggleFavorite(hymnId, this);
        });
    });
    
    // Audio player functionality
    initializeAudioPlayers();
    
    // Newsletter form
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            subscribeNewsletter(email, this);
        });
    }
});

// Search suggestions
async function fetchSearchSuggestions(query) {
    try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`);
        const suggestions = await response.json();
        
        displaySearchSuggestions(suggestions);
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
    }
}

function displaySearchSuggestions(suggestions) {
    const searchSuggestions = document.getElementById('search-suggestions');
    
    if (suggestions.length === 0) {
        searchSuggestions.innerHTML = '<div class="suggestion-item">No results found</div>';
    } else {
        searchSuggestions.innerHTML = suggestions.map(suggestion => 
            `<a href="/hymns/${suggestion._id}" class="suggestion-item">
                <i class="fas fa-music"></i>
                <span>${suggestion.title} (${suggestion.language})</span>
            </a>`
        ).join('');
    }
    
    searchSuggestions.style.display = 'block';
}

// Favorite functionality
async function toggleFavorite(hymnId, button) {
    try {
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
                icon.classList.remove('far');
                icon.classList.add('fas', 'favorite-active');
                showNotification('Added to favorites', 'success');
            } else {
                icon.classList.remove('fas', 'favorite-active');
                icon.classList.add('far');
                showNotification('Removed from favorites', 'info');
            }
        } else {
            showNotification(result.error || 'Please log in to add favorites', 'error');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showNotification('Error updating favorites', 'error');
    }
}

// Audio player
function initializeAudioPlayers() {
    const audioPlayers = document.querySelectorAll('.audio-player');
    
    audioPlayers.forEach(player => {
        const audio = player.querySelector('audio');
        const playBtn = player.querySelector('.play-btn');
        const progressBar = player.querySelector('.progress-bar');
        const progress = player.querySelector('.progress');
        const currentTime = player.querySelector('.current-time');
        const duration = player.querySelector('.duration');
        
        if (!audio) return;
        
        // Play/Pause
        playBtn.addEventListener('click', function() {
            if (audio.paused) {
                audio.play();
                this.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                audio.pause();
                this.innerHTML = '<i class="fas fa-play"></i>';
            }
        });
        
        // Update progress bar
        audio.addEventListener('timeupdate', function() {
            const percent = (audio.currentTime / audio.duration) * 100;
            progress.style.width = `${percent}%`;
            currentTime.textContent = formatTime(audio.currentTime);
        });
        
        // Set duration
        audio.addEventListener('loadedmetadata', function() {
            duration.textContent = formatTime(audio.duration);
        });
        
        // Seek on progress bar click
        progressBar.addEventListener('click', function(e) {
            const clickX = e.offsetX;
            const width = this.offsetWidth;
            const duration = audio.duration;
            
            audio.currentTime = (clickX / width) * duration;
        });
        
        // Reset play button when audio ends
        audio.addEventListener('ended', function() {
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            progress.style.width = '0%';
            currentTime.textContent = '0:00';
        });
    });
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Newsletter subscription
async function subscribeNewsletter(email, form) {
    try {
        const response = await fetch('/api/newsletter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Successfully subscribed to newsletter!', 'success');
            form.reset();
        } else {
            showNotification(result.error || 'Subscription failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        showNotification('Network error. Please check your connection and try again.', 'error');
    }
}

// Update the form submission handler
const newsletterForm = document.getElementById('newsletter-form');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const emailInput = this.querySelector('input[name="email"]');
        const email = emailInput.value.trim();
        
        if (!email) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }
        
        subscribeNewsletter(email, this);
    });
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                max-width: 300px;
                animation: slideIn 0.3s ease;
            }
            
            .notification-success {
                border-left: 4px solid #27ae60;
            }
            
            .notification-error {
                border-left: 4px solid #e74c3c;
            }
            
            .notification-info {
                border-left: 4px solid #3498db;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                margin-left: auto;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', function() {
        notification.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        default: return 'info-circle';
    }
}

// PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
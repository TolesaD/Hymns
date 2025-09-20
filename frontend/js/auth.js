// Authentication functions
class Auth {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user')) || null;
        this.checkAuth();
    }

    // Check if user is authenticated
    checkAuth() {
        if (this.token && this.user) {
            this.updateUI();
            return true;
        }
        return false;
    }

    // Login function
    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.token = data.token;
                this.user = data.data.user;
                
                // Store in localStorage
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                this.updateUI();
                this.showFlash('Login successful!', 'success');
                
                // Redirect to home page after login
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
                
                return true;
            } else {
                this.showFlash(data.message, 'error');
                return false;
            }
        } catch (error) {
            this.showFlash('Login failed. Please try again.', 'error');
            return false;
        }
    }

    // Register function
    async register(username, email, password) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.showFlash('Registration successful! Please login.', 'success');
                
                // Redirect to login page after registration
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
                
                return true;
            } else {
                this.showFlash(data.message, 'error');
                return false;
            }
        } catch (error) {
            this.showFlash('Registration failed. Please try again.', 'error');
            return false;
        }
    }

    // Logout function
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        this.updateUI();
        this.showFlash('Logged out successfully', 'success');
        
        // Redirect to home page after logout
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    }

    // Update UI based on authentication status
    updateUI() {
        const navAuth = document.getElementById('nav-auth');
        const navUser = document.getElementById('nav-user');
        const userName = document.getElementById('user-name');
        const adminLink = document.getElementById('admin-link');
        
        if (this.user) {
            if (navAuth) navAuth.style.display = 'none';
            if (navUser) navUser.style.display = 'flex';
            if (userName) userName.textContent = this.user.username;
            
            // Show admin link if user is admin
            if (this.user.role === 'admin' && adminLink) {
                adminLink.style.display = 'block';
            }
        } else {
            if (navAuth) navAuth.style.display = 'block';
            if (navUser) navUser.style.display = 'none';
        }
    }

    // Get authorization header for API requests
    getAuthHeader() {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json'
        };
    }

    // Show flash message
    showFlash(message, type) {
        const flashContainer = document.getElementById('flash-messages');
        if (!flashContainer) return;
        
        const flash = document.createElement('div');
        flash.className = `flash-message flash-${type}`;
        flash.textContent = message;
        
        flashContainer.appendChild(flash);
        
        // Remove flash after 5 seconds
        setTimeout(() => {
            flash.remove();
        }, 3000);
    }
}

// Initialize auth
const auth = new Auth();

// Logout button event listener
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            auth.logout();
        });
    }
    
    // Mobile menu toggle
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
});
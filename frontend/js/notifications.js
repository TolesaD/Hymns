// Notification system
class Notifications {
    constructor() {
        this.unreadCount = 0;
        this.checkInterval = null;
        this.init();
    }

    init() {
        if (auth.user) {
            this.loadUnreadCount();
            this.startPolling();
            
            // Create notification icon in navbar
            this.createNotificationIcon();
        }
    }

    createNotificationIcon() {
        const navUser = document.getElementById('nav-user');
        if (!navUser) return;

        // Create notification icon
        const notificationIcon = document.createElement('div');
        notificationIcon.id = 'notification-icon';
        notificationIcon.innerHTML = '<i class="fas fa-bell"></i>';
        notificationIcon.style.cssText = `
            position: relative;
            cursor: pointer;
            margin-right: 15px;
            font-size: 1.2rem;
        `;

        // Create badge for unread count
        const badge = document.createElement('span');
        badge.id = 'notification-badge';
        badge.className = 'notification-badge';
        badge.style.cssText = `
            position: absolute;
            top: -5px;
            right: -5px;
            background: var(--danger-color);
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 0.7rem;
            display: flex;
            align-items: center;
            justify-content: center;
            display: none;
        `;

        notificationIcon.appendChild(badge);
        navUser.insertBefore(notificationIcon, navUser.firstChild);

        // Add click event
        notificationIcon.addEventListener('click', () => {
            this.showNotifications();
        });
    }

    async loadUnreadCount() {
        try {
            const response = await fetch('/api/notifications/unread-count', {
                headers: auth.getAuthHeader()
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.unreadCount = data.data.count;
                this.updateBadge();
            }
        } catch (error) {
            console.error('Error loading notification count:', error);
        }
    }

    updateBadge() {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;

        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    startPolling() {
        // Check for new notifications every 30 seconds
        this.checkInterval = setInterval(() => {
            this.loadUnreadCount();
        }, 30000);
    }

    stopPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }

    async showNotifications() {
        // Implement notification modal/dropdown
        console.log('Show notifications modal');
        // You can implement a modal or dropdown to show notifications
    }

    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: auth.getAuthHeader()
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.unreadCount--;
                this.updateBadge();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'PATCH',
                headers: auth.getAuthHeader()
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.unreadCount = 0;
                this.updateBadge();
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }
}

// Initialize notifications
const notifications = new Notifications();
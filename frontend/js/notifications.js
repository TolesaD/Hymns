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
            this.createNotificationIcon();
        }
    }

    createNotificationIcon() {
        const navUser = document.getElementById('nav-user');
        if (!navUser) return;

        const notificationIcon = document.createElement('div');
        notificationIcon.id = 'notification-icon';
        notificationIcon.innerHTML = '<i class="fas fa-bell"></i>';
        notificationIcon.style.cssText = `
            position: relative;
            cursor: pointer;
            margin-right: 15px;
            font-size: 1.2rem;
        `;

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
        try {
            const response = await fetch('/api/notifications', {
                headers: auth.getAuthHeader()
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                const notifications = data.data.notifications;
                const modal = document.createElement('div');
                modal.className = 'notification-modal';
                modal.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 1000;
                    max-width: 400px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                `;
                
                modal.innerHTML = `
                    <h3>Notifications</h3>
                    <button onclick="notifications.markAllAsRead()" style="float: right; margin-bottom: 10px;">Mark All as Read</button>
                    <div id="notification-list">
                        ${notifications.length === 0 ? '<p>No notifications</p>' : ''}
                    </div>
                    <button onclick="this.parentElement.remove()" style="margin-top: 10px;">Close</button>
                `;
                
                const notificationList = modal.querySelector('#notification-list');
                notifications.forEach(notification => {
                    const div = document.createElement('div');
                    div.style.cssText = `
                        padding: 10px;
                        border-bottom: 1px solid #eee;
                        background: ${notification.isRead ? '#f9f9f9' : '#e6f3ff'};
                        cursor: ${notification.relatedId && notification.onModel === 'Hymn' ? 'pointer' : 'default'};
                    `;
                    div.innerHTML = `
                        <p>${notification.message}</p>
                        <small>${new Date(notification.createdAt).toLocaleString()}</small>
                    `;
                    if (notification.relatedId && notification.onModel === 'Hymn') {
                        div.addEventListener('click', () => {
                            window.location.href = `/pages/hymn.html?id=${notification.relatedId}`;
                            this.markAsRead(notification._id);
                        });
                    }
                    notificationList.appendChild(div);
                });
                
                document.body.appendChild(modal);
            } else {
                auth.showFlash('Error loading notifications', 'error');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            auth.showFlash('Error loading notifications', 'error');
        }
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
                const modal = document.querySelector('.notification-modal');
                if (modal) modal.remove();
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }
}

const notifications = new Notifications();
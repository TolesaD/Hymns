const axios = require('axios');

class EmailService {
    constructor() {
        // Configuration
        this.apiToken = process.env.MAILERSEND_API_TOKEN;
        this.fromEmail = process.env.MAILERSEND_FROM_EMAIL;
        this.fromName = process.env.MAILERSEND_FROM_NAME || 'Akotet Hymns';
        this.baseUrl = 'https://api.mailersend.com/v1';
        
        // Service status
        this.apiEnabled = !!(this.apiToken && this.fromEmail);
        this.enabled = this.apiEnabled;
        
        // Rate limiting
        this.rateLimit = {
            maxRequests: 100, // 100 requests
            perMinutes: 1,    // per minute
            requests: [],
            isLimited: false
        };
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000, // 1 second
            timeout: 30000    // 30 seconds
        };

        this.logServiceStatus();
        
        // Clean up rate limit array every minute
        setInterval(() => this.cleanupRateLimit(), 60000);
    }

    logServiceStatus() {
        console.log('📧 Email Service Status:', {
            environment: process.env.NODE_ENV,
            enabled: this.enabled,
            method: 'API',
            fromEmail: this.fromEmail,
            fromName: this.fromName
        });

        if (!this.enabled) {
            console.error('❌ Email service disabled. Check MAILERSEND_API_TOKEN and MAILERSEND_FROM_EMAIL');
        }
    }

    // Rate limiting implementation
    checkRateLimit() {
        const now = Date.now();
        const windowStart = now - (this.rateLimit.perMinutes * 60000);
        
        // Remove old requests
        this.rateLimit.requests = this.rateLimit.requests.filter(time => time > windowStart);
        
        // Check if over limit
        if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
            this.rateLimit.isLimited = true;
            const waitTime = Math.ceil((this.rateLimit.requests[0] + (this.rateLimit.perMinutes * 60000) - now) / 1000);
            console.warn(`🚫 Rate limit exceeded. Please wait ${waitTime} seconds`);
            return false;
        }
        
        this.rateLimit.isLimited = false;
        this.rateLimit.requests.push(now);
        return true;
    }

    cleanupRateLimit() {
        const now = Date.now();
        const windowStart = now - (this.rateLimit.perMinutes * 60000);
        this.rateLimit.requests = this.rateLimit.requests.filter(time => time > windowStart);
        
        if (this.rateLimit.isLimited && this.rateLimit.requests.length < this.rateLimit.maxRequests) {
            this.rateLimit.isLimited = false;
            console.log('✅ Rate limit reset');
        }
    }

    async sendEmail(to, subject, text, html = null, options = {}) {
        const startTime = Date.now();
        const emailId = Math.random().toString(36).substring(7);
        
        console.log(`📧 [${emailId}] Starting email send to: ${to}`);
        
        try {
            // Validate input parameters
            const validationError = this.validateEmailParameters(to, subject, text);
            if (validationError) {
                throw new Error(validationError);
            }

            // Check rate limit
            if (!this.checkRateLimit()) {
                throw new Error('Rate limit exceeded');
            }

            // Development mode - log instead of sending
            if (process.env.NODE_ENV === 'development') {
                console.log(`📧 [${emailId}] DEVELOPMENT MODE - Email would be sent:`, {
                    to,
                    subject,
                    text: text.substring(0, 100) + '...',
                    html: html ? 'Yes' : 'No'
                });
                return true;
            }

            // Production mode - send via API
            if (!this.enabled) {
                throw new Error('Email service disabled');
            }

            const result = await this.sendWithRetry(to, subject, text, html, options, emailId);
            
            const duration = Date.now() - startTime;
            console.log(`✅ [${emailId}] Email sent successfully in ${duration}ms to: ${to}`);
            
            // Log for analytics
            this.logEmailEvent('email_sent', to, { success: true, duration, emailId });
            
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [${emailId}] Email failed after ${duration}ms to: ${to}`, error.message);
            
            // Log for analytics
            this.logEmailEvent('email_failed', to, { 
                success: false, 
                duration, 
                emailId, 
                error: error.message 
            });
            
            return false;
        }
    }

    async sendWithRetry(to, subject, text, html, options, emailId, attempt = 1) {
        try {
            console.log(`🔄 [${emailId}] Attempt ${attempt} of ${this.retryConfig.maxRetries}`);
            
            const emailData = {
                from: {
                    email: this.fromEmail,
                    name: this.fromName
                },
                to: [
                    {
                        email: to,
                        name: to.split('@')[0]
                    }
                ],
                subject: subject,
                text: text,
                html: html || this.textToHtml(text),
                // Additional options for better deliverability
                ...(options.replyTo && {
                    reply_to: {
                        email: options.replyTo,
                        name: this.fromName
                    }
                })
            };

            const response = await axios.post(
                `${this.baseUrl}/email`,
                emailData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Akotet-Hymns-App/1.0',
                        'X-Request-ID': emailId
                    },
                    timeout: this.retryConfig.timeout
                }
            );

            console.log(`✅ [${emailId}] API request successful:`, {
                status: response.status,
                messageId: response.data?.id || 'unknown'
            });

            return true;

        } catch (error) {
            // Check if we should retry
            if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error)) {
                const delay = this.retryConfig.retryDelay * attempt;
                console.log(`⏳ [${emailId}] Retrying in ${delay}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return await this.sendWithRetry(to, subject, text, html, options, emailId, attempt + 1);
            }
            
            // If no more retries or shouldn't retry, throw the error
            throw error;
        }
    }

    shouldRetry(error) {
        if (!error.response) {
            // Network error - retry
            return true;
        }
        
        const status = error.response.status;
        
        // Retry on these status codes
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return retryableStatuses.includes(status);
    }

    validateEmailParameters(to, subject, text) {
        if (!to || !subject || !text) {
            return 'Missing required email parameters: to, subject, or text';
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return `Invalid recipient email format: ${to}`;
        }

        // Validate subject length
        if (subject.length > 998) {
            return 'Subject too long (max 998 characters)';
        }

        return null;
    }

    // Enhanced password reset email
    async sendPasswordResetEmail(email, resetToken, resetLink, userName = 'Beloved User') {
        console.log('🔐 Sending password reset email to:', email);
        
        const subject = 'Reset Your Password - Akotet Hymns 🙏';
        
        const text = this.getPasswordResetText(userName, resetLink);
        const html = this.getPasswordResetHtml(userName, resetLink);

        try {
            const result = await this.sendEmail(email, subject, text, html, {
                category: 'password-reset',
                priority: 'high'
            });
            
            if (result) {
                console.log('✅ Password reset email sent successfully to:', email);
                this.logEmailEvent('password_reset_sent', email, { success: true });
            } else {
                console.error('❌ Failed to send password reset email to:', email);
                this.logEmailEvent('password_reset_failed', email, { success: false });
            }
            
            return result;
            
        } catch (error) {
            console.error('💥 Critical error sending password reset email:', error);
            this.logEmailEvent('password_reset_error', email, { error: error.message });
            return false;
        }
    }

    getPasswordResetText(userName, resetLink) {
        return `🕊️ Akotet Hymns - Password Reset

Peace be with you, ${userName}! 🙏

Just as we sometimes forget earthly things, we understand that passwords can slip from memory too. Don't worry - we're here to help you restore your access to our community of worship and praise.

📖 "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint." - Isaiah 40:31

Click the link below to reset your password and continue your spiritual journey with us. This sacred link will remain valid for the next 24 hours:

🔗 Reset Your Password: ${resetLink}

💫 A Prayer for You:
"May the Lord guide your steps and bless your journey back to our community of faith and worship. May your heart be filled with peace as you continue to explore the spiritual hymns that connect us to the Divine."

If you have any questions or need spiritual guidance along with technical support, feel free to reach out to us at akotetservice@gmail.com.

May God's grace and peace be with you always,

🕊️ Akotet Hymns Team
"Make a joyful noise unto the Lord, all ye lands." - Psalm 100:1`;
    }

    getPasswordResetHtml(userName, resetLink) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - Akotet Hymns</title>
    <style>
        /* Production-ready email styles */
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f8f9fa;
            -webkit-font-smoothing: antialiased;
            -webkit-text-size-adjust: 100%;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
            background: linear-gradient(135deg, #4a6fa5, #3a5a8c); 
            padding: 30px 20px; 
            text-align: center; 
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content { 
            padding: 30px; 
        }
        .footer { 
            margin-top: 30px; 
            padding: 20px;
            background: #f8f9fa;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #4a6fa5, #3a5a8c);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 500;
            border: none;
            cursor: pointer;
        }
        .bible-verse {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #4a6fa5;
            margin: 20px 0;
            font-style: italic;
            color: #555;
        }
        .prayer {
            background: #fff8e1;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
            color: #5d4037;
        }
        /* Mobile responsiveness */
        @media only screen and (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 0;
            }
            .content {
                padding: 20px;
            }
            .header {
                padding: 20px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕊️ Akotet Hymns</h1>
            <p>Spiritual Songs for the Soul</p>
        </div>
        <div class="content">
            <h2>Peace be with you, ${userName}! 🙏</h2>
            
            <p>Just as we sometimes forget earthly things, we understand that passwords can slip from memory too. Don't worry - we're here to help you restore your access to our community of worship and praise.</p>
            
            <div class="bible-verse">
                <strong>"But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint."</strong><br>
                - Isaiah 40:31
            </div>
            
            <p>Click the button below to reset your password and continue your spiritual journey with us. This sacred link will remain valid for the next 24 hours.</p>
            
            <div style="text-align: center;">
                <a href="${resetLink}" class="button">🔄 Reset Your Password</a>
            </div>
            
            <p style="text-align: center; font-size: 12px; color: #666;">
                Or copy and paste this link in your browser:<br>
                <span style="word-break: break-all;">${resetLink}</span>
            </p>
            
            <div class="prayer">
                <strong>💫 A Prayer for You:</strong><br>
                "May the Lord guide your steps and bless your journey back to our community of faith and worship. May your heart be filled with peace as you continue to explore the spiritual hymns that connect us to the Divine."
            </div>
            
            <p>If you have any questions or need spiritual guidance along with technical support, feel free to reach out to us at <strong>akotetservice@gmail.com</strong>.</p>
            
            <p><strong>May God's grace and peace be with you always,</strong></p>
        </div>
        <div class="footer">
            <p>🕊️ <strong>Akotet Hymns Team</strong></p>
            <p>"Make a joyful noise unto the Lord, all ye lands." - Psalm 100:1</p>
            <p>© ${new Date().getFullYear()} Akotet Hymns. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
    }

    textToHtml(text) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f8f9fa; }
        .content { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="content">
        ${text.replace(/\n/g, '<br>')}
    </div>
</body>
</html>`;
    }

    getPasswordResetText(userName, resetLink) {
        return `🕊️ Akotet Hymns - Password Reset

Peace be with you, ${userName}! 🙏

Click the link below to reset your password:
${resetLink}

This link will expire in 24 hours.

May God's grace and peace be with you always,

🕊️ Akotet Hymns Team`;
    }

    getPasswordResetHtml(userName, resetLink) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .button { display: inline-block; background: #4a6fa5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Peace be with you, ${userName}! 🙏</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${resetLink}" class="button">Reset Password</a>
        <p>This link will expire in 24 hours.</p>
    </div>
</body>
</html>`;
    }

    logEmailEvent(event, email, details = {}) {
        // In production, integrate with your logging service
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            email,
            environment: process.env.NODE_ENV,
            ...details
        };
        
        console.log('📊 Email Event:', logEntry);
        
        // Here you could send to:
        // - Your database
        // - Logging service (Sentry, DataDog, etc.)
        // - Analytics platform
    }

    // Health check method
    async healthCheck() {
        return {
            enabled: this.enabled,
            api: {
                enabled: this.apiEnabled,
                configured: !!(this.apiToken && this.fromEmail)
            },
            rateLimit: {
                current: this.rateLimit.requests.length,
                max: this.rateLimit.maxRequests,
                isLimited: this.rateLimit.isLimited
            },
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new EmailService();
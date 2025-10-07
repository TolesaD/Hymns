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

        this.logServiceStatus();
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
                // No custom headers - they require Professional plan
            };

            console.log(`📤 [${emailId}] Sending to MailerSend API...`);
            
            const response = await axios.post(
                `${this.baseUrl}/email`,
                emailData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            console.log(`✅ [${emailId}] MailerSend API Response:`, {
                status: response.status,
                messageId: response.data?.id || 'unknown'
            });

            if (response.status === 202 || (response.status >= 200 && response.status < 300)) {
                console.log(`✅ [${emailId}] Email sent successfully in ${Date.now() - startTime}ms`);
                return true;
            }

            return false;

        } catch (error) {
            console.error(`❌ [${emailId}] Email failed after ${Date.now() - startTime}ms:`, error.message);
            
            if (error.response) {
                console.error(`📊 [${emailId}] API Error:`, {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            
            return false;
        }
    }

    validateEmailParameters(to, subject, text) {
        if (!to || !subject || !text) {
            return 'Missing required email parameters: to, subject, or text';
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return `Invalid recipient email format: ${to}`;
        }

        return null;
    }

    async sendPasswordResetEmail(email, resetToken, resetLink, userName = null) {
        console.log('🔐 Sending password reset email to:', email);
        
        const displayName = userName || email.split('@')[0] || 'Friend';
        const subject = 'Reset Your Password - Akotet Hymns';
        
        const text = `Password Reset - Akotet Hymns

Hello ${displayName},

You requested to reset your password for your Akotet Hymns account.

Click the link below to reset your password:
${resetLink}

This link will expire in 24 hours.

If you didn't request this reset, please ignore this email.

Akotet Hymns Team`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${displayName},</p>
        <p>You requested to reset your password for your Akotet Hymns account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetLink}" style="background: #4a6fa5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetLink}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <p>Akotet Hymns Team</p>
    </div>
</body>
</html>`;

        return await this.sendEmail(email, subject, text, html);
    }

    textToHtml(text) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body>
    <div>${text.replace(/\n/g, '<br>')}</div>
</body>
</html>`;
    }
}

const emailService = new EmailService();
module.exports = emailService;
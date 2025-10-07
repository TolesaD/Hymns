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

    async sendEmail(to, subject, text, html = null) {
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
                console.error('❌ Email service disabled in production! Check MAILERSEND_API_TOKEN and MAILERSEND_FROM_EMAIL');
                return false;
            }

            console.log(`📧 [${emailId}] PRODUCTION: Sending email via MailerSend...`);
            console.log(`📧 [${emailId}] To: ${to}`);
            console.log(`📧 [${emailId}] From: ${this.fromName} <${this.fromEmail}>`);
            console.log(`📧 [${emailId}] Subject: ${subject}`);

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
                html: html || this.textToHtml(text)
            };

            const response = await axios.post(
                `${this.baseUrl}/email`,
                emailData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Akotet-Hymns-App/1.0'
                    },
                    timeout: 30000
                }
            );

            console.log(`✅ [${emailId}] Email sent successfully! Status: ${response.status}`);
            if (response.data && response.data.id) {
                console.log(`📨 [${emailId}] Message ID: ${response.data.id}`);
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ [${emailId}] Email sent successfully in ${duration}ms`);
            
            return true;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [${emailId}] Email failed after ${duration}ms:`, error.message);
            
            if (error.response) {
                console.error(`📊 [${emailId}] Status: ${error.response.status}`);
                console.error(`📊 [${emailId}] Error Data:`, JSON.stringify(error.response.data, null, 2));
                
                if (error.response.status === 401) {
                    console.error(`🔐 [${emailId}] AUTHENTICATION FAILED:`);
                    console.error(`🔐 [${emailId}] 1. Check your MAILERSEND_API_TOKEN in environment variables`);
                    console.error(`🔐 [${emailId}] 2. Make sure the token is active in MailerSend dashboard`);
                    console.error(`🔐 [${emailId}] 3. Verify the token has correct permissions`);
                } else if (error.response.status === 422) {
                    console.error(`📝 [${emailId}] VALIDATION ERROR:`);
                    console.error(`📝 [${emailId}] Check your email parameters and domain verification`);
                } else if (error.response.status === 429) {
                    console.error(`🚫 [${emailId}] RATE LIMIT EXCEEDED:`);
                    console.error(`🚫 [${emailId}] Too many requests. Please try again later.`);
                }
            } else if (error.request) {
                console.error(`🌐 [${emailId}] NETWORK ERROR: No response received from MailerSend API`);
                console.error(`🌐 [${emailId}] Check your internet connection and firewall settings`);
            } else {
                console.error(`💥 [${emailId}] UNEXPECTED ERROR:`, error.message);
            }
            
            return false;
        }
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

        return null;
    }

    async sendPasswordResetEmail(email, resetToken, resetLink, userName = null) {
        console.log('🔐 Sending spiritual password reset email to:', email);
        
        // Use actual username or fallback to email name
        const displayName = userName || email.split('@')[0] || 'Beloved User';
        
        const subject = 'Reset Your Password - Akotet Hymns 🙏';
        
        // Plain text version
        const text = `🕊️ Akotet Hymns - Password Reset

Peace be with you, ${displayName}! 🙏

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

        // HTML version
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - Akotet Hymns</title>
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f8f9fa;
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
        .security-note {
            background: #e8f5e8;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #4caf50;
            margin: 20px 0;
            font-size: 14px;
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
            <h2>Peace be with you, ${displayName}! 🙏</h2>
            
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
            
            <div class="security-note">
                <strong>🔒 Security Note:</strong><br>
                If you didn't request this password reset, please ignore this email. Your account remains secure.
            </div>
            
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

        const result = await this.sendEmail(email, subject, text, html);
        
        if (result) {
            console.log('✅ Spiritual password reset email sent successfully to:', email);
        } else {
            console.error('❌ Failed to send spiritual password reset email to:', email);
        }
        
        return result;
    }

    textToHtml(text) {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f8f9fa;
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
            background: #4a6fa5; 
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
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Akotet Hymns</h1>
        </div>
        <div class="content">
            ${text.replace(/\n/g, '<br>')}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Akotet Hymns. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
    }
}

const emailService = new EmailService();
module.exports = emailService;
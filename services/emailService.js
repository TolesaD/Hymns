const axios = require('axios');

class EmailService {
    constructor() {
        this.apiToken = process.env.MAILERSEND_API_TOKEN;
        this.fromEmail = process.env.MAILERSEND_FROM_EMAIL;
        this.fromName = process.env.MAILERSEND_FROM_NAME || 'Hymns App';
        this.baseUrl = 'https://api.mailersend.com/v1';
        this.enabled = !!this.apiToken && !!this.fromEmail;
        
        console.log('📧 Email Service Initialized:', {
            enabled: this.enabled,
            hasToken: !!this.apiToken,
            fromEmail: this.fromEmail,
            fromName: this.fromName
        });
    }

    async sendEmail(to, subject, text, html = null) {
        // Check if email service is enabled
        if (!this.enabled) {
            console.log('❌ Email service disabled - missing API token or from email');
            console.log('API Token present:', !!this.apiToken);
            console.log('From Email present:', !!this.fromEmail);
            return false;
        }

        // Validate required fields
        if (!to || !subject || !text) {
            console.error('❌ Missing required email parameters');
            console.log('To:', to);
            console.log('Subject:', subject);
            console.log('Text:', text ? 'Present' : 'Missing');
            return false;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            console.error('❌ Invalid recipient email format:', to);
            return false;
        }

        if (!emailRegex.test(this.fromEmail)) {
            console.error('❌ Invalid from email format:', this.fromEmail);
            return false;
        }

        try {
            console.log('📧 Attempting to send email...');
            console.log('To:', to);
            console.log('From:', `${this.fromName} <${this.fromEmail}>`);
            console.log('Subject:', subject);

            // MailerSend API payload
            const emailData = {
                from: {
                    email: this.fromEmail,
                    name: this.fromName
                },
                to: [
                    {
                        email: to,
                        name: to.split('@')[0] // Use username part as name
                    }
                ],
                subject: subject,
                text: text,
                html: html || this.textToHtml(text)
            };

            console.log('📤 Sending request to MailerSend API...');

            const response = await axios.post(
                `${this.baseUrl}/email`,
                emailData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Hymns-App/1.0'
                    },
                    timeout: 30000 // 30 second timeout
                }
            );

            console.log('✅ Email sent successfully! Status:', response.status);
            console.log('Message ID:', response.data?.id || 'Not provided');
            return true;

        } catch (error) {
            console.error('❌ Email sending failed!');
            
            if (error.response) {
                // Server responded with error status
                console.error('Status:', error.response.status);
                console.error('Headers:', error.response.headers);
                console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
                
                if (error.response.status === 401) {
                    console.error('❌ Authentication failed - check your API token');
                } else if (error.response.status === 422) {
                    console.error('❌ Validation error - check your email parameters');
                } else if (error.response.status === 429) {
                    console.error('❌ Rate limit exceeded - too many requests');
                }
            } else if (error.request) {
                // No response received
                console.error('No response received from MailerSend API');
                console.error('Request config:', error.config);
            } else {
                // Other error
                console.error('Error message:', error.message);
                console.error('Stack trace:', error.stack);
            }
            
            return false;
        }
    }

    textToHtml(text) {
        return `
<!DOCTYPE html>
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
        .button {
            display: inline-block;
            background: #4a6fa5;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }
        .code {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #4a6fa5;
            margin: 15px 0;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Hymns App</h1>
        </div>
        <div class="content">
            ${text.replace(/\n/g, '<br>')}
        </div>
        <div class="footer">
            <p>&copy; 2025 Hymns Project. All rights reserved.</p>
            <p>If you have any questions, please contact our support team.</p>
        </div>
    </div>
</body>
</html>`;
    }

    async sendPasswordResetEmail(email, resetToken, resetLink) {
        console.log('🔐 Sending password reset email to:', email);
        
        const subject = 'Reset Your Password - Hymns App';
        const text = `Hello,

You requested a password reset for your Hymns account.

To reset your password, click the link below:

${resetLink}

This password reset link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email. Your account remains secure.

Best regards,
The Hymns Team`;

        const html = `
            <p>Hello,</p>
            
            <p>You requested a password reset for your Hymns account.</p>
            
            <p>To reset your password, click the button below:</p>
            
            <p style="text-align: center;">
                <a href="${resetLink}" class="button" style="color: white; text-decoration: none;">
                    Reset Your Password
                </a>
            </p>
            
            <p>Or copy and paste this link in your browser:</p>
            
            <div class="code">
                ${resetLink}
            </div>
            
            <p><strong>This password reset link will expire in 1 hour</strong> for security reasons.</p>
            
            <p>If you didn't request a password reset, please ignore this email. Your account remains secure.</p>
            
            <p>Best regards,<br>The Hymns Team</p>
        `;

        const result = await this.sendEmail(email, subject, text, html);
        
        if (result) {
            console.log('✅ Password reset email sent successfully to:', email);
        } else {
            console.error('❌ Failed to send password reset email to:', email);
        }
        
        return result;
    }

    async sendWelcomeEmail(email, username) {
        const subject = 'Welcome to Hymns App!';
        const text = `Welcome to Hymns, ${username}!

Thank you for joining our community. We're excited to have you on board.

With your account, you can:
- Access thousands of beautiful Orthodox hymns
- Save your favorite hymns
- Download hymns for offline listening
- Receive notifications about new content

Start exploring now: ${process.env.APP_URL || 'https://your-app-url.com'}

If you have any questions, feel free to reply to this email.

Best regards,
The Hymns Team`;

        return await this.sendEmail(email, subject, text);
    }

    async sendNewHymnNotification(email, username, hymnTitle) {
        const subject = 'New Hymn Added - Hymns App';
        const text = `Hello ${username},

A new hymn has been added to the platform: "${hymnTitle}"

Check it out now: ${process.env.APP_URL || 'https://your-app-url.com'}

Best regards,
The Hymns Team`;

        return await this.sendEmail(email, subject, text);
    }

    // Test configuration
    async testConfiguration() {
        console.log('\n=== MailerSend Configuration Test ===');
        console.log('API Token present:', !!this.apiToken);
        console.log('From Email:', this.fromEmail);
        console.log('From Name:', this.fromName);
        console.log('Base URL:', this.baseUrl);
        console.log('Service Enabled:', this.enabled);
        
        if (!this.apiToken) {
            console.log('❌ Missing MAILERSEND_API_TOKEN in environment variables');
            return false;
        }
        
        if (!this.fromEmail) {
            console.log('❌ Missing MAILERSEND_FROM_EMAIL in environment variables');
            return false;
        }
        
        if (!this.fromEmail.includes('@')) {
            console.log('❌ Invalid MAILERSEND_FROM_EMAIL format');
            return false;
        }
        
        console.log('✅ Basic configuration looks good');
        return true;
    }

    // Simple test email
    async sendTestEmail(toEmail = 'test@example.com') {
        console.log('\n=== Sending Test Email ===');
        
        const configOk = await this.testConfiguration();
        if (!configOk) {
            return false;
        }

        console.log('Sending test email to:', toEmail);
        
        const testResult = await this.sendEmail(
            toEmail,
            'Test Email from Hymns App',
            'This is a test email to verify your MailerSend configuration is working correctly!\n\nIf you received this email, your email service is properly configured.\n\nBest regards,\nHymns Team'
        );

        if (testResult) {
            console.log('✅ Test email sent successfully!');
        } else {
            console.log('❌ Test email failed to send');
        }

        return testResult;
    }
}

module.exports = new EmailService();
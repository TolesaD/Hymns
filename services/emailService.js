const axios = require('axios');

class EmailService {
    constructor() {
        this.apiToken = process.env.MAILERSEND_API_TOKEN;
        this.fromEmail = process.env.MAILERSEND_FROM_EMAIL;
        this.fromName = process.env.MAILERSEND_FROM_NAME || 'Hymns App';
        this.baseUrl = 'https://api.mailersend.com/v1';
        this.enabled = !!this.apiToken;
    }

    async sendEmail(to, subject, text, html = null) {
        // Check if email service is enabled
        if (!this.enabled) {
            console.log('❌ Email service disabled - no API token configured');
            return false;
        }

        // Validate required fields
        if (!to || !subject || !text) {
            console.error('❌ Missing required email parameters');
            return false;
        }

        // Validate from email format
        if (!this.fromEmail || !this.fromEmail.includes('@')) {
            console.error('❌ Invalid from email format:', this.fromEmail);
            return false;
        }

        try {
            console.log('📧 Attempting to send email...');
            console.log('To:', to);
            console.log('From:', `${this.fromName} <${this.fromEmail}>`);
            console.log('Subject:', subject);

            // MailerSend API expects specific format
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

            console.log('📤 Sending request to MailerSend API...');

            const response = await axios.post(
                'https://api.mailersend.com/v1/email', // Full URL
                emailData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Hymns-App/1.0'
                    },
                    timeout: 15000
                }
            );

            console.log('✅ Email sent successfully! Status:', response.status);
            return true;

        } catch (error) {
            console.error('❌ Email sending failed!');
            
            if (error.response) {
                // Server responded with error status
                console.error('Status:', error.response.status);
                console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
                
                if (error.response.status === 401) {
                    console.error('❌ Authentication failed - check your API token');
                } else if (error.response.status === 422) {
                    console.error('❌ Validation error - check your email parameters');
                }
            } else if (error.request) {
                // No response received
                console.error('No response received. Check your internet connection.');
            } else {
                // Other error
                console.error('Error message:', error.message);
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
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            ${text.replace(/\n/g, '<br>')}
        </div>
    </div>
</body>
</html>`;
    }

    async sendPasswordResetEmail(email, resetToken, resetLink) {
        const subject = 'Password Reset Request - Hymns App';
        const text = `Hello,

You requested a password reset for your Hymns account.

Reset Link: ${resetLink}

This link expires in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Hymns Team`;

        return await this.sendEmail(email, subject, text);
    }

    // Test configuration
    async testConfiguration() {
        console.log('\n=== MailerSend Configuration Test ===');
        console.log('API Token present:', !!this.apiToken);
        console.log('From Email:', this.fromEmail);
        console.log('From Name:', this.fromName);
        console.log('Base URL:', this.baseUrl);
        
        if (!this.apiToken) {
            console.log('❌ Missing MAILERSEND_API_TOKEN in .env file');
            return false;
        }
        
        if (!this.fromEmail) {
            console.log('❌ Missing MAILERSEND_FROM_EMAIL in .env file');
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

        const testResult = await this.sendEmail(
            toEmail,
            'Test Email from Hymns App',
            'This is a test email to verify your MailerSend configuration is working correctly!'
        );

        return testResult;
    }
}

module.exports = new EmailService();
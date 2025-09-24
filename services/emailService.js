const axios = require('axios');

class EmailService {
    constructor() {
        this.apiToken = process.env.MAILERSEND_API_TOKEN;
        this.fromEmail = process.env.MAILERSEND_FROM_EMAIL;
        this.fromName = process.env.MAILERSEND_FROM_NAME || 'Hymns App';
        this.baseUrl = 'https://api.mailersend.com/v1';
    }

    async sendEmail(to, subject, text, html = null) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/email`,
                {
                    from: {
                        email: this.fromEmail,
                        name: this.fromName
                    },
                    to: [
                        {
                            email: to,
                            name: to.split('@')[0] // Use username as name
                        }
                    ],
                    subject: subject,
                    text: text,
                    html: html || text.replace(/\n/g, '<br>')
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Email sent successfully:', response.data);
            return true;
            
        } catch (error) {
            console.error('Email sending error:', error.response?.data || error.message);
            return false;
        }
    }

    async sendPasswordResetEmail(email, resetToken, resetLink) {
        const subject = 'Password Reset Request - Hymns App';
        const text = `
Hello,

You requested a password reset for your Hymns account.

Please click the following link to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this reset, please ignore this email.

Best regards,
Hymns Team
        `;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; 
                 color: white; text-decoration: none; border-radius: 4px; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; 
                 font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your Hymns account.</p>
        <p>Please click the button below to reset your password:</p>
        <p>
            <a href="${resetLink}" class="button">Reset Password</a>
        </p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <div class="footer">
            <p>Best regards,<br>Hymns Team</p>
        </div>
    </div>
</body>
</html>
        `;

        return await this.sendEmail(email, subject, text, html);
    }

    async sendWelcomeEmail(email, username) {
        const subject = 'Welcome to Hymns App!';
        const text = `
Welcome to Hymns, ${username}!

Thank you for joining our community. You can now:
- Browse thousands of beautiful Orthodox hymns
- Save your favorite hymns
- Download hymns for offline listening
- Receive updates about new content

Start exploring: ${process.env.APP_URL}

Best regards,
Hymns Team
        `;

        return await this.sendEmail(email, subject, text);
    }

    async sendNewsletterNotification(email, hymns) {
        const subject = 'New Hymns Available!';
        const text = `
Hello,

New hymns have been added to the Hymns app that you might enjoy:

${hymns.map(hymn => `- ${hymn.title} (${hymn.hymnLanguage})`).join('\n')}

Login to listen: ${process.env.APP_URL}

Best regards,
Hymns Team
        `;

        return await this.sendEmail(email, subject, text);
    }
}

module.exports = new EmailService();
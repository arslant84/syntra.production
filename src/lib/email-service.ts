import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  cc?: string | string[];
  from?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_USE_SSL === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    console.log('📧 EMAIL_SERVICE: ---- Sending Email ----');
    console.log(`📧 EMAIL_SERVICE: To: ${options.to}`);
    if (options.cc) {
      console.log(`📧 EMAIL_SERVICE: CC: ${options.cc}`);
    }
    console.log(`📧 EMAIL_SERVICE: Subject: ${options.subject}`);
    console.log(`📧 EMAIL_SERVICE: Body length: ${(options.body || options.html)?.length || 0} characters`);
    console.log('📧 EMAIL_SERVICE: -----------------------');

    try {
      const mailOptions = {
        from: options.from || process.env.DEFAULT_FROM_EMAIL || 'VMS System <noreplyvmspctsb@gmail.com>',
        to: options.to,
        cc: options.cc,
        subject: options.subject,
        html: options.html || options.body,
      };

      console.log('📧 EMAIL_SERVICE: Attempting to send email via SMTP...');
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ EMAIL_SERVICE: Email sent successfully:', result.messageId);
    } catch (error) {
      console.error('❌ EMAIL_SERVICE: Failed to send email:', error);
      console.error('❌ EMAIL_SERVICE: Error details:', error.stack);
      throw error;
    }
  }
}

export const emailService = new EmailService();

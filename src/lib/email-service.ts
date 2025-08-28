import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  body?: string;
  html?: string;
  cc?: string | string[];
  from?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Enhanced SMTP configuration for Brevo with custom domain
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_USE_SSL === 'true', // false for port 587
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
      // Enhanced security and performance settings
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      },
      pool: true, // Enable connection pooling
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10, // Max 10 emails per second
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    });

    // Verify the connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('📧 EMAIL_SERVICE: SMTP Connection failed:', error);
      } else {
        console.log('✅ EMAIL_SERVICE: SMTP Connection verified successfully');
        console.log(`📧 EMAIL_SERVICE: Using custom domain: ${process.env.DEFAULT_FROM_EMAIL}`);
      }
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
        from: options.from || process.env.DEFAULT_FROM_EMAIL || 'SynTra TMS <no-reply@pctsb-travel.site>',
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

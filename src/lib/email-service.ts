import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string | string[];
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_USE_SSL === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    console.log('---- Sending Email ----');
    console.log(`To: ${options.to}`);
    if (options.cc) {
      console.log(`CC: ${options.cc}`);
    }
    console.log(`Subject: ${options.subject}`);
    console.log('Body:');
    console.log(options.body);
    console.log('-----------------------');

    try {
      const mailOptions = {
        from: process.env.DEFAULT_FROM_EMAIL || 'VMS System <noreplyvmspctsb@gmail.com>',
        to: options.to,
        cc: options.cc,
        subject: options.subject,
        html: options.body,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();

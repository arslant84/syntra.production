interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string | string[];
}

class EmailService {
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

    // In a real application, you would use a service like Nodemailer, SendGrid, or AWS SES
    // For example, using Nodemailer:
    /*
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      html: options.body,
    });
    */

    return Promise.resolve();
  }
}

export const emailService = new EmailService();

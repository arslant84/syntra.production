import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    const { to, subject = 'Test Email from SynTra TMS' } = await request.json();
    
    if (!to) {
      return NextResponse.json({ error: 'Email recipient required' }, { status: 400 });
    }

    const emailService = new EmailService();
    
    const testEmailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">✅ Email Configuration Test</h2>
        <p>This is a test email to verify that your SynTra TMS email configuration is working correctly.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Configuration Details:</h3>
          <ul>
            <li><strong>SMTP Server:</strong> smtp-relay.brevo.com:587</li>
            <li><strong>From Address:</strong> no-reply@pctsb-travel.site</li>
            <li><strong>Custom Domain:</strong> pctsb-travel.site</li>
            <li><strong>Service:</strong> Brevo (SendinBlue)</li>
          </ul>
        </div>
        
        <p>If you received this email, your email configuration is working properly! ✨</p>
        
        <hr style="margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          This test email was sent from SynTra TMS<br>
          Timestamp: ${new Date().toISOString()}
        </p>
      </div>
    `;

    await emailService.sendEmail({
      to: to,
      subject: subject,
      html: testEmailBody
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test email sent successfully!',
      fromAddress: 'no-reply@pctsb-travel.site',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Test email failed:', error);
    return NextResponse.json({ 
      error: 'Failed to send test email', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/email',
    method: 'POST',
    description: 'Test email configuration',
    usage: {
      to: 'recipient@example.com',
      subject: 'Optional custom subject'
    },
    configuration: {
      smtp_server: 'smtp-relay.brevo.com',
      port: 587,
      from_domain: 'pctsb-travel.site',
      service: 'Brevo (SendinBlue)'
    }
  });
}
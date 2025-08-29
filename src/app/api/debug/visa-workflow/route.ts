import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { EmailService } from '@/lib/email-service';

export async function GET() {
  try {
    console.log('🔍 DEBUG: Starting visa workflow debugging...');

    // 1. Check if approve_visa_focal permission exists
    const visaFocalPermission = await sql`
      SELECT id, name, description FROM permissions WHERE name = 'approve_visa_focal'
    `;
    console.log('📋 Visa focal permission:', visaFocalPermission);

    // 2. Check all visa-related permissions
    const visaPermissions = await sql`
      SELECT id, name, description FROM permissions WHERE name LIKE '%visa%'
    `;
    console.log('📋 All visa permissions:', visaPermissions);

    // 3. Check users with any visa approval permissions
    const visaApprovers = await sql`
      SELECT u.id, u.name, u.email, u.department, r.name as role_name, p.name as permission_name
      FROM users u
      INNER JOIN roles r ON u.role_id = r.id
      INNER JOIN role_permissions rp ON r.id = rp.role_id
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE p.name LIKE '%visa%' OR p.name LIKE '%approve%'
      AND u.status = 'Active'
      ORDER BY u.department, p.name
    `;
    console.log('👥 Users with visa/approval permissions:', visaApprovers);

    // 4. Check if EmailService basic functionality works
    let emailTestResult = { success: false, error: '' };
    try {
      // Test email configuration without sending
      const emailService = new EmailService();
      emailTestResult = { success: true, error: '' };
      console.log('✅ EmailService instantiated successfully');
    } catch (emailError) {
      emailTestResult = { success: false, error: emailError.message };
      console.error('❌ EmailService failed to instantiate:', emailError);
    }

    // 5. Check notification templates
    const notificationTemplates = await sql`
      SELECT id, name, subject, body FROM notification_templates WHERE name LIKE '%visa%'
    `;
    console.log('📧 Visa notification templates:', notificationTemplates);

    // 6. Check recent visa applications
    const recentVisas = await sql`
      SELECT id, applicant_name, destination, status, created_at 
      FROM visa_applications 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    console.log('📄 Recent visa applications:', recentVisas);

    return NextResponse.json({
      success: true,
      debugging_results: {
        visa_focal_permission: visaFocalPermission,
        all_visa_permissions: visaPermissions,
        visa_approvers: visaApprovers,
        email_service_status: emailTestResult,
        notification_templates: notificationTemplates,
        recent_visas: recentVisas,
        recommendations: generateRecommendations(visaFocalPermission, visaApprovers, emailTestResult)
      }
    });

  } catch (error: any) {
    console.error('🚫 DEBUG: Visa workflow debugging failed:', error);
    return NextResponse.json({
      error: 'Debugging failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

function generateRecommendations(permissions: any[], users: any[], emailStatus: any): string[] {
  const recommendations: string[] = [];

  if (permissions.length === 0) {
    recommendations.push("❌ CRITICAL: 'approve_visa_focal' permission does not exist in database. Run: INSERT INTO permissions (name, description) VALUES ('approve_visa_focal', 'Approve visa applications at department focal level')");
  }

  if (users.filter(u => u.permission_name === 'approve_visa_focal').length === 0) {
    recommendations.push("❌ CRITICAL: No users have 'approve_visa_focal' permission. Assign this permission to Department Focal role.");
  }

  if (!emailStatus.success) {
    recommendations.push("❌ CRITICAL: EmailService configuration issue - " + emailStatus.error);
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ All basic components appear to be configured correctly. Check application logs during visa submission for detailed debugging.");
  }

  return recommendations;
}

// Also provide a POST method to test email sending
export async function POST(request: NextRequest) {
  try {
    const { testEmail } = await request.json();
    
    if (!testEmail) {
      return NextResponse.json({ error: 'Please provide testEmail parameter' }, { status: 400 });
    }

    console.log(`🧪 Testing email delivery to: ${testEmail}`);
    
    const emailService = new EmailService();
    
    await emailService.sendEmail({
      to: testEmail,
      subject: 'SynTra TMS - Email System Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">✅ Email System Test Successful</h2>
          <p>This email confirms that your SynTra TMS email configuration is working correctly.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Email Configuration:</h3>
            <ul>
              <li><strong>SMTP Server:</strong> smtp-relay.brevo.com:587</li>
              <li><strong>From Address:</strong> SynTra TMS &lt;no-reply@pctsb-travel.site&gt;</li>
              <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <p style="color: #16a34a;"><strong>✅ Email delivery is working!</strong></p>
          
          <hr style="margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            This test was sent from the SynTra TMS debugging system.
          </p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully!',
      sentTo: testEmail,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('🚫 Email test failed:', error);
    return NextResponse.json({
      error: 'Email test failed',
      details: error.message
    }, { status: 500 });
  }
}
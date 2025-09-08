import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasAnyPermission } from '@/lib/session-utils';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';

const processVisaSchema = z.object({
  action: z.enum(["process", "complete"]),
  processingDetails: z.object({
    paymentMethod: z.string().optional(),
    bankTransferReference: z.string().optional(), 
    chequeNumber: z.string().optional(),
    paymentDate: z.string().optional(),
    applicationFee: z.number().optional(),
    processingFee: z.number().optional(),
    totalFee: z.number().optional(),
    visaNumber: z.string().optional(),
    visaValidFrom: z.string().optional(),
    visaValidTo: z.string().optional(),
    processingNotes: z.string().optional(),
    verifiedBy: z.string().optional(),
    authorizedBy: z.string().optional()
  }).optional(),
  comments: z.string().optional()
});

export const POST = withAuth(async function(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  const { visaId } = await params;
  console.log(`API_VISA_PROCESS_POST_START: Processing visa ${visaId}.`);
  
  const session = (request as any).user;
  
  // Check if user has permission to process visas
  if (!hasAnyPermission(session, ['process_visa_applications', 'manage_visas'])) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = processVisaSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_VISA_PROCESS_POST_VALIDATION_ERROR:", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for visa processing", details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const { action, processingDetails, comments } = validationResult.data;

    const [currentVisa] = await sql`SELECT id, status, requestor_name FROM visa_applications WHERE id = ${visaId}`;
    if (!currentVisa) {
      return NextResponse.json({ error: "Visa application not found" }, { status: 404 });
    }

    // Only allow processing if status is "Processing with Visa Admin"
    if (currentVisa.status !== 'Processing with Visa Admin') {
      return NextResponse.json({ error: `Cannot process visa with status: ${currentVisa.status}` }, { status: 400 });
    }

    let nextStatus = currentVisa.status;
    let stepStatus = "Processed";
    let notificationMessage = "";

    if (action === "process") {
      // This action is not needed in the new workflow - visa admin processes directly
      return NextResponse.json({ error: "Process action is deprecated - visa admin completes directly" }, { status: 400 });
    } else if (action === "complete") {
      // Visa admin completes visa processing
      if (!processingDetails) {
        return NextResponse.json({ error: "Processing details are required when completing visa processing" }, { status: 400 });
      }
      nextStatus = "Processed";
      stepStatus = "Completed";
      notificationMessage = `Your visa application (${visaId}) has been processed and completed.`;
    }

    const result = await sql.begin(async tx => {
      // Update visa status
      const updateFields: any = {
        status: nextStatus,
        last_updated_date: 'NOW()'
      };

      // Set processing timestamps
      if (action === "process") {
        updateFields.processing_started_at = 'NOW()';
      } else if (action === "complete") {
        updateFields.processing_completed_at = 'NOW()';
      }

      // Complete visa processing with details
      if (action === "complete" && processingDetails) {
        const processingDetailsJson = JSON.stringify(processingDetails);
        const [updatedVisa] = await tx`
          UPDATE visa_applications
          SET status = ${nextStatus}, 
              last_updated_date = NOW(), 
              processing_details = ${processingDetailsJson},
              processing_completed_at = NOW()
          WHERE id = ${visaId}
          RETURNING *
        `;
        
        // Update or insert approval step for Visa Admin
        await tx`
          INSERT INTO visa_approval_steps (visa_id, step_role, step_name, status, step_date, comments)
          VALUES (${visaId}, 'Visa Admin', 'Visa Administrator', ${stepStatus}, NOW(), ${comments || `Visa processing completed with details`})
          ON CONFLICT (visa_id, step_role) 
          DO UPDATE SET 
            status = ${stepStatus},
            step_date = NOW(),
            comments = ${comments || `Visa processing completed with details`}
        `;
        
        return updatedVisa;
      } else {
        return NextResponse.json({ error: "Invalid action or missing processing details" }, { status: 400 });
      }
    });

    const updated = result && result.length > 0 ? result[0] : result;
    
    if (!updated) {
      console.error(`API_VISA_PROCESS_POST_ERROR: Failed to update visa ${visaId}`);
      return NextResponse.json({ error: 'Failed to update visa' }, { status: 500 });
    }
    
    // Send enhanced workflow notifications
    try {
      // Get visa details including applicant information
      const visaDetails = await sql`
        SELECT 
          va.user_id, 
          va.requestor_name, 
          va.staff_id, 
          va.travel_purpose,
          va.email as direct_email,
          u.email as user_match_email,
          u2.email as staff_match_email,
          COALESCE(va.email, u.email, u2.email) as email,
          COALESCE(va.user_id, u.id, u2.id) as user_id_ref
        FROM visa_applications va
        LEFT JOIN users u ON va.user_id = u.id
        LEFT JOIN users u2 ON va.staff_id IS NOT NULL AND va.staff_id = u2.staff_id
        WHERE va.id = ${visaId}
      `;

      if (visaDetails.length > 0) {
        const visaInfo = visaDetails[0];
        
        // Send 5-stage workflow notification
        if (action === 'complete') {
          // This is the final admin completion stage
          await UnifiedNotificationService.notifyAdminCompletion({
            entityType: 'visa',
            entityId: visaId,
            requestorId: visaInfo.user_id_ref,
            requestorName: visaInfo.requestor_name || 'User',
            requestorEmail: visaInfo.email,
            adminName: session.name || session.email || 'Visa Administrator',
            entityTitle: visaInfo.travel_purpose || `Visa Application ${visaId}`,
            completionDetails: comments || 'Visa processing completed by Visa Admin'
          });
        } else {
          // For processing, notify status change
          await UnifiedNotificationService.notifyStatusUpdate({
            entityType: 'visa',
            entityId: visaId,
            requestorId: visaInfo.user_id_ref,
            requestorName: visaInfo.requestor_name || 'User',
            requestorEmail: visaInfo.email,
            newStatus: updated.status,
            previousStatus: currentVisa.status,
            updateReason: 'Visa processing started by administrator',
            entityTitle: visaInfo.travel_purpose || `Visa Application ${visaId}`
          });
        }

        console.log(`✅ Created enhanced workflow notifications for visa ${visaId} ${action} by Visa Admin`);
      }
    } catch (notificationError) {
      console.error(`❌ Failed to create enhanced workflow notifications for visa ${visaId}:`, notificationError);
      // Don't fail the visa action due to notification errors
    }

    console.log(`API_VISA_PROCESS_POST: Visa ${visaId} ${action} processed. New status: ${updated.status}`);
    
    return NextResponse.json({ 
      message: `Visa ${action}ed successfully.`, 
      visa: updated,
      processingDetails: action === "complete" ? processingDetails : undefined
    });

  } catch (error: any) {
    console.error(`API_VISA_PROCESS_POST_ERROR for visa ${visaId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process visa.', details: error.message }, { status: 500 });
  }
});
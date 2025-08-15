import { sql } from './db';
import { TransportRequestForm, TransportRequestSummary, TransportDetails, TransportApprovalStep } from '@/types/transport';
import { generateRequestId } from '@/utils/requestIdGenerator';

import { emailService } from './email-service';
import { NotificationEventType } from '@/types/notifications';

export class TransportService {
  // Create a new transport request
  static async createTransportRequest(data: Partial<TransportRequestForm>): Promise<TransportRequestForm> {
    const { userId, ...requestData } = data;
    if (!userId) {
      throw new Error('User ID is required to create a transport request');
    }
    
    // Generate transport request ID using the standard naming convention
    const context = requestData.transportDetails?.[0]?.transportType 
      ? requestData.transportDetails[0].transportType.replace(/\s+/g, '').toUpperCase()
      : 'GEN'; // Default context
    const transportId = generateRequestId('TRN', context);
    
    try {
      const transportRequest = await sql.begin(async (sql) => {
        const [request] = await sql`
          INSERT INTO transport_requests (
            id, requestor_name, staff_id, department, position, 
            purpose, status,
            tsr_reference, additional_comments, confirm_policy, 
            confirm_manager_approval, confirm_terms_and_conditions, created_by,
            submitted_at
          ) VALUES (
            ${transportId}, ${requestData.requestorName}, ${requestData.staffId ?? null}, ${requestData.department ?? null}, ${requestData.position ?? null}, 
            ${requestData.purpose}, 'Pending Department Focal', 
            ${requestData.tsrReference ?? null}, ${requestData.additionalComments ?? null}, ${requestData.confirmPolicy ?? null}, 
            ${requestData.confirmManagerApproval ?? null}, ${requestData.confirmTermsAndConditions ?? null}, ${userId},
            NOW()
          )
          RETURNING *
        `;

        if (data.transportDetails && data.transportDetails.length > 0) {
          for (const detail of data.transportDetails) {
            await sql`
              INSERT INTO transport_details (
                transport_request_id, date, day, from_location, to_location,
                departure_time, transport_type, vehicle_type,
                number_of_passengers
              ) VALUES (
                ${transportId}, ${detail.date}, ${detail.day}, ${detail.from}, ${detail.to},
                ${detail.departureTime}, ${detail.transportType}, 'Minivan',
                ${detail.numberOfPassengers}
              )
            `;
          }
        }

        // Record initial submission (TRF-style - only record actual actions)
        await sql`
          INSERT INTO transport_approval_steps (
            transport_request_id, role, name, status, date, comments
          ) VALUES (
            ${transportId}, 
            'Requestor', 
            ${requestData.requestorName || 'Unknown'}, 
            'Submitted',
            NOW(), 
            'Request submitted'
          )
        `;

        // Set initial status based on workflow
        if (!requestData.status) {
          await sql`
            UPDATE transport_requests 
            SET status = 'Pending Department Focal'
            WHERE id = ${transportId}
          `;
        }

        return request;
      });

      // Send notification
      const template = await sql`SELECT subject, body FROM notification_templates WHERE name = ${'new_transport_request' as NotificationEventType}`;
      if (template.length > 0) {
        const subject = template[0].subject.replace('{requestId}', transportId);
        const body = template[0].body.replace('{requestorName}', requestData.requestorName || 'User').replace('{requestId}', transportId);
        
        // For now, send to a placeholder email. In a real app, determine actual recipient.
        await emailService.sendEmail({
          to: 'approver@example.com', // Placeholder
          cc: 'requestor@example.com', // Placeholder
          subject,
          body,
        });
      }

      return this.getTransportRequestById(transportId);
    } catch (error) {
      console.error('Error creating transport request:', error);
      throw new Error('Failed to create transport request');
    }
  }
  
  // Get transport request by ID
  static async getTransportRequestById(id: string): Promise<TransportRequestForm | null> {
    try {
      const [transportRequest] = await sql`
        SELECT * FROM transport_requests WHERE id = ${id}
      `;

      if (!transportRequest) {
        return null;
      }

      const detailsResult = await sql`
        SELECT * FROM transport_details WHERE transport_request_id = ${id} ORDER BY date, departure_time
      `;

      const approvalResult = await sql`
        SELECT * FROM transport_approval_steps WHERE transport_request_id = ${id} ORDER BY created_at
      `;

      // Generate the complete approval workflow including expected pending steps
      const fullApprovalWorkflow = this.generateFullApprovalWorkflow(
        transportRequest.status, 
        approvalResult,
        transportRequest.requestor_name
      );

      return {
        id: transportRequest.id,
        requestorName: transportRequest.requestor_name,
        staffId: transportRequest.staff_id,
        department: transportRequest.department,
        position: transportRequest.position,
        purpose: transportRequest.purpose,
        status: transportRequest.status,
        tsrReference: transportRequest.tsr_reference,
        additionalComments: transportRequest.additional_comments,
        confirmPolicy: transportRequest.confirm_policy,
        confirmManagerApproval: transportRequest.confirm_manager_approval,
        confirmTermsAndConditions: transportRequest.confirm_terms_and_conditions,
        transportDetails: detailsResult.map((row: any) => ({
          id: row.id,
          date: row.date,
          day: row.day,
          from: row.from_location,
          to: row.to_location,
          departureTime: row.departure_time,
          transportType: row.transport_type,
          numberOfPassengers: row.number_of_passengers
        })),
        approvalWorkflow: fullApprovalWorkflow,
        submittedAt: transportRequest.created_at,
        updatedAt: transportRequest.updated_at,
        createdBy: transportRequest.created_by,
        updatedBy: transportRequest.updated_by
      };
    } catch (error) {
      console.error(`Error fetching transport request by ID ${id}:`, error);
      throw new Error('Failed to fetch transport request by ID');
    }
  }
  
  // Get all transport requests for a user
  static async getTransportRequestsByUser(userId?: string): Promise<TransportRequestSummary[]> {
    try {
      let query;
      if (userId) {
        query = sql`
          SELECT 
            tr.id,
            tr.requestor_name,
            tr.department,
            tr.purpose,
            tr.status,
            tr.created_at as submitted_at,
            tr.tsr_reference
          FROM transport_requests tr
          WHERE tr.created_by = ${userId}
          ORDER BY tr.created_at DESC
        `;
      } else {
        query = sql`
          SELECT 
            tr.id,
            tr.requestor_name,
            tr.department,
            tr.purpose,
            tr.status,
            tr.created_at as submitted_at,
            tr.tsr_reference
          FROM transport_requests tr
          ORDER BY tr.created_at DESC
        `;
      }
      const result = await query;
      return result.map((row: any) => ({
        id: row.id,
        requestorName: row.requestor_name,
        department: row.department,
        purpose: row.purpose,
        status: row.status,
        submittedAt: row.submitted_at,
        tsrReference: row.tsr_reference
      }));
    } catch (error) {
      console.error('Error fetching transport requests by user:', error);
      throw new Error('Failed to fetch transport requests by user');
    }
  }
  
  // Get transport requests by statuses (for approval queue) with optional user filtering
  static async getTransportRequestsByStatuses(statuses: string[], limit?: number, userId?: string): Promise<TransportRequestSummary[]> {
    try {
      let query;
      
      if (userId) {
        // Filter by user ID for non-admin users
        if (limit) {
          query = sql`
            SELECT 
              tr.id,
              tr.requestor_name,
              tr.department,
              tr.purpose,
              tr.status,
              tr.created_at as submitted_at,
              tr.tsr_reference
            FROM transport_requests tr
            WHERE tr.status = ANY(${statuses})
              AND (tr.created_by = ${userId} OR tr.staff_id = ${userId})
            ORDER BY tr.created_at DESC
            LIMIT ${limit}
          `;
        } else {
          query = sql`
            SELECT 
              tr.id,
              tr.requestor_name,
              tr.department,
              tr.purpose,
              tr.status,
              tr.created_at as submitted_at,
              tr.tsr_reference
            FROM transport_requests tr
            WHERE tr.status = ANY(${statuses})
              AND (tr.created_by = ${userId} OR tr.staff_id = ${userId})
            ORDER BY tr.created_at DESC
          `;
        }
      } else {
        // Admin users can see all transport requests
        if (limit) {
          query = sql`
            SELECT 
              tr.id,
              tr.requestor_name,
              tr.department,
              tr.purpose,
              tr.status,
              tr.created_at as submitted_at,
              tr.tsr_reference
            FROM transport_requests tr
            WHERE tr.status = ANY(${statuses})
            ORDER BY tr.created_at DESC
            LIMIT ${limit}
          `;
        } else {
          query = sql`
            SELECT 
              tr.id,
              tr.requestor_name,
              tr.department,
              tr.purpose,
              tr.status,
              tr.created_at as submitted_at,
              tr.tsr_reference
            FROM transport_requests tr
            WHERE tr.status = ANY(${statuses})
            ORDER BY tr.created_at DESC
          `;
        }
      }

      const result = await query;
      return result.map((row: any) => ({
        id: row.id,
        requestorName: row.requestor_name,
        department: row.department,
        purpose: row.purpose,
        status: row.status,
        submittedAt: row.submitted_at?.toISOString?.() || row.submitted_at,
        tsrReference: row.tsr_reference
      }));
    } catch (error) {
      console.error('Error fetching transport requests by statuses:', error);
      throw new Error('Failed to fetch transport requests by statuses');
    }
  }

  // Get all transport requests (with optional user filtering)
  static async getAllTransportRequests(userId?: string): Promise<TransportRequestSummary[]> {
    try {
      let result;
      if (userId) {
        // Filter by user ID for non-admin users
        result = await sql`
          SELECT 
            tr.id,
            tr.requestor_name,
            tr.department,
            tr.purpose,
            tr.status,
            tr.created_at as submitted_at,
            tr.tsr_reference
          FROM transport_requests tr
          WHERE tr.created_by = ${userId} OR tr.staff_id = ${userId}
          ORDER BY tr.created_at DESC
        `;
      } else {
        // Admin users can see all transport requests
        result = await sql`
          SELECT 
            tr.id,
            tr.requestor_name,
            tr.department,
            tr.purpose,
            tr.status,
            tr.created_at as submitted_at,
            tr.tsr_reference
          FROM transport_requests tr
          ORDER BY tr.created_at DESC
        `;
      }
      
      return result.map((row: any) => ({
        id: row.id,
        requestorName: row.requestor_name,
        department: row.department,
        purpose: row.purpose,
        status: row.status,
        submittedAt: row.submitted_at,
        tsrReference: row.tsr_reference
      }));
    } catch (error) {
      console.error('Error fetching all transport requests:', error);
      throw new Error('Failed to fetch all transport requests');
    }
  }

  // Get transport requests by date range (with optional user filtering)
  static async getTransportRequestsByDateRange(fromDate: Date, toDate: Date, userId?: string): Promise<TransportRequestSummary[]> {
    try {
      let result;
      if (userId) {
        // Filter by user ID for non-admin users
        result = await sql`
          SELECT 
            tr.id,
            tr.requestor_name,
            tr.department,
            tr.purpose,
            tr.status,
            tr.created_at as submitted_at,
            tr.tsr_reference
          FROM transport_requests tr
          WHERE tr.created_at >= ${fromDate.toISOString()} AND tr.created_at <= ${toDate.toISOString()}
            AND (tr.created_by = ${userId} OR tr.staff_id = ${userId})
          ORDER BY tr.created_at DESC
        `;
      } else {
        // Admin users can see all transport requests
        result = await sql`
          SELECT 
            tr.id,
            tr.requestor_name,
            tr.department,
            tr.purpose,
            tr.status,
            tr.created_at as submitted_at,
            tr.tsr_reference
          FROM transport_requests tr
          WHERE tr.created_at >= ${fromDate.toISOString()} AND tr.created_at <= ${toDate.toISOString()}
          ORDER BY tr.created_at DESC
        `;
      }
      
      return result.map((row: any) => ({
        id: row.id,
        requestorName: row.requestor_name,
        department: row.department,
        purpose: row.purpose,
        status: row.status,
        submittedAt: row.submitted_at,
        tsrReference: row.tsr_reference
      }));
    } catch (error) {
      console.error('Error fetching transport requests by date range:', error);
      throw new Error('Failed to fetch transport requests by date range');
    }
  }
  
  // Update transport request
  static async updateTransportRequest(id: string, data: Partial<TransportRequestForm>, userId: string): Promise<TransportRequestForm> {
    try {
      const transportRequest = await sql.begin(async (sql) => {
        await sql`
          UPDATE transport_requests SET
            requestor_name = ${data.requestorName},
            staff_id = ${data.staffId ?? null},
            department = ${data.department ?? null},
            position = ${data.position ?? null},
            purpose = ${data.purpose},
            status = ${data.status},
            tsr_reference = ${data.tsrReference ?? null},
            additional_comments = ${data.additionalComments ?? null},
            confirm_policy = ${data.confirmPolicy ?? null},
            confirm_manager_approval = ${data.confirmManagerApproval ?? null},
            confirm_terms_and_conditions = ${data.confirmTermsAndConditions ?? null},
            updated_by = ${userId ?? null},
            updated_at = NOW()
          WHERE id = ${id}
        `;

        await sql`DELETE FROM transport_details WHERE transport_request_id = ${id}`;

        if (data.transportDetails && data.transportDetails.length > 0) {
          for (const detail of data.transportDetails) {
            await sql`
              INSERT INTO transport_details (
                transport_request_id, date, day, from_location, to_location,
                departure_time, transport_type, vehicle_type,
                number_of_passengers
              ) VALUES (
                ${id}, ${detail.date}, ${detail.day}, ${detail.from}, ${detail.to},
                ${detail.departureTime}, ${detail.transportType}, 'Minivan',
                ${detail.numberOfPassengers}
              )
            `;
          }
        }

        // Note: Approval workflow is no longer pre-created or updated during edit
        // Approval steps are only added when actual approval actions are taken (TRF-style)
      });

      return this.getTransportRequestById(id);
    } catch (error) {
      console.error(`Error updating transport request ${id}:`, error);
      throw new Error('Failed to update transport request');
    }
  }
  
  // Delete transport request
  static async deleteTransportRequest(id: string): Promise<void> {
    try {
      await sql`DELETE FROM transport_requests WHERE id = ${id}`;
    } catch (error) {
      console.error(`Error deleting transport request ${id}:`, error);
      throw new Error('Failed to delete transport request');
    }
  }
  
  // Create transport request from TSR
  static async createFromTSR(tsrId: string, transportData: Partial<TransportRequestForm>, userId: string): Promise<TransportRequestForm> {
    // Add TSR reference to the transport request
    const dataWithTSR = {
      ...transportData,
      tsrReference: tsrId,
      userId
    };
    
    return this.createTransportRequest(dataWithTSR);
  }

  // Handle approval actions (TRF-style workflow)
  static async processApprovalAction(
    transportRequestId: string, 
    action: 'approve' | 'reject', 
    approverRole: string, 
    approverName: string, 
    comments?: string
  ): Promise<TransportRequestForm> {
    try {
      // Define approval workflow sequence (like TRF)
      const approvalWorkflowSequence: Record<string, string | null> = {
        "Pending Department Focal": "Pending Line Manager",
        "Pending Line Manager": "Pending HOD", 
        "Pending HOD": "Approved"
      };

      const terminalStatuses = ["Approved", "Rejected", "Cancelled"];

      const result = await sql.begin(async (sql) => {
        // Get current transport request
        const [transportRequest] = await sql`
          SELECT * FROM transport_requests WHERE id = ${transportRequestId}
        `;

        if (!transportRequest) {
          throw new Error('Transport request not found');
        }

        const currentStatus = transportRequest.status;

        // Check if already in terminal state
        if (terminalStatuses.includes(currentStatus)) {
          throw new Error(`Transport request is already in terminal state: ${currentStatus}`);
        }

        let newStatus = currentStatus;

        if (action === 'reject') {
          newStatus = 'Rejected';
        } else if (action === 'approve') {
          // Get next status from workflow sequence
          const nextStatus = approvalWorkflowSequence[currentStatus];
          
          if (nextStatus) {
            newStatus = nextStatus;
          } else {
            // If no next step defined, mark as approved
            newStatus = 'Approved';
          }
        }

        // Update transport request status
        await sql`
          UPDATE transport_requests 
          SET status = ${newStatus}, updated_at = NOW()
          WHERE id = ${transportRequestId}
        `;

        // Record the approval step (TRF-style - only record actual actions)
        await sql`
          INSERT INTO transport_approval_steps (
            transport_request_id, role, name, status, date, comments
          ) VALUES (
            ${transportRequestId}, 
            ${approverRole}, 
            ${approverName}, 
            ${action === 'approve' ? 'Approved' : 'Rejected'},
            NOW(), 
            ${comments || (action === 'approve' ? 'Approved' : 'Rejected')}
          )
        `;

        return { success: true };
      });

      return this.getTransportRequestById(transportRequestId);
    } catch (error) {
      console.error(`Error processing approval action for transport request ${transportRequestId}:`, error);
      throw new Error(`Failed to process approval action: ${error.message}`);
    }
  }

  // Generate full approval workflow including pending steps (similar to TRF approach)
  private static generateFullApprovalWorkflow(
    currentStatus: string, 
    completedSteps: any[],
    requestorName?: string
  ): TransportApprovalStep[] {
    // Define the expected workflow sequence
    const expectedWorkflow = [
      { role: 'Requestor', name: requestorName || 'System', status: 'Submitted' as const },
      { role: 'Department Focal', name: 'TBD', status: 'Pending' as const },
      { role: 'Line Manager', name: 'TBD', status: 'Pending' as const },
      { role: 'HOD', name: 'TBD', status: 'Pending' as const }
    ];

    // Map completed steps by role for easy lookup
    const completedByRole = completedSteps.reduce((acc: any, step: any) => {
      acc[step.role] = step;
      return acc;
    }, {});

    // Generate the full workflow
    const fullWorkflow: TransportApprovalStep[] = [];

    for (const expectedStep of expectedWorkflow) {
      const completedStep = completedByRole[expectedStep.role];
      
      if (completedStep) {
        // Use the completed step data
        fullWorkflow.push({
          role: completedStep.role,
          name: completedStep.name,
          status: completedStep.status,
          date: completedStep.date,
          comments: completedStep.comments
        });
      } else {
        // Determine status based on current request status
        let stepStatus: TransportApprovalStep['status'] = 'Pending';
        
        if (currentStatus === 'Rejected' || currentStatus === 'Cancelled') {
          stepStatus = 'Not Started';
        } else if (currentStatus === 'Approved') {
          // If approved, all pending steps should show as not started unless they were actually completed
          stepStatus = 'Not Started';
        } else if (currentStatus === `Pending ${expectedStep.role}`) {
          stepStatus = 'Current';
        }

        fullWorkflow.push({
          role: expectedStep.role,
          name: expectedStep.name,
          status: stepStatus,
          date: undefined,
          comments: undefined
        });
      }
    }

    return fullWorkflow;
  }
} 
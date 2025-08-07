import { sql } from './db';
import { TransportRequestForm, TransportRequestSummary, TransportDetails, TransportApprovalStep } from '@/types/transport';
import { generateRequestId } from '@/utils/requestIdGenerator';

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
            id, requestor_name, staff_id, department, position, cost_center, 
            tel_email, email, purpose, status,
            tsr_reference, additional_comments, confirm_policy, 
            confirm_manager_approval, confirm_terms_and_conditions, created_by,
            submitted_at
          ) VALUES (
            ${transportId}, ${requestData.requestorName}, ${requestData.staffId ?? null}, ${requestData.department ?? null}, ${requestData.position ?? null}, ${requestData.costCenter ?? null}, 
            ${requestData.telEmail ?? null}, ${requestData.email ?? null}, ${requestData.purpose}, 'Pending Department Focal', 
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

        // Create default approval workflow if none provided
        const approvalWorkflow = data.approvalWorkflow && data.approvalWorkflow.length > 0 
          ? data.approvalWorkflow 
          : [
              {
                role: 'Requestor',
                name: requestData.requestorName || 'Unknown',
                status: 'Approved',
                date: new Date(),
                comments: 'Request submitted'
              },
              {
                role: 'Department Focal',
                name: 'Department Focal',
                status: 'Pending',
                date: null,
                comments: null
              },
              {
                role: 'Line Manager',
                name: 'Line Manager',
                status: 'Not Started',
                date: null,
                comments: null
              },
              {
                role: 'HOD',
                name: 'HOD',
                status: 'Not Started',
                date: null,
                comments: null
              }
            ];

        for (const step of approvalWorkflow) {
          await sql`
            INSERT INTO transport_approval_steps (
              transport_request_id, role, name, status, date, comments
            ) VALUES (
              ${transportId}, ${step.role}, ${step.name}, ${step.status}, ${step.date}, ${step.comments}
            )
          `;
        }

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

      return {
        id: transportRequest.id,
        requestorName: transportRequest.requestor_name,
        staffId: transportRequest.staff_id,
        department: transportRequest.department,
        position: transportRequest.position,
        costCenter: transportRequest.cost_center,
        telEmail: transportRequest.tel_email,
        email: transportRequest.email,
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
        approvalWorkflow: approvalResult.map((row: any) => ({
          role: row.role,
          name: row.name,
          status: row.status,
          date: row.date,
          comments: row.comments
        })),
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
  
  // Get transport requests by statuses (for approval queue)
  static async getTransportRequestsByStatuses(statuses: string[], limit?: number): Promise<TransportRequestSummary[]> {
    try {
      let query = sql`
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

  // Get all transport requests (for admin)
  static async getAllTransportRequests(): Promise<TransportRequestSummary[]> {
    try {
      const result = await sql`
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

  // Get transport requests by date range
  static async getTransportRequestsByDateRange(fromDate: Date, toDate: Date): Promise<TransportRequestSummary[]> {
    try {
      const result = await sql`
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
            cost_center = ${data.costCenter ?? null},
            tel_email = ${data.telEmail ?? null},
            email = ${data.email ?? null},
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
        await sql`DELETE FROM transport_approval_steps WHERE transport_request_id = ${id}`;

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

        if (data.approvalWorkflow && data.approvalWorkflow.length > 0) {
          for (const step of data.approvalWorkflow) {
            await sql`
              INSERT INTO transport_approval_steps (
                transport_request_id, role, name, status, date, comments
              ) VALUES (
                ${id}, ${step.role}, ${step.name}, ${step.status}, ${step.date}, ${step.comments}
              )
            `;
          }
        }
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

  // Handle approval actions
  static async processApprovalAction(
    transportRequestId: string, 
    action: 'approve' | 'reject', 
    approverRole: string, 
    approverName: string, 
    comments?: string
  ): Promise<TransportRequestForm> {
    try {
      const result = await sql.begin(async (sql) => {
        // Get current transport request
        const [transportRequest] = await sql`
          SELECT * FROM transport_requests WHERE id = ${transportRequestId}
        `;

        if (!transportRequest) {
          throw new Error('Transport request not found');
        }

        // Get current approval steps
        const approvalSteps = await sql`
          SELECT * FROM transport_approval_steps 
          WHERE transport_request_id = ${transportRequestId}
          ORDER BY 
            CASE role 
              WHEN 'Requestor' THEN 1
              WHEN 'Department Focal' THEN 2
              WHEN 'Line Manager' THEN 3
              WHEN 'HOD' THEN 4
              ELSE 5
            END
        `;

        // Find the current step for this approver role
        const currentStep = approvalSteps.find((step: any) => step.role === approverRole);
        if (!currentStep) {
          throw new Error(`No approval step found for role: ${approverRole}`);
        }

        // Update the current step
        await sql`
          UPDATE transport_approval_steps 
          SET 
            status = ${action === 'approve' ? 'Approved' : 'Rejected'},
            name = ${approverName},
            date = ${new Date()},
            comments = ${comments || ''}
          WHERE transport_request_id = ${transportRequestId} AND role = ${approverRole}
        `;

        // Determine the new overall status
        let newStatus = transportRequest.status;

        if (action === 'reject') {
          newStatus = 'Rejected';
        } else if (action === 'approve') {
          // Check what the next step should be
          const roleOrder = ['Requestor', 'Department Focal', 'Line Manager', 'HOD'];
          const currentRoleIndex = roleOrder.indexOf(approverRole);
          
          if (currentRoleIndex < roleOrder.length - 1) {
            // Move to next approval step
            const nextRole = roleOrder[currentRoleIndex + 1];
            newStatus = `Pending ${nextRole}`;
            
            // Update next step status to Pending
            await sql`
              UPDATE transport_approval_steps 
              SET status = 'Pending'
              WHERE transport_request_id = ${transportRequestId} AND role = ${nextRole}
            `;
          } else {
            // All approvals complete
            newStatus = 'Approved';
          }
        }

        // Update transport request status
        await sql`
          UPDATE transport_requests 
          SET status = ${newStatus}, updated_at = ${new Date()}
          WHERE id = ${transportRequestId}
        `;

        return { success: true };
      });

      return this.getTransportRequestById(transportRequestId);
    } catch (error) {
      console.error(`Error processing approval action for transport request ${transportRequestId}:`, error);
      throw new Error(`Failed to process approval action: ${error.message}`);
    }
  }
} 
import { sql } from './db';
import { TransportService } from './transport-service';
import { generateRequestId } from '@/utils/requestIdGenerator';
import { formatISO } from 'date-fns';

export interface TSRData {
  id: string;
  travelType: string;
  requestorName: string;
  staffId?: string;
  department?: string;
  position?: string;
  purpose: string;
  domesticTravelDetails?: {
    accommodationDetails?: any[];
    companyTransportDetails?: any[];
  };
  externalPartiesTravelDetails?: {
    accommodationDetails?: any[];
  };
  overseasTravelDetails?: {
    itinerary?: any[];
  };
}

export class TSRAutoGenerationService {
  /**
   * Auto-generate Transport and Accommodation requests based on TSR data
   */
  static async autoGenerateRequests(tsrData: TSRData, userId: string) {
    const generatedRequests = {
      transportRequests: [] as string[],
      accommodationRequests: [] as string[]
    };

    try {
      // Fetch complete TSR data from database to get stored transport and accommodation details
      const completesTsrData = await this.fetchCompleteTsrData(tsrData.id);
      
      // Generate Transport requests from company transport details (stored in database)
      if (completesTsrData.companyTransportDetails?.length > 0) {
        const transportRequestId = await this.generateTransportRequestFromDb(completesTsrData, tsrData, userId);
        if (transportRequestId) {
          generatedRequests.transportRequests.push(transportRequestId);
        }
      }

      // Generate Accommodation requests from accommodation details (stored in database)
      if (completesTsrData.accommodationDetails?.length > 0) {
        for (const accommodationDetail of completesTsrData.accommodationDetails) {
          const accommodationRequestId = await this.generateAccommodationRequest(tsrData, accommodationDetail, userId);
          if (accommodationRequestId) {
            generatedRequests.accommodationRequests.push(accommodationRequestId);
          }
        }
      }

      console.log(`TSR_AUTO_GEN: Generated ${generatedRequests.transportRequests.length} transport requests and ${generatedRequests.accommodationRequests.length} accommodation requests for TSR ${tsrData.id}`);
      
      return generatedRequests;
    } catch (error) {
      console.error(`TSR_AUTO_GEN_ERROR: Failed to auto-generate requests for TSR ${tsrData.id}:`, error);
      throw error;
    }
  }

  /**
   * Fetch complete TSR data from database including transport and accommodation details
   */
  private static async fetchCompleteTsrData(tsrId: string) {
    try {
      // Fetch company transport details from database
      const companyTransportDetails = await sql`
        SELECT 
          transport_date as date,
          day_of_week as day,
          from_location as "from",
          to_location as "to",
          bt_no_required,
          accommodation_type_n,
          address,
          remarks
        FROM trf_company_transport_details 
        WHERE trf_id = ${tsrId}
        ORDER BY transport_date, from_location
      `;

      // Fetch accommodation details from database
      const accommodationDetails = await sql`
        SELECT 
          id,
          accommodation_type as "accommodationType",
          check_in_date as "checkInDate",
          check_out_date as "checkOutDate",
          location,
          place_of_stay as "placeOfStay",
          estimated_cost_per_night as "estimatedCostPerNight",
          remarks
        FROM trf_accommodation_details 
        WHERE trf_id = ${tsrId}
      `;

      return {
        companyTransportDetails: companyTransportDetails.map(detail => ({
          ...detail,
          date: detail.date ? new Date(detail.date) : null
        })),
        accommodationDetails: accommodationDetails.map(detail => ({
          ...detail,
          checkInDate: detail.checkInDate ? new Date(detail.checkInDate) : null,
          checkOutDate: detail.checkOutDate ? new Date(detail.checkOutDate) : null,
          estimatedCostPerNight: detail.estimatedCostPerNight || 0
        }))
      };
    } catch (error) {
      console.error(`TSR_AUTO_GEN_ERROR: Failed to fetch complete TSR data for ${tsrId}:`, error);
      return { companyTransportDetails: [], accommodationDetails: [] };
    }
  }

  /**
   * Generate Transport request from database-stored TSR company transport details
   */
  private static async generateTransportRequestFromDb(completeTsrData: any, tsrData: TSRData, userId: string): Promise<string | null> {
    try {
      const transportDetails = completeTsrData.companyTransportDetails || [];
      
      if (transportDetails.length === 0) {
        return null;
      }

      // Map database transport details to Transport request format
      const mappedTransportDetails = transportDetails
        .filter((detail: any) => detail.from && detail.to && detail.date) // Only include complete details
        .map((detail: any) => ({
          date: detail.date,
          day: detail.day || '',
          from: detail.from,
          to: detail.to,
          departureTime: '09:00', // Default time since TSR doesn't store departure time
          transportType: 'Local' as const, // Default transport type
          numberOfPassengers: 1 // Default number of passengers
        }));

      if (mappedTransportDetails.length === 0) {
        console.log(`TSR_AUTO_GEN: No valid transport details found in database for TSR ${tsrData.id}`);
        return null;
      }

      // Create transport request using TransportService
      const transportRequestData = {
        requestorName: tsrData.requestorName,
        staffId: tsrData.staffId,
        department: tsrData.department,
        position: tsrData.position,
        purpose: `Auto-generated from TSR: ${tsrData.purpose}`,
        transportDetails: mappedTransportDetails,
        tsrReference: tsrData.id,
        additionalComments: `Automatically generated from Travel Service Request ${tsrData.id}`,
        confirmPolicy: true,
        confirmManagerApproval: true,
        confirmTermsAndConditions: true,
        userId: userId
      };

      const transportRequest = await TransportService.createTransportRequest(transportRequestData);
      console.log(`TSR_AUTO_GEN: Created transport request ${transportRequest.id} from database TSR ${tsrData.id} company transport details`);
      
      return transportRequest.id;
    } catch (error) {
      console.error(`TSR_AUTO_GEN_ERROR: Failed to generate transport request from database for TSR ${tsrData.id}:`, error);
      return null;
    }
  }

  /**
   * Generate Transport request from TSR company transport details (legacy method for form data)
   */
  private static async generateTransportRequest(tsrData: TSRData, userId: string): Promise<string | null> {
    try {
      const transportDetails = tsrData.domesticTravelDetails?.companyTransportDetails || [];
      
      if (transportDetails.length === 0) {
        return null;
      }

      // Map TSR transport details to Transport request format
      const mappedTransportDetails = transportDetails
        .filter(detail => detail.from && detail.to && detail.date) // Only include complete details
        .map(detail => ({
          date: detail.date,
          day: detail.day || '',
          from: detail.from,
          to: detail.to,
          departureTime: detail.departureTime || '09:00', // Use provided time or default
          transportType: (detail.transportType || 'Local') as const,
          numberOfPassengers: detail.numberOfPassengers || 1
        }));

      if (mappedTransportDetails.length === 0) {
        console.log(`TSR_AUTO_GEN: No valid transport details found for TSR ${tsrData.id}`);
        return null;
      }

      // Create transport request using TransportService
      const transportRequestData = {
        requestorName: tsrData.requestorName,
        staffId: tsrData.staffId,
        department: tsrData.department,
        position: tsrData.position,
        purpose: `Auto-generated from TSR: ${tsrData.purpose}`,
        transportDetails: mappedTransportDetails,
        tsrReference: tsrData.id,
        additionalComments: `Automatically generated from Travel Service Request ${tsrData.id}`,
        confirmPolicy: true,
        confirmManagerApproval: true,
        confirmTermsAndConditions: true,
        userId: userId
      };

      const transportRequest = await TransportService.createTransportRequest(transportRequestData);
      console.log(`TSR_AUTO_GEN: Created transport request ${transportRequest.id} from TSR ${tsrData.id}`);
      
      return transportRequest.id;
    } catch (error) {
      console.error(`TSR_AUTO_GEN_ERROR: Failed to generate transport request for TSR ${tsrData.id}:`, error);
      return null;
    }
  }

  /**
   * Generate Accommodation request from TSR accommodation details
   */
  private static async generateAccommodationRequest(tsrData: TSRData, accommodationDetail: any, userId: string): Promise<string | null> {
    try {
      if (!accommodationDetail.checkInDate || !accommodationDetail.checkOutDate) {
        console.log(`TSR_AUTO_GEN: Skipping accommodation detail without dates for TSR ${tsrData.id}`);
        return null;
      }

      // Determine location based on accommodation type or default to Kiyanly
      let location = 'Kiyanly'; // Default location
      if (accommodationDetail.location) {
        // Map location if provided
        const locationMap: { [key: string]: string } = {
          'ashgabat': 'Ashgabat',
          'kiyanly': 'Kiyanly', 
          'turkmenbashy': 'Turkmenbashy'
        };
        location = locationMap[accommodationDetail.location.toLowerCase()] || 'Kiyanly';
      }

      // Determine gender (default to Male if not specified)
      const requestorGender = 'Male'; // TODO: This should come from user profile or be specified in TSR

      // Generate accommodation request ID
      const contextForAccomId = location.substring(0, 5).toUpperCase();
      const accomRequestId = generateRequestId('ACCOM', contextForAccomId);

      // Create accommodation request
      await sql.begin(async (tx) => {
        // First, create a travel request entry
        const [newTravelRequest] = await tx`
          INSERT INTO travel_requests (
            id, requestor_name, staff_id, department, travel_type, status, 
            additional_comments, submitted_at, created_by
          ) VALUES (
            ${accomRequestId}, ${tsrData.requestorName}, ${tsrData.staffId || null}, 
            ${tsrData.department || null}, 'Accommodation', 'Pending Department Focal', 
            ${`Auto-generated from TSR ${tsrData.id}: ${tsrData.purpose}`}, NOW(), ${userId}
          ) RETURNING *
        `;
        
        // Then create the accommodation details entry linked to the travel request
        await tx`
          INSERT INTO trf_accommodation_details (
            trf_id, check_in_date, check_out_date, accommodation_type, location, 
            place_of_stay, estimated_cost_per_night, remarks, created_at
          ) VALUES (
            ${newTravelRequest.id}, 
            ${formatISO(new Date(accommodationDetail.checkInDate), { representation: 'date' })},
            ${formatISO(new Date(accommodationDetail.checkOutDate), { representation: 'date' })}, 
            ${accommodationDetail.accommodationType || 'Staff House/PKC Kampung/Kiyanly camp'}, 
            ${location},
            ${accommodationDetail.placeOfStay || ''},
            ${accommodationDetail.estimatedCostPerNight || 0},
            ${accommodationDetail.remarks || 'Auto-generated from TSR'},
            NOW()
          )
        `;
        
        // Create initial approval step
        await tx`
          INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
          VALUES (${newTravelRequest.id}, 'Requestor', ${tsrData.requestorName}, 'Approved', NOW(), 'Auto-generated accommodation request from TSR.')
        `;
      });

      console.log(`TSR_AUTO_GEN: Created accommodation request ${accomRequestId} from TSR ${tsrData.id}`);
      return accomRequestId;
    } catch (error) {
      console.error(`TSR_AUTO_GEN_ERROR: Failed to generate accommodation request for TSR ${tsrData.id}:`, error);
      return null;
    }
  }

  /**
   * Update existing auto-generated requests when TSR is updated
   */
  static async updateAutoGeneratedRequests(tsrData: TSRData, userId: string) {
    try {
      // Find existing auto-generated requests linked to this TSR
      const existingTransportRequests = await sql`
        SELECT id FROM transport_requests 
        WHERE tsr_reference = ${tsrData.id}
      `;

      const existingAccommodationRequests = await sql`
        SELECT id FROM travel_requests 
        WHERE additional_comments LIKE ${'%' + tsrData.id + '%'} 
        AND travel_type = 'Accommodation'
      `;

      // Delete existing auto-generated requests to recreate them
      for (const request of existingTransportRequests) {
        await TransportService.deleteTransportRequest(request.id);
        console.log(`TSR_AUTO_GEN: Deleted existing transport request ${request.id} for TSR ${tsrData.id}`);
      }

      for (const request of existingAccommodationRequests) {
        await this.deleteAccommodationRequest(request.id);
        console.log(`TSR_AUTO_GEN: Deleted existing accommodation request ${request.id} for TSR ${tsrData.id}`);
      }

      // Generate new requests with updated data
      return await this.autoGenerateRequests(tsrData, userId);
    } catch (error) {
      console.error(`TSR_AUTO_GEN_UPDATE_ERROR: Failed to update auto-generated requests for TSR ${tsrData.id}:`, error);
      throw error;
    }
  }

  /**
   * Delete accommodation request and related data
   */
  private static async deleteAccommodationRequest(requestId: string): Promise<void> {
    try {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM trf_accommodation_details WHERE trf_id = ${requestId}`;
        await tx`DELETE FROM trf_approval_steps WHERE trf_id = ${requestId}`;
        await tx`DELETE FROM travel_requests WHERE id = ${requestId}`;
      });
    } catch (error) {
      console.error(`TSR_AUTO_GEN_ERROR: Failed to delete accommodation request ${requestId}:`, error);
      throw error;
    }
  }

  /**
   * Get auto-generated requests for a TSR
   */
  static async getAutoGeneratedRequests(tsrId: string) {
    try {
      const transportRequests = await sql`
        SELECT id, requestor_name, status, created_at
        FROM transport_requests 
        WHERE tsr_reference = ${tsrId}
        ORDER BY created_at DESC
      `;

      const accommodationRequests = await sql`
        SELECT id, requestor_name, status, submitted_at
        FROM travel_requests 
        WHERE additional_comments LIKE ${'%' + tsrId + '%'} 
        AND travel_type = 'Accommodation'
        ORDER BY submitted_at DESC
      `;

      return {
        transportRequests: transportRequests.map(req => ({
          id: req.id,
          requestorName: req.requestor_name,
          status: req.status,
          createdAt: req.created_at
        })),
        accommodationRequests: accommodationRequests.map(req => ({
          id: req.id,
          requestorName: req.requestor_name,
          status: req.status,
          createdAt: req.submitted_at
        }))
      };
    } catch (error) {
      console.error(`TSR_AUTO_GEN_ERROR: Failed to get auto-generated requests for TSR ${tsrId}:`, error);
      return { transportRequests: [], accommodationRequests: [] };
    }
  }
}
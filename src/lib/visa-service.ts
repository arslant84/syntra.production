
import { sql } from '@/lib/db';
import { type VisaApplication, type VisaPurpose } from '@/types/visa';

export async function getVisaApplicationById(id: string): Promise<VisaApplication | null> {
  try {
    const [application] = await sql`
      SELECT
        id,
        user_id as "userId",
        applicant_name as "applicantName",
        employee_id as "employeeId",
        travel_purpose as "travelPurpose",
        trip_start_date as "tripStartDate",
        trip_end_date as "tripEndDate",
        passport_number as "passportNumber",
        passport_expiry_date as "passportExpiryDate",
        status,
        itinerary_details as "itineraryDetails",
        supporting_documents_notes as "supportingDocumentsNotes",
        submitted_date as "submittedDate",
        last_updated_date as "lastUpdatedDate"
      FROM
        visa_applications
      WHERE
        id = ${id}
    `;

    if (!application) {
      return null;
    }

    return application as VisaApplication;
  } catch (error) {
    console.error(`Error fetching visa application with ID ${id}:`, error);
    throw new Error('Failed to fetch visa application');
  }
}

export async function updateVisaApplication(id: string, applicationData: Partial<VisaApplication>): Promise<VisaApplication> {
    // Extract properties that exist in VisaApplication type
    const {
        applicantName,
        employeeId,
        travelPurpose,
        tripStartDate,
        tripEndDate,
        passportNumber,
        passportExpiryDate,
        status,
        itineraryDetails,
        supportingDocumentsNotes
    } = applicationData;

    try {
        const [updatedApplication] = await sql`
            UPDATE visa_applications
            SET
                applicant_name = ${applicantName || null},
                employee_id = ${employeeId || null},
                travel_purpose = ${travelPurpose || null},
                trip_start_date = ${tripStartDate || null},
                trip_end_date = ${tripEndDate || null},
                passport_number = ${passportNumber || null},
                passport_expiry_date = ${passportExpiryDate || null},
                status = ${status || null},
                itinerary_details = ${itineraryDetails || null},
                supporting_documents_notes = ${supportingDocumentsNotes || null},
                last_updated_date = NOW()
            WHERE
                id = ${id}
            RETURNING
                id,
                user_id as "userId",
                applicant_name as "applicantName",
                employee_id as "employeeId",
                travel_purpose as "travelPurpose",
                trip_start_date as "tripStartDate",
                trip_end_date as "tripEndDate",
                passport_number as "passportNumber",
                passport_expiry_date as "passportExpiryDate",
                status,
                itinerary_details as "itineraryDetails",
                supporting_documents_notes as "supportingDocumentsNotes",
                submitted_date as "submittedDate",
                last_updated_date as "lastUpdatedDate"
        `;
        return updatedApplication as VisaApplication;
    } catch (error) {
        console.error(`Error updating visa application with ID ${id}:`, error);
        throw new Error('Failed to update visa application');
    }
}

export async function createVisaApplication(applicationData: Omit<VisaApplication, 'id' | 'submittedDate' | 'lastUpdatedDate'>): Promise<VisaApplication> {
    const {
        userId,
        applicantName,
        employeeId,
        travelPurpose,
        tripStartDate,
        tripEndDate,
        passportNumber,
        passportExpiryDate,
        status,
        itineraryDetails,
        supportingDocumentsNotes
    } = applicationData;

    try {
        const [newApplication] = await sql`
            INSERT INTO visa_applications (
                user_id,
                applicant_name,
                employee_id,
                travel_purpose,
                trip_start_date,
                trip_end_date,
                passport_number,
                passport_expiry_date,
                status,
                itinerary_details,
                supporting_documents_notes,
                submitted_date,
                last_updated_date
            )
            VALUES (
                ${userId},
                ${applicantName},
                ${employeeId},
                ${travelPurpose as string},
                ${tripStartDate},
                ${tripEndDate},
                ${passportNumber},
                ${passportExpiryDate},
                ${status},
                ${itineraryDetails || null},
                ${supportingDocumentsNotes || null},
                NOW(),
                NOW()
            )
            RETURNING
                id,
                user_id as "userId",
                applicant_name as "applicantName",
                employee_id as "employeeId",
                travel_purpose as "travelPurpose",
                trip_start_date as "tripStartDate",
                trip_end_date as "tripEndDate",
                passport_number as "passportNumber",
                passport_expiry_date as "passportExpiryDate",
                status,
                itinerary_details as "itineraryDetails",
                supporting_documents_notes as "supportingDocumentsNotes",
                submitted_date as "submittedDate",
                last_updated_date as "lastUpdatedDate"
        `;
        return newApplication as VisaApplication;
    } catch (error) {
        console.error('Error creating visa application:', error);
        throw new Error('Failed to create visa application');
    }
}

export async function getAllVisaApplications(filters?: {
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
}): Promise<VisaApplication[]> {
    try {
        const { status, userId, limit = 50, offset = 0 } = filters || {};
        
        let query;
        
        if (status && userId) {
            query = sql`
                SELECT
                    id,
                    user_id as "userId",
                    applicant_name as "applicantName",
                    employee_id as "employeeId",
                    travel_purpose as "travelPurpose",
                    trip_start_date as "tripStartDate",
                    trip_end_date as "tripEndDate",
                    passport_number as "passportNumber",
                    passport_expiry_date as "passportExpiryDate",
                    status,
                    itinerary_details as "itineraryDetails",
                    supporting_documents_notes as "supportingDocumentsNotes",
                    submitted_date as "submittedDate",
                    last_updated_date as "lastUpdatedDate"
                FROM visa_applications
                WHERE status = ${status} AND user_id = ${userId}
                ORDER BY submitted_date DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else if (status) {
            query = sql`
                SELECT
                    id,
                    user_id as "userId",
                    applicant_name as "applicantName",
                    employee_id as "employeeId",
                    travel_purpose as "travelPurpose",
                    trip_start_date as "tripStartDate",
                    trip_end_date as "tripEndDate",
                    passport_number as "passportNumber",
                    passport_expiry_date as "passportExpiryDate",
                    status,
                    itinerary_details as "itineraryDetails",
                    supporting_documents_notes as "supportingDocumentsNotes",
                    submitted_date as "submittedDate",
                    last_updated_date as "lastUpdatedDate"
                FROM visa_applications
                WHERE status = ${status}
                ORDER BY submitted_date DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else if (userId) {
            query = sql`
                SELECT
                    id,
                    user_id as "userId",
                    applicant_name as "applicantName",
                    employee_id as "employeeId",
                    travel_purpose as "travelPurpose",
                    trip_start_date as "tripStartDate",
                    trip_end_date as "tripEndDate",
                    passport_number as "passportNumber",
                    passport_expiry_date as "passportExpiryDate",
                    status,
                    itinerary_details as "itineraryDetails",
                    supporting_documents_notes as "supportingDocumentsNotes",
                    submitted_date as "submittedDate",
                    last_updated_date as "lastUpdatedDate"
                FROM visa_applications
                WHERE user_id = ${userId}
                ORDER BY submitted_date DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else {
            query = sql`
                SELECT
                    id,
                    user_id as "userId",
                    applicant_name as "applicantName",
                    employee_id as "employeeId",
                    travel_purpose as "travelPurpose",
                    trip_start_date as "tripStartDate",
                    trip_end_date as "tripEndDate",
                    passport_number as "passportNumber",
                    passport_expiry_date as "passportExpiryDate",
                    status,
                    itinerary_details as "itineraryDetails",
                    supporting_documents_notes as "supportingDocumentsNotes",
                    submitted_date as "submittedDate",
                    last_updated_date as "lastUpdatedDate"
                FROM visa_applications
                ORDER BY submitted_date DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        }
        
        const applications = await query;
        return applications.map((app: any) => ({
            ...app,
            tripStartDate: app.tripStartDate ? new Date(app.tripStartDate) : null,
            tripEndDate: app.tripEndDate ? new Date(app.tripEndDate) : null,
            passportExpiryDate: app.passportExpiryDate ? new Date(app.passportExpiryDate) : null,
            submittedDate: new Date(app.submittedDate),
            lastUpdatedDate: new Date(app.lastUpdatedDate)
        })) as VisaApplication[];
    } catch (error) {
        console.error('Error fetching visa applications:', error);
        throw new Error('Failed to fetch visa applications');
    }
}

export async function deleteVisaApplication(id: string): Promise<void> {
    try {
        await sql`
            DELETE FROM visa_applications
            WHERE id = ${id}
        `;
    } catch (error) {
        console.error(`Error deleting visa application with ID ${id}:`, error);
        throw new Error('Failed to delete visa application');
    }
}

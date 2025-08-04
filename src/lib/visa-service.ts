
import { sql } from '@/lib/db';
import { type VisaApplication } from '@/types/visa';

export async function getVisaApplicationById(id: string): Promise<VisaApplication | null> {
  try {
    const [application] = await sql`
      SELECT
        id,
        user_id as "userId",
        requestor_name as "requestorName",
        staff_id as "staffId",
        department,
        position,
        email,
        destination,
        travel_purpose as "travelPurpose",
        visa_type as "visaType",
        trip_start_date as "tripStartDate",
        trip_end_date as "tripEndDate",
        passport_number as "passportNumber",
        passport_expiry_date as "passportExpiryDate",
        status,
        additional_comments as "additionalComments",
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
    const {
        requestorName,
        staffId,
        department,
        position,
        email,
        destination,
        travelPurpose,
        visaType,
        tripStartDate,
        tripEndDate,
        passportNumber,
        passportExpiryDate,
        status,
        additionalComments
    } = applicationData;

    try {
        const [updatedApplication] = await sql`
            UPDATE visa_applications
            SET
                requestor_name = ${requestorName},
                staff_id = ${staffId},
                department = ${department},
                position = ${position},
                email = ${email},
                destination = ${destination},
                travel_purpose = ${travelPurpose},
                visa_type = ${visaType},
                trip_start_date = ${tripStartDate},
                trip_end_date = ${tripEndDate},
                passport_number = ${passportNumber},
                passport_expiry_date = ${passportExpiryDate},
                status = ${status},
                additional_comments = ${additionalComments},
                last_updated_date = NOW()
            WHERE
                id = ${id}
            RETURNING
                id,
                user_id as "userId",
                requestor_name as "requestorName",
                staff_id as "staffId",
                department,
                position,
                email,
                destination,
                travel_purpose as "travelPurpose",
                visa_type as "visaType",
                trip_start_date as "tripStartDate",
                trip_end_date as "tripEndDate",
                passport_number as "passportNumber",
                passport_expiry_date as "passportExpiryDate",
                status,
                additional_comments as "additionalComments",
                submitted_date as "submittedDate",
                last_updated_date as "lastUpdatedDate"
        `;
        return updatedApplication as VisaApplication;
    } catch (error) {
        console.error(`Error updating visa application with ID ${id}:`, error);
        throw new Error('Failed to update visa application');
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

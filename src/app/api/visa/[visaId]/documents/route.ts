// src/app/api/visa/[visaId]/documents/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'visa-documents');

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// GET: List all documents for a visa application
export async function GET(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  const { visaId } = await params;
  console.log(`API_VISA_DOCUMENTS_GET: Fetching documents for visa ${visaId}`);

  // Check permissions
  if (!await hasPermission('process_visa_applications') && !await hasPermission('view_visa_applications')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized' }, { status: 503 });
  }

  try {
    // Verify visa application exists
    const visaApp = await sql`
      SELECT id FROM visa_applications WHERE id = ${visaId}
    `;

    if (visaApp.length === 0) {
      return NextResponse.json({ error: 'Visa application not found' }, { status: 404 });
    }

    // Get all documents for this visa application
    const documents = await sql`
      SELECT 
        id,
        document_type as "documentType",
        file_name as "fileName",
        file_path as "filePath",
        uploaded_at as "uploadedAt"
      FROM visa_documents 
      WHERE visa_application_id = ${visaId}
      ORDER BY uploaded_at DESC
    `;

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('API_VISA_DOCUMENTS_GET_ERROR:', error);
    return NextResponse.json({ error: 'Failed to fetch documents', details: error.message }, { status: 500 });
  }
}

// POST: Upload a document for a visa application
export async function POST(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  const { visaId } = await params;
  console.log(`API_VISA_DOCUMENTS_POST: Uploading document for visa ${visaId}`);

  // Check permissions
  if (!await hasPermission('process_visa_applications') && !await hasPermission('create_trf')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized' }, { status: 503 });
  }

  try {
    // Verify visa application exists
    const visaApp = await sql`
      SELECT id FROM visa_applications WHERE id = ${visaId}
    `;

    if (visaApp.length === 0) {
      return NextResponse.json({ error: 'Visa application not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string || 'passport_copy';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only PDF, JPG, PNG, and WebP files are allowed' 
      }, { status: 400 });
    }

    // Ensure upload directory exists
    await ensureUploadDir();

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uniqueFileName = `${visaId}_${documentType}_${timestamp}${fileExtension}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFileName);

    // Save file to filesystem
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save document record to database
    const [newDocument] = await sql`
      INSERT INTO visa_documents (
        visa_application_id,
        document_type,
        file_name,
        file_path,
        uploaded_at,
        created_at,
        updated_at
      ) VALUES (
        ${visaId},
        ${documentType},
        ${file.name},
        ${filePath},
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    console.log(`API_VISA_DOCUMENTS_POST: Document uploaded successfully for visa ${visaId}`);

    return NextResponse.json({
      message: 'Document uploaded successfully',
      document: {
        id: newDocument.id,
        documentType: newDocument.document_type,
        fileName: newDocument.file_name,
        uploadedAt: newDocument.uploaded_at
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('API_VISA_DOCUMENTS_POST_ERROR:', error);
    return NextResponse.json({ error: 'Failed to upload document', details: error.message }, { status: 500 });
  }
}
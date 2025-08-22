// src/app/api/visa/[visaId]/documents/[documentId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasAnyPermission } from '@/lib/session-utils';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// GET: Download a specific document
export const GET = withAuth(async function(
  request: NextRequest, 
  { params }: { params: Promise<{ visaId: string; documentId: string }> }
) {
  const { visaId, documentId } = await params;
  console.log(`API_VISA_DOCUMENT_GET: Downloading document ${documentId} for visa ${visaId}`);

  const session = (request as any).user;
  
  // Check permissions
  if (!hasAnyPermission(session, ['process_visa_applications', 'view_visa_applications', 'create_trf'])) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized' }, { status: 503 });
  }

  try {
    // Get document details
    const document = await sql`
      SELECT 
        id,
        visa_id,
        document_type,
        document_name,
        document_path
      FROM visa_documents 
      WHERE id = ${documentId} 
      AND visa_id = ${visaId}
    `;

    if (document.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = document[0];

    // Check if file exists
    if (!existsSync(doc.document_path)) {
      console.error(`File not found at path: ${doc.document_path}`);
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(doc.document_path);
    
    // Determine content type
    const extension = path.extname(doc.document_name).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (extension) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
    }

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${doc.document_name}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('API_VISA_DOCUMENT_GET_ERROR:', error);
    return NextResponse.json({ error: 'Failed to download document', details: error.message }, { status: 500 });
  }
});

// DELETE: Remove a document
export const DELETE = withAuth(async function(
  request: NextRequest, 
  { params }: { params: Promise<{ visaId: string; documentId: string }> }
) {
  const { visaId, documentId } = await params;
  console.log(`API_VISA_DOCUMENT_DELETE: Deleting document ${documentId} for visa ${visaId}`);

  const session = (request as any).user;
  
  // Check permissions (only process visa applications can delete)
  if (!hasAnyPermission(session, ['process_visa_applications'])) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized' }, { status: 503 });
  }

  try {
    // Get document details before deletion
    const document = await sql`
      SELECT 
        id,
        visa_id,
        document_path,
        document_name
      FROM visa_documents 
      WHERE id = ${documentId} 
      AND visa_id = ${visaId}
    `;

    if (document.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = document[0];

    // Delete from database first
    await sql`
      DELETE FROM visa_documents 
      WHERE id = ${documentId} 
      AND visa_id = ${visaId}
    `;

    // Then delete file from filesystem (if exists)
    if (existsSync(doc.document_path)) {
      try {
        await unlink(doc.document_path);
        console.log(`File deleted: ${doc.document_path}`);
      } catch (fileError) {
        console.error(`Failed to delete file ${doc.document_path}:`, fileError);
        // Continue anyway since database record is deleted
      }
    }

    console.log(`API_VISA_DOCUMENT_DELETE: Document ${documentId} deleted successfully`);
    
    return NextResponse.json({
      message: 'Document deleted successfully',
      deletedDocument: {
        id: doc.id,
        fileName: doc.document_name
      }
    });

  } catch (error: any) {
    console.error('API_VISA_DOCUMENT_DELETE_ERROR:', error);
    return NextResponse.json({ error: 'Failed to delete document', details: error.message }, { status: 500 });
  }
});
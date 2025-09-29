"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Trash2, 
  Paperclip, 
  Upload,
  Loader2,
  AlertTriangle,
  Eye,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface VisaDocument {
  id: string;
  documentType: string;
  fileName: string;
  uploadedAt: string;
}

interface VisaDocumentsProps {
  visaId: string;
  canUpload?: boolean;
  canDelete?: boolean;
  className?: string;
}

const getDocumentIcon = (fileName: string) => {
  const extension = fileName.toLowerCase().split('.').pop();
  switch (extension) {
    case 'pdf':
      return <FileText className="w-4 h-4 text-red-500" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
      return <Eye className="w-4 h-4 text-blue-500" />;
    default:
      return <FileText className="w-4 h-4 text-gray-500" />;
  }
};

const getDocumentTypeLabel = (documentType: string) => {
  switch (documentType) {
    case 'passport_copy':
      return 'Passport Copy';
    case 'supporting_document':
      return 'Supporting Document';
    case 'visa_copy':
      return 'Visa Copy';
    case 'invitation_letter':
      return 'Invitation Letter';
    default:
      return documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
};

const getDocumentTypeBadge = (documentType: string) => {
  switch (documentType) {
    case 'passport_copy':
      return 'default';
    case 'visa_copy':
      return 'default';
    case 'supporting_document':
      return 'secondary';
    default:
      return 'outline';
  }
};

export default function VisaDocuments({ 
  visaId, 
  canUpload = false, 
  canDelete = false,
  className 
}: VisaDocumentsProps) {
  const [documents, setDocuments] = useState<VisaDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/visa/${visaId}/documents`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // No documents found, this is okay
          setDocuments([]);
          return;
        }
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch documents: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setDocuments(result.documents || []);
    } catch (err: any) {
      console.error('Error fetching documents:', err);
      setError(err.message);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visaId) {
      fetchDocuments();
    }
  }, [visaId]);

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/visa/${visaId}/documents/${documentId}`);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to download document: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `${fileName} is being downloaded.`,
        variant: "default",
      });
    } catch (err: any) {
      console.error('Error downloading document:', err);
      toast({
        title: "Download Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/visa/${visaId}/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to delete document: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Refresh documents list
      await fetchDocuments();
      
      toast({
        title: "Document Deleted",
        description: `${fileName} has been deleted.`,
        variant: "default",
      });
    } catch (err: any) {
      console.error('Error deleting document:', err);
      toast({
        title: "Delete Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only PDF, JPG, PNG, and WebP files are allowed.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 'supporting_document');

      const response = await fetch(`/api/visa/${visaId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to upload document: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Refresh documents list
      await fetchDocuments();
      
      toast({
        title: "Document Uploaded",
        description: `${file.name} has been uploaded successfully.`,
        variant: "default",
      });

      // Clear file input
      event.target.value = '';
    } catch (err: any) {
      console.error('Error uploading document:', err);
      toast({
        title: "Upload Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("shadow-md print:shadow-none print:border-none", className)}>
        <CardHeader className="print:p-0 print:mb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 print:text-base">
            <Paperclip className="w-5 h-5 text-primary print:hidden" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="print:p-0">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-md print:shadow-none print:border-none print:break-inside-avoid", className)}>
      <CardHeader className="print:p-0 print:mb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 print:text-base">
            <Paperclip className="w-5 h-5 text-primary print:hidden" />
            Documents {documents.length > 0 && <Badge variant="secondary">{documents.length}</Badge>}
          </CardTitle>
          {canUpload && (
            <div className="print:hidden">
              <input
                type="file"
                id="document-upload"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => document.getElementById('document-upload')?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="print:p-0">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Paperclip className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No documents uploaded yet</p>
            {canUpload && (
              <p className="text-xs mt-1">Use the upload button above to add documents</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc, index) => (
              <div key={doc.id}>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg print:bg-transparent print:border print:border-muted">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getDocumentIcon(doc.fileName)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <Badge variant={getDocumentTypeBadge(doc.documentType)}>
                          {getDocumentTypeLabel(doc.documentType)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {format(new Date(doc.uploadedAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 print:hidden">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(doc.id, doc.fileName)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(doc.id, doc.fileName)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {index < documents.length - 1 && <Separator className="print:hidden" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
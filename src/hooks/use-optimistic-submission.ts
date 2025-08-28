import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface OptimisticSubmissionOptions<T> {
  onSubmit: (data: T) => Promise<any>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  optimisticUpdate?: () => void;
  rollbackUpdate?: () => void;
  successMessage?: string;
  errorMessage?: string;
}

interface OptimisticSubmissionState {
  isSubmitting: boolean;
  isOptimisticSuccess: boolean;
  error: string | null;
}

/**
 * Hook for handling optimistic UI updates during form submissions
 * 
 * This hook provides:
 * 1. Immediate UI feedback
 * 2. Automatic error handling with rollback
 * 3. Toast notifications
 * 4. Loading state management
 * 
 * @example
 * ```tsx
 * const { submit, state } = useOptimisticSubmission({
 *   onSubmit: async (data) => {
 *     const response = await fetch('/api/submit', {
 *       method: 'POST',
 *       body: JSON.stringify(data)
 *     });
 *     return response.json();
 *   },
 *   optimisticUpdate: () => {
 *     // Update UI immediately - close form, show success, etc.
 *     setFormOpen(false);
 *     addToList(optimisticData);
 *   },
 *   rollbackUpdate: () => {
 *     // Rollback if submission fails
 *     setFormOpen(true);
 *     removeFromList(optimisticData.id);
 *   },
 *   successMessage: "Request submitted successfully!"
 * });
 * ```
 */
export function useOptimisticSubmission<T>({
  onSubmit,
  onSuccess,
  onError,
  optimisticUpdate,
  rollbackUpdate,
  successMessage = 'Submitted successfully',
  errorMessage = 'Submission failed'
}: OptimisticSubmissionOptions<T>) {
  const [state, setState] = useState<OptimisticSubmissionState>({
    isSubmitting: false,
    isOptimisticSuccess: false,
    error: null
  });

  const { toast } = useToast();

  const submit = useCallback(async (data: T) => {
    try {
      // Start submission
      setState({
        isSubmitting: true,
        isOptimisticSuccess: false,
        error: null
      });

      // Apply optimistic update immediately
      optimisticUpdate?.();

      // Mark as optimistically successful
      setState(prev => ({
        ...prev,
        isOptimisticSuccess: true
      }));

      // Actually submit to server
      const result = await onSubmit(data);

      // Submission successful - keep optimistic state
      setState({
        isSubmitting: false,
        isOptimisticSuccess: true,
        error: null
      });

      // Show success message
      toast({
        title: 'Success',
        description: successMessage,
      });

      onSuccess?.(result);

      return result;

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      // Rollback optimistic changes
      rollbackUpdate?.();

      // Update state with error
      setState({
        isSubmitting: false,
        isOptimisticSuccess: false,
        error: errorObj.message
      });

      // Show error message
      toast({
        title: 'Error',
        description: errorObj.message || errorMessage,
        variant: 'destructive',
      });

      onError?.(errorObj);

      throw errorObj;
    }
  }, [
    onSubmit,
    onSuccess,
    onError,
    optimisticUpdate,
    rollbackUpdate,
    successMessage,
    errorMessage,
    toast
  ]);

  const reset = useCallback(() => {
    setState({
      isSubmitting: false,
      isOptimisticSuccess: false,
      error: null
    });
  }, []);

  return {
    submit,
    state,
    reset,
    // Convenience getters
    isSubmitting: state.isSubmitting,
    isSuccess: state.isOptimisticSuccess,
    error: state.error,
    hasError: !!state.error
  };
}

/**
 * Hook for optimistic approval actions (approve/reject)
 */
export function useOptimisticApproval(
  entityId: string,
  entityType: string,
  onClose?: () => void
) {
  return useOptimisticSubmission({
    onSubmit: async ({ action, comments }: { action: 'approve' | 'reject'; comments?: string }) => {
      const response = await fetch(`/api/${entityType}/${entityId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to ${action} ${entityType}`);
      }

      return response.json();
    },
    optimisticUpdate: () => {
      // Close the approval dialog immediately
      onClose?.();
    },
    rollbackUpdate: () => {
      // Could reopen dialog or show error state
    },
    successMessage: 'Action completed successfully'
  });
}

/**
 * Hook for optimistic form submissions with dialog management
 */
export function useOptimisticFormSubmission<T>(
  submitEndpoint: string,
  {
    onClose,
    onSuccessRedirect,
    method = 'POST'
  }: {
    onClose?: () => void;
    onSuccessRedirect?: string;
    method?: 'POST' | 'PUT' | 'PATCH';
  } = {}
) {
  return useOptimisticSubmission<T>({
    onSubmit: async (data: T) => {
      const response = await fetch(submitEndpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Submission failed');
      }

      return response.json();
    },
    optimisticUpdate: () => {
      // Close form/dialog immediately
      onClose?.();
    },
    onSuccess: (result) => {
      // Optionally redirect after success
      if (onSuccessRedirect) {
        window.location.href = onSuccessRedirect;
      }
    },
    rollbackUpdate: () => {
      // Reopen form on error
      // Could implement reopening logic here
    }
  });
}

export default useOptimisticSubmission;
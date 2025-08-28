import React, { useState, useCallback } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { InlineLoading } from '@/components/ui/loading';
import { cn } from '@/lib/utils';

interface SubmitButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick: () => Promise<void> | void;
  loadingText?: string;
  preventMultipleClicks?: boolean;
  debounceMs?: number;
  children: React.ReactNode;
}

/**
 * Enhanced submit button that:
 * 1. Shows loading state during async operations
 * 2. Prevents multiple clicks during processing
 * 3. Provides visual feedback
 * 4. Can debounce rapid clicks
 */
export const SubmitButton: React.FC<SubmitButtonProps> = ({
  onClick,
  loadingText,
  preventMultipleClicks = true,
  debounceMs = 300,
  disabled,
  children,
  className,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);

  const handleClick = useCallback(async () => {
    if (isLoading && preventMultipleClicks) {
      return; // Prevent clicks while loading
    }

    // Debounce rapid clicks
    const now = Date.now();
    if (debounceMs > 0 && (now - lastClickTime) < debounceMs) {
      return;
    }
    setLastClickTime(now);

    try {
      setIsLoading(true);
      await onClick();
    } catch (error) {
      console.error('Submit button error:', error);
      throw error; // Re-throw to allow parent error handling
    } finally {
      setIsLoading(false);
    }
  }, [onClick, isLoading, preventMultipleClicks, debounceMs, lastClickTime]);

  const isDisabled = disabled || isLoading;

  return (
    <Button
      {...props}
      disabled={isDisabled}
      onClick={handleClick}
      className={cn(
        'relative transition-opacity',
        isLoading && 'cursor-not-allowed',
        className
      )}
    >
      {isLoading && <InlineLoading className="mr-2" size="sm" />}
      <span className={cn(isLoading && 'opacity-70')}>
        {isLoading && loadingText ? loadingText : children}
      </span>
    </Button>
  );
};

interface FormSubmitButtonProps extends SubmitButtonProps {
  form?: string; // HTML form attribute
  type?: 'submit' | 'button';
}

/**
 * Form-specific submit button with additional form handling
 */
export const FormSubmitButton: React.FC<FormSubmitButtonProps> = ({
  type = 'submit',
  ...props
}) => {
  return <SubmitButton {...props} type={type} />;
};

interface AsyncActionButtonProps extends SubmitButtonProps {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  showToast?: boolean;
}

/**
 * Button for async actions with built-in success/error handling
 */
export const AsyncActionButton: React.FC<AsyncActionButtonProps> = ({
  onClick,
  onSuccess,
  onError,
  successMessage = 'Action completed successfully',
  errorMessage = 'Action failed',
  showToast = true,
  ...props
}) => {
  const { toast } = showToast ? require('@/hooks/use-toast').useToast() : { toast: null };

  const handleAsyncClick = useCallback(async () => {
    try {
      await onClick();
      
      if (showToast && toast) {
        toast({
          title: 'Success',
          description: successMessage,
        });
      }
      
      onSuccess?.();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      if (showToast && toast) {
        toast({
          title: 'Error',
          description: errorObj.message || errorMessage,
          variant: 'destructive',
        });
      }
      
      onError?.(errorObj);
      throw errorObj; // Re-throw for parent handling
    }
  }, [onClick, onSuccess, onError, successMessage, errorMessage, showToast, toast]);

  return <SubmitButton {...props} onClick={handleAsyncClick} />;
};

export default SubmitButton;
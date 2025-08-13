"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function ToastTest() {
  const { toast } = useToast();

  const showSuccessToast = () => {
    toast({
      title: "Success!",
      description: "This is a success toast notification.",
      variant: "default",
    });
  };

  const showErrorToast = () => {
    toast({
      title: "Error!",
      description: "This is an error toast notification.",
      variant: "destructive",
    });
  };

  const showInfoToast = () => {
    toast({
      title: "Information",
      description: "This is an informational toast notification.",
    });
  };

  return (
    <div className="flex gap-4 p-4">
      <Button onClick={showSuccessToast} variant="default">
        Show Success Toast
      </Button>
      <Button onClick={showErrorToast} variant="destructive">
        Show Error Toast
      </Button>
      <Button onClick={showInfoToast} variant="outline">
        Show Info Toast
      </Button>
    </div>
  );
}

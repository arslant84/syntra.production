
"use client";

import React from 'react';
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

interface TrfStepperProps {
  currentStep: number;
  steps: string[];
  onStepClick?: (step: number) => void;
  completedSteps?: boolean[]; // To show checkmarks for completed steps
}

export default function TrfStepper({ currentStep, steps, onStepClick, completedSteps }: TrfStepperProps) {
  return (
    <div className="flex items-center justify-center border-b border-border/60 bg-muted/20 rounded-t-md">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = completedSteps ? completedSteps[index] : stepNumber < currentStep;
        const isActive = currentStep === stepNumber;
        
        return (
          <button
            key={label}
            onClick={() => onStepClick?.(stepNumber)}
            disabled={!onStepClick && stepNumber > currentStep && !isCompleted}
            className={cn(
              "py-3 px-4 md:py-4 md:px-6 text-xs md:text-sm font-medium relative flex items-center gap-2",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "text-primary border-b-2 border-primary"
                : isCompleted 
                  ? "text-green-600 hover:text-green-700" 
                  : "text-muted-foreground hover:text-foreground/80",
              onStepClick && (stepNumber <= currentStep || isCompleted) ? "cursor-pointer" : "cursor-default"
            )}
            aria-current={isActive ? "step" : undefined}
          >
            {isCompleted && !isActive && <CheckCircle className="h-4 w-4 text-green-500" />}
            <span className={cn(isActive && "font-semibold")}>{label}</span>
            {/* Vertical separator for larger screens, aesthetics */}
            {index < steps.length - 1 && (
               <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-5 bg-border/70" />
            )}
          </button>
        );
      })}
    </div>
  );
}

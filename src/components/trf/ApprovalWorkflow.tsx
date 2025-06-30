
"use client";

import { CheckCircle, Circle, AlertCircle, Clock } from "lucide-react"; // Added AlertCircle, Clock
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovalStep } from "@/types/trf";
import { format, isValid } from "date-fns";

interface ApprovalWorkflowProps {
  steps: ApprovalStep[];
}

const formatDateSafe = (date: Date | string | undefined) => {
  if (!date) return "";
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, "PPp") : "";
};

export default function ApprovalWorkflow({ steps }: ApprovalWorkflowProps) {
  if (!steps || steps.length === 0) {
    return <p className="text-muted-foreground text-sm">No approval workflow defined.</p>;
  }
  return (
    <div>
      <h3 className="text-md font-semibold mb-4 text-foreground/90">Approval Workflow</h3>
      <div className="relative pl-3">
        {/* Vertical line connecting the dots */}
        <div className="absolute left-[18px] top-3 bottom-3 w-0.5 bg-border -z-10" />

        {steps.map((step, index) => {
          let IconComponent = Circle;
          let iconColor = "text-muted-foreground";
          let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";
          let badgeClasses = "text-muted-foreground border-muted-foreground/50";

          if (step.status === "Current") {
            IconComponent = Clock; // Using Clock for current step
            iconColor = "text-blue-500";
            badgeVariant = "default";
            badgeClasses = "bg-blue-500 text-white";
          } else if (step.status === "Approved") {
            IconComponent = CheckCircle;
            iconColor = "text-green-500";
            badgeVariant = "default"; // Or a custom success variant
            badgeClasses = "bg-green-600 text-green-50";
          } else if (step.status === "Rejected") {
            IconComponent = AlertCircle; // Using AlertCircle for rejected
            iconColor = "text-destructive";
            badgeVariant = "destructive";
            badgeClasses = ""; // Destructive variant handles its own colors
          } else if (step.status === "Pending") {
             IconComponent = Circle;
             iconColor = "text-amber-500"; // Yellow for pending
             badgeVariant = "outline";
             badgeClasses = "border-amber-500 text-amber-600";
          }


          return (
            <div key={index} className="flex items-start mb-6 last:mb-0">
              <div className="flex flex-col items-center mr-4 z-0">
                <IconComponent className={cn("w-8 h-8 bg-background rounded-full p-0.5", iconColor, step.status === "Pending" || step.status === "Not Started" ? "border-2" : "")} />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={cn(
                      "font-semibold text-sm",
                      (step.status === "Current" || step.status === "Approved" || step.status === "Rejected") ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step.role}
                    </p>
                    <p className={cn(
                       "text-xs",
                       (step.status === "Current" || step.status === "Approved" || step.status === "Rejected") ? "text-muted-foreground" : "text-muted-foreground/70"
                    )}>
                      {step.name}
                       {step.date && step.status !== "Pending" && step.status !== "Current" && (
                        <span className="text-xs text-muted-foreground/80 ml-2">({formatDateSafe(step.date)})</span>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={badgeVariant}
                    className={cn("mt-1 sm:mt-0 text-xs py-0.5 px-2", badgeClasses)}
                  >
                    {step.status}
                  </Badge>
                </div>
                {step.comments && (step.status === "Approved" || step.status === "Rejected") && (
                  <p className="text-xs text-muted-foreground mt-1 italic bg-muted/30 p-1.5 rounded-sm">
                    Comment: {step.comments}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

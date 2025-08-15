import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  iconBgColor?: string; // e.g. 'bg-green-100'
  iconColor?: string; // e.g. 'text-green-600'
}

const SummaryCard = React.memo(function SummaryCard({ title, value, description, icon: Icon, className, iconBgColor = "bg-primary/10", iconColor = "text-primary" }: SummaryCardProps) {
  return (
    <Card className={cn("shadow-lg hover:bg-accent hover:text-accent-foreground transition-shadow duration-300", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium text-foreground/80">{title}</CardTitle>
        {Icon && (
          <div className={cn("p-2 rounded-md", iconBgColor)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-primary">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
});

export default SummaryCard;

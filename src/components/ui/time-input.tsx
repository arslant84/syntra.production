"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

export interface TimeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(({ value, onChange, ...props }, ref) => {
  return (
    <Input 
      {...props} 
      ref={ref} 
      type="time"
      step="900"
      value={value} 
      onChange={onChange}
    />
  );
});
TimeInput.displayName = "TimeInput";

export { TimeInput };

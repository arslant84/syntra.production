"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

export interface TimeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(({ value, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, "");
    if (value.length > 2) {
      value = value.slice(0, 2) + ":" + value.slice(2, 4);
    }
    if (onChange) {
      const event = {
        ...e,
        target: {
          ...e.target,
          value: value,
        },
      };
      onChange(event);
    }
  };

  return <Input {...props} ref={ref} value={value} onChange={handleChange} maxLength={5} />;
});
TimeInput.displayName = "TimeInput";

export { TimeInput };

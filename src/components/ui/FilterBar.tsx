import React from 'react';
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { ListFilter } from "lucide-react";

interface FilterBarProps {
  searchPlaceholder: string;
  statusOptions?: { value: string; label: string }[];
  typeOptions?: { value: string; label: string }[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  typeFilter?: string;
  onTypeFilterChange?: (value: string) => void;
  extraContent?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchPlaceholder,
  statusOptions = [],
  typeOptions = [],
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  extraContent,
}) => {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListFilter className="h-5 w-5" />
          Filter & Search
        </CardTitle>
        <CardDescription>
          Search and filter by various criteria.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="lg:col-span-2"
        />
        {statusOptions.length > 0 && onStatusFilterChange && (
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger>
              <ListFilter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {typeOptions.length > 0 && onTypeFilterChange && (
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger>
              <ListFilter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by Type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {extraContent}
      </CardContent>
    </Card>
  );
}; 
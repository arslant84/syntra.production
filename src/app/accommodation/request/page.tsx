"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Bed, ArrowLeft, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { type LocationType, type GuestGender } from '@/types/accommodation';

// Form schema with validation
const formSchema = z.object({
  requestorName: z.string().min(1, { message: "Requestor name is required" }),
  requestorId: z.string().optional(),
  requestorGender: z.enum(["Male", "Female"], { 
    required_error: "Please select gender" 
  }),
  department: z.string().optional(),
  location: z.enum(["Ashgabat", "Kiyanly", "Turkmenbashy"], { 
    required_error: "Please select location" 
  }),
  requestedCheckInDate: z.date({
    required_error: "Check-in date is required",
  }),
  requestedCheckOutDate: z.date({
    required_error: "Check-out date is required",
  }),
  requestedRoomType: z.string().optional(),
  specialRequests: z.string().optional(),
  flightArrivalTime: z.string().optional(),
  flightDepartureTime: z.string().optional(),
  trfId: z.string().optional(),
}).refine(data => data.requestedCheckOutDate >= data.requestedCheckInDate, {
  message: "Check-out date must be after or same as check-in date",
  path: ["requestedCheckOutDate"],
});

type FormValues = z.infer<typeof formSchema>;

export default function AccommodationRequestPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requestorName: "",
      requestorId: "",
      requestorGender: undefined,
      department: "",
      location: undefined,
      requestedCheckInDate: undefined,
      requestedCheckOutDate: undefined,
      requestedRoomType: "",
      specialRequests: "",
      flightArrivalTime: "",
      flightDepartureTime: "",
      trfId: "",
    },
  });

  // Handle form submission
  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('/api/accommodation/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit accommodation request');
      }
      
      setSubmitSuccess(true);
      // Reset form after successful submission
      form.reset();
      
      // Redirect to success page or show success message
      setTimeout(() => {
        router.push('/accommodation');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error submitting accommodation request:', error);
      setSubmitError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitSuccess) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <Bed className="h-6 w-6" />
              Accommodation Request Submitted
            </CardTitle>
            <CardDescription>
              Your accommodation request has been submitted successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>You will be redirected to the accommodation dashboard shortly.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/accommodation')}>
              Go to Accommodation Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Bed className="h-6 w-6 text-primary" />
              New Accommodation Request
            </CardTitle>
            <CardDescription>
              Fill in the details below to request accommodation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitError && (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Requestor Information */}
                  <FormField
                    control={form.control}
                    name="requestorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requestor Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="Full Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="requestorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., PCTSB00123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="requestorGender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender*</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Finance" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Location and TRF Information */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location*</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Ashgabat">Ashgabat</SelectItem>
                            <SelectItem value="Kiyanly">Kiyanly</SelectItem>
                            <SelectItem value="Turkmenbashy">Turkmenbashy</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="trfId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TRF ID (if applicable)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., TRF-DOM-001" {...field} />
                        </FormControl>
                        <FormDescription>
                          Link this request to an existing Travel Request Form
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Date Selection */}
                  <FormField
                    control={form.control}
                    name="requestedCheckInDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Check-in Date*</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="requestedCheckOutDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Check-out Date*</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => {
                                const checkInDate = form.getValues("requestedCheckInDate");
                                return (
                                  date < new Date(new Date().setHours(0, 0, 0, 0)) ||
                                  (checkInDate && date < checkInDate)
                                );
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Room Type */}
                  <FormField
                    control={form.control}
                    name="requestedRoomType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Room Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select room type (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Single Room">Single Room</SelectItem>
                            <SelectItem value="Shared Room - Male">Shared Room - Male</SelectItem>
                            <SelectItem value="Shared Room - Female">Shared Room - Female</SelectItem>
                            <SelectItem value="Camp Unit - Male Section">Camp Unit - Male Section</SelectItem>
                            <SelectItem value="Camp Unit - Female Section">Camp Unit - Female Section</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select your preferred room type (subject to availability)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Flight Information */}
                  <FormField
                    control={form.control}
                    name="flightArrivalTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flight/Train Arrival Time</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 14:30 (01 DEC)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Format: HH:MM (DD MMM)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="flightDepartureTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flight/Train Departure Time</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 18:00 (05 DEC)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Format: HH:MM (DD MMM)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Special Requests */}
                <FormField
                  control={form.control}
                  name="specialRequests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Requests</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any special requirements or preferences" 
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        E.g., dietary restrictions, accessibility needs, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

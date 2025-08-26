"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { format, eachDayOfInterval, isValid } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Calendar, Utensils, RotateCcw } from "lucide-react";
import type { DailyMealSelection } from "@/types/trf";
import { useEffect, useMemo } from "react";

export function DailyMealSelection() {
  const form = useFormContext();
  
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "mealProvision.dailyMealSelections",
  });

  // Watch for changes in the itinerary
  const currentItinerary = form.watch("itinerary");

  // Generate complete date range for travel period (including all days between departure and return)
  const travelDates = useMemo(() => {
    console.log('DailyMealSelection: Processing itinerary with', currentItinerary?.length || 0, 'segments');
    
    if (!currentItinerary || currentItinerary.length === 0) {
      console.log('DailyMealSelection: No itinerary data available');
      return [];
    }
    
    // Get all valid dates from itinerary segments
    const allItems = currentItinerary.map((item, index) => {
      return { date: item.date, segmentIndex: index };
    });
    
    const validDates = allItems
      .filter((item): item is { date: Date; segmentIndex: number } => {
        return item.date !== null && item.date !== undefined && isValid(item.date);
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    console.log('DailyMealSelection: Found', validDates.length, 'valid dates out of', currentItinerary.length, 'segments');
    
    if (validDates.length === 0) {
      console.log('DailyMealSelection: No valid dates found');
      return [];
    }
    
    // If only one valid date found, use single day
    if (validDates.length === 1) {
      console.log('DailyMealSelection: Only one valid date found - single day trip or missing dates in other segments');
      return [validDates[0].date];
    }
    
    // Get the earliest date (first segment) and latest date (last segment)
    const startDate = validDates[0].date; // First travel date (departure from segment 1)
    const endDate = validDates[validDates.length - 1].date; // Last travel date (return from last segment)
    
    const daysBetween = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    console.log('DailyMealSelection: Travel period:', startDate.toDateString(), 'to', endDate.toDateString(), `(${daysBetween} days)`);
    
    // Generate all dates between start and end (inclusive)
    // This covers the entire travel period: 5 Aug to 9 Aug = 5, 6, 7, 8, 9 Aug
    const allDates = eachDayOfInterval({ start: startDate, end: endDate });
    
    console.log('DailyMealSelection: Generated', allDates.length, 'meal selection days');
    
    return allDates;
  }, [
    currentItinerary?.length,
    // Watch for changes in the actual date values within segments
    currentItinerary?.map(item => item.date?.getTime() || 0).join(',')
  ]);

  // Store the current date range as a string to prevent infinite loops
  const travelDateRange = travelDates.map(date => date.toDateString()).join('|');
  
  // Initialize daily meal selections automatically when travel dates change
  useEffect(() => {
    if (travelDates.length > 0) {
      // Check if we need to update the meal selections due to date changes
      const currentDatesSet = new Set(fields.map(field => field.meal_date?.toDateString()));
      const newDatesSet = new Set(travelDates.map(date => date.toDateString()));
      
      // Compare if the dates have changed
      const datesChanged = currentDatesSet.size !== newDatesSet.size || 
        !Array.from(currentDatesSet).every(date => newDatesSet.has(date));
      
      if (fields.length === 0 || datesChanged) {
        console.log('DailyMealSelection: Updating meal selections for date range change');
        
        // Preserve existing selections where dates match
        const newSelections = travelDates.map((date) => {
          const existingSelection = fields.find(field => 
            field.meal_date && field.meal_date.toDateString() === date.toDateString()
          );
          
          if (existingSelection) {
            // Keep existing selections for dates that haven't changed
            return {
              meal_date: date,
              breakfast: existingSelection.breakfast || false,
              lunch: existingSelection.lunch || false,
              dinner: existingSelection.dinner || false,
              supper: existingSelection.supper || false,
              refreshment: existingSelection.refreshment || false,
            };
          } else {
            // New date, initialize with false
            return {
              meal_date: date,
              breakfast: false,
              lunch: false,
              dinner: false,
              supper: false,
              refreshment: false,
            };
          }
        });
        
        replace(newSelections);
      }
    } else {
      // Clear selections if no travel dates
      replace([]);
    }
  }, [travelDateRange, replace]);


  const handleSelectAllForMeal = (mealType: keyof DailyMealSelection) => {
    if (mealType === 'id' || mealType === 'trf_id' || mealType === 'meal_date') return;
    
    fields.forEach((_, index) => {
      form.setValue(`mealProvision.dailyMealSelections.${index}.${mealType}`, true);
    });
  };

  const handleDeselectAllForMeal = (mealType: keyof DailyMealSelection) => {
    if (mealType === 'id' || mealType === 'trf_id' || mealType === 'meal_date') return;
    
    fields.forEach((_, index) => {
      form.setValue(`mealProvision.dailyMealSelections.${index}.${mealType}`, false);
    });
  };

  if (travelDates.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Calendar className="mx-auto h-8 w-8 mb-2" />
        <p>Please add itinerary dates to enable daily meal selection</p>
        <p className="text-xs mt-2">
          💡 For Round Trip: Set different dates in Segment 1 (departure) and last segment (return) to get full travel period
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Travel period info */}
      {travelDates.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Utensils className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Meal Selection by Travel Period</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>
              {travelDates.length} day(s) • {format(travelDates[0], 'MMM d')} - {format(travelDates[travelDates.length - 1], 'MMM d, yyyy')}
            </p>
            {travelDates.length === 1 && currentItinerary && currentItinerary.length > 1 && (
              <p className="text-amber-600 font-medium text-xs mt-1">
                ⚠️ Only showing 1 day because other segments have no dates. Set dates in all segments for full travel period.
              </p>
            )}
            {travelDates.length === 1 && currentItinerary && currentItinerary.length === 1 && (
              <p className="text-blue-600 font-medium text-xs mt-1">
                💡 Single day trip. Add more segments with different dates for multi-day travel.
              </p>
            )}
            {travelDates.length > 1 && (
              <p className="text-green-600 font-medium text-xs mt-1">
                ✅ Meal period automatically updates when itinerary dates change
              </p>
            )}
          </div>
        </div>
      )}

      {travelDates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Utensils className="w-5 h-5" />
              Daily Meal Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Quick action buttons */}
            <div className="mb-4 flex flex-wrap gap-2">
              {(['breakfast', 'lunch', 'dinner', 'supper', 'refreshment'] as const).map((mealType) => (
                <div key={mealType} className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAllForMeal(mealType)}
                    className="text-xs"
                  >
                    All {mealType}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeselectAllForMeal(mealType)}
                    className="text-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Daily meal grid */}
            <div className="space-y-3">
              {fields.map((field, index) => {
                const currentDate = travelDates[index];
                if (!currentDate) return null;

                return (
                  <div key={field.id} className="grid grid-cols-6 gap-4 items-center p-3 bg-muted/30 rounded-lg">
                    <div className="font-medium">
                      {format(currentDate, 'EEE, MMM d')}
                    </div>
                    
                    {(['breakfast', 'lunch', 'dinner', 'supper', 'refreshment'] as const).map((mealType) => (
                      <FormField
                        key={mealType}
                        control={form.control}
                        name={`mealProvision.dailyMealSelections.${index}.${mealType}`}
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm capitalize">
                              {mealType}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 bg-primary/5 rounded-lg">
              <p className="text-sm font-medium">Summary:</p>
              <div className="grid grid-cols-5 gap-4 mt-2 text-sm">
                {(['breakfast', 'lunch', 'dinner', 'supper', 'refreshment'] as const).map((mealType) => {
                  const count = fields.reduce((acc, _, index) => {
                    const value = form.watch(`mealProvision.dailyMealSelections.${index}.${mealType}`);
                    return acc + (value ? 1 : 0);
                  }, 0);
                  return (
                    <div key={mealType} className="text-center">
                      <div className="font-medium capitalize">{mealType}</div>
                      <div className="text-muted-foreground">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
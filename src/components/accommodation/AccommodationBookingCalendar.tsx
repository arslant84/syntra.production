
"use client";

import React, { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  parseISO,
  isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StaffHouseData, RoomData, BookingData, StaffGuest, LocationType, CalendarCellData } from '@/types/accommodation';
import { cn } from '@/lib/utils';

const locations: LocationType[] = ['Ashgabat', 'Kiyanly', 'Turkmenbashy'];

interface AccommodationBookingCalendarProps {
  staffHouses: StaffHouseData[];
  staffGuests: StaffGuest[];
  bookings: BookingData[];
}

export default function AccommodationBookingCalendar({ staffHouses, staffGuests, bookings }: AccommodationBookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Default to current month
  const [selectedLocation, setSelectedLocation] = useState<LocationType>('Ashgabat');

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOfMonth = getDay(startOfMonth(currentMonth)); // 0 (Sun) - 6 (Sat)

  // Filter staff houses by selected location
  const filteredHouses = useMemo(() => {
    return staffHouses.filter(house => house.location === selectedLocation);
  }, [selectedLocation, staffHouses]);

  // Create a map of bookings for faster lookup
  const bookingsMap = useMemo(() => {
    const map = new Map<string, CalendarCellData>();
    bookings.forEach(booking => {
      // Try to find guest by staff_id first, then by id
      let guest = staffGuests.find(g => g.id === booking.staffId);
      
      // If not found and booking has staffName/staffGender, create a temporary guest
      if (!guest && booking.staffName) {
        guest = {
          id: booking.staffId,
          name: booking.staffName,
          gender: (booking.staffGender as 'Male' | 'Female') || 'Male',
          initials: booking.staffName.substring(0, 2).toUpperCase()
        };
      }
      
      if (guest) {
        const dateKey = booking.date instanceof Date ? format(booking.date, 'yyyy-MM-dd') : booking.date;
        const key = `${booking.staffHouseId}-${booking.roomId}-${dateKey}`;
        const calendarData: CalendarCellData = {
          ...booking,
          date: dateKey,
          guest
        };
        map.set(key, calendarData);
      }
    });
    return map;
  }, [bookings, staffGuests]);

  // Get booking information for a specific cell (room on a specific date)
  const getBookingForCell = (houseId: string, roomId: string, date: Date): CalendarCellData | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookingsMap.get(`${houseId}-${roomId}-${dateStr}`);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="p-4 md:p-6 bg-card text-card-foreground rounded-lg shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl md:text-2xl font-semibold text-center w-48">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="w-full sm:w-auto">
          <Select value={selectedLocation} onValueChange={(value) => setSelectedLocation(value as LocationType)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select Location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map(loc => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-border">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-2 border border-border text-left sticky left-0 bg-muted/50 z-10 w-40">Staff House / Room</th>
              {daysInMonth.map(day => (
                <th key={day.toString()} className="p-1.5 border border-border text-center min-w-[50px]">
                  <div className="text-xs font-medium">{format(day, 'EEE')}</div>
                  <div className="text-lg font-semibold">{format(day, 'dd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredHouses.map(house => (
              <React.Fragment key={house.id}>
                {house.rooms.map((room, roomIndex) => (
                  <tr key={room.id} className="even:bg-background odd:bg-muted/20">
                    {roomIndex === 0 && (
                      <td
                        rowSpan={house.rooms.length}
                        className="p-2 border border-border font-semibold align-top text-sm sticky left-0 bg-inherit z-10"
                      >
                        {house.name}
                      </td>
                    )}
                     {/* This hidden cell is a trick for correct sticky positioning of the Room Name after the rowspan cell */}
                    {roomIndex > 0 && <td className="hidden">{house.name}</td>}
                    <td className="p-2 border border-border text-xs font-medium sticky left-[calc(theme(spacing.40))_-_1px] bg-inherit z-10">
                       {room.name}
                    </td>
                    {daysInMonth.map(day => {
                      const booking = getBookingForCell(house.id, room.id, day);
                      let cellBgColor = 'bg-green-100/50 hover:bg-green-200/70'; // Available
                      let cellTextColor = 'text-green-700';
                      let content: React.ReactNode = <span className="text-xs">AV</span>; // Available

                      if (booking && booking.guest) {
                        if (booking.guest.gender === 'Male') {
                          cellBgColor = 'bg-sky-500 text-white hover:bg-sky-600'; // Blue for Male
                          cellTextColor = 'text-white';
                        } else {
                          cellBgColor = 'bg-red-500 text-white hover:bg-red-600'; // Red for Female
                          cellTextColor = 'text-white';
                        }
                        content = booking.guest.initials;
                      } else if (!isSameMonth(day, currentMonth) || day < new Date() && !isToday(day) ) {
                        cellBgColor = 'bg-muted/30'; // Past or different month
                        cellTextColor = 'text-muted-foreground';
                        content = '';
                      }

                      return (
                        <td
                          key={day.toString()}
                          className={cn(
                            "p-1.5 border border-border text-center h-12 min-w-[50px] cursor-pointer transition-colors",
                            cellBgColor,
                            cellTextColor,
                            isToday(day) && 'ring-2 ring-primary ring-offset-1'
                          )}
                          title={booking ? `${booking.guest?.name} - ${room.name}` : `Available - ${room.name}`}
                        >
                          <div className="font-semibold text-sm">{content}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                 {/* Separator row between houses if there are multiple rooms */}
                {house.rooms.length > 0 && (
                    <tr>
                        <td colSpan={daysInMonth.length + 2} className="h-1 p-0 border-0 bg-border/50"></td>
                    </tr>
                )}
              </React.Fragment>
            ))}
            {filteredHouses.length === 0 && (
                <tr>
                    <td colSpan={daysInMonth.length + 2} className="p-8 text-center text-muted-foreground">
                        No staff houses available for {selectedLocation}.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 border rounded-lg bg-muted/30">
        <h3 className="text-lg font-semibold mb-3">Legend</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {/* Available Room */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-green-100/50 border border-green-300"></div>
            <span>Available</span>
          </div>
          
          {/* Male Guest Example */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm flex items-center justify-center text-xs font-bold text-white bg-sky-500">MG</div>
            <span>Male Guest</span>
          </div>
          
          {/* Female Guest Example */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm flex items-center justify-center text-xs font-bold text-white bg-red-500">FG</div>
            <span>Female Guest</span>
          </div>
          
          {/* Past Date */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-muted/30 border border-muted"></div>
            <span>Past Date</span>
          </div>
          
          {/* Today's Date */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-green-100/50 border border-green-300 ring-2 ring-primary ring-offset-1"></div>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}

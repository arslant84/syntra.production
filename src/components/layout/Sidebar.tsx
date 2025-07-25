"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuBadge,
  SidebarTrigger
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';
import { LayoutDashboard, Plane, BedDouble, CheckSquare, Users, Settings, FileText } from 'lucide-react';
import Logo from '@/components/Logo';
import { cn } from '@/lib/utils';

// Define the initial navigation items without badges
const initialNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Flights Admin', href: '/admin/flights', icon: Plane },
  { label: 'Accommodation Admin', href: '/admin/accommodation', icon: BedDouble },
  { label: 'Visa Admin', href: '/admin/visa', icon: FileText },
  { label: 'Claims Admin', href: '/admin/claims', icon: FileText },
  { label: 'Approvals', href: '/admin/approvals', icon: CheckSquare },
  { label: 'User Management', href: '/admin/users', icon: Users },
  { label: 'System Settings', href: '/admin/settings', icon: Settings },
];

// Initial counts for immediate display - will be replaced by API data
const initialCounts = {
  approvals: 0,
  claims: 0,
  visas: 0,
  flights: 0,
  accommodation: 0
};


// Interface for the sidebar counts API response
interface SidebarCounts {
  approvals: number;
  claims: number;
  visas: number;
  flights: number;
  accommodation: number;
  timestamp?: number; // Added timestamp for forcing re-renders
}

export default function AppSidebar() {
  const pathname = usePathname();
  
  // Use separate state for counts and navigation items
  const [counts, setCounts] = useState<SidebarCounts>(initialCounts);
  const [isLoading, setIsLoading] = useState(true);
  
  // Derive navItems from counts
  const navItems = initialNavItems.map(item => {
    if (item.label === 'Approvals') {
      return { ...item, badge: counts.approvals };
    }
    if (item.label === 'Claims Admin') {
      return { ...item, badge: counts.claims };
    }
    if (item.label === 'Visa Admin') {
      return { ...item, badge: counts.visas };
    }
    if (item.label === 'Flights Admin' && counts.flights > 0) {
      return { ...item, badge: counts.flights };
    }
    if (item.label === 'Accommodation Admin') {
      return { ...item, badge: counts.accommodation };
    }
    return item;
  });

  // This effect runs only in the client side
  useEffect(() => {
    // Function to update sidebar counts from API
    const fetchCounts = async () => {
      try {
        // Mark as loading
        setIsLoading(true);
        console.log('Fetching sidebar counts...');
        
        // Fetch data from API with cache busting
        const response = await fetch('/api/sidebar-counts', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            // Add a timestamp to ensure we get fresh data
            'X-Timestamp': Date.now().toString()
          }
        });
        
        // Check if response is OK
        if (!response.ok) {
          throw new Error(`Failed to fetch sidebar counts: ${response.status}`);
        }
        
        // Parse response data
        const data: SidebarCounts = await response.json();
        console.log('Received sidebar counts:', data);
        
        // Force a hard refresh of the counts
        const newCounts = {
          ...data,
          timestamp: Date.now() // Add timestamp to force state update
        };
        
        // Update counts directly
        setCounts(newCounts);
        console.log('Updated counts state with timestamp:', newCounts);
      } catch (error) {
        console.error('Error fetching sidebar counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch data immediately
    fetchCounts();
    
    // Refresh every minute
    const intervalId = setInterval(fetchCounts, 60 * 1000);
    console.log('Set up interval for sidebar counts refresh');
    
    // Clean up interval on unmount
    return () => {
      console.log('Cleaning up sidebar counts interval');
      clearInterval(intervalId);
    };
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="p-4 flex items-center justify-between">
           {/* Logo visible when expanded */}
          <div className="group-data-[state=expanded]:opacity-100 group-data-[state=collapsed]:opacity-0 transition-opacity duration-200">
            <Logo />
          </div>
           {/* Trigger visible when expanded, or always if you prefer */}
          <div className="group-data-[state=expanded]:block group-data-[state=collapsed]:hidden">
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton 
                    isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                    tooltip={item.label}
                    className={cn(item.badge && "relative")}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.label}</span>
                    {item.badge && (
                      <SidebarMenuBadge className="absolute right-2 top-1/2 -translate-y-1/2 group-data-[state=collapsed]:hidden">
                        {String(item.badge)}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

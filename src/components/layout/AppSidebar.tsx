
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarFooter,
  SidebarSeparator,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import type { NavItem, User } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Home, Plane, ReceiptText, CheckSquare, Users, Settings, StickyNote, BedDouble, Truck, LayoutDashboard, FileText, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from "next-auth/react";
import { useEffect, useState } from 'react';
import { useOptionalUserProfile } from '@/contexts/UserProfileContext';

// Mock user data for sidebar footer - similar to UserNav
const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@petronas.com',
  role: 'Admin Focal',
};

const getInitials = (name: string) => {
  const names = name.split(' ');
  return names
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

// Icon mapping for dynamic navigation
const iconMap = {
  'LayoutDashboard': LayoutDashboard,
  'Plane': Plane,
  'BedDouble': BedDouble,
  'CheckSquare': CheckSquare,
  'Users': Users,
  'Settings': Settings,
  'FileText': FileText,
  'Truck': Truck,
  'BarChart2': BarChart2,
  'ReceiptText': ReceiptText,
  'StickyNote': StickyNote,
  'Home': Home,
};

const getMainNavItems = (navItems: NavItem[]) => {
  // Filter out items that are already in the top navbar and dashboard
  const topNavbarItems = [
    'Dashboard',
    'Travel Requests', 
    'Transport Requests',
    'Visa Applications', 
    'Accommodation Requests',
    'Expense Claims',
    'Reports'
  ];
  
  return navItems.filter(item => 
    item.label !== 'System Settings' && 
    !topNavbarItems.includes(item.label)
  );
};

const getSettingsNavItem = (navItems: NavItem[]) => {
  return navItems.find(item => item.label === 'System Settings');
};


export default function AppSidebar() {
  const pathname = usePathname();
  const sidebarContext = useSidebar();
  const toggleSidebar = sidebarContext?.toggleSidebar;
  const { data: session, status: sessionStatus } = useSession();
  const userProfileContext = useOptionalUserProfile();
  const userProfile = userProfileContext?.user;
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  // Load role-based navigation items with caching
  useEffect(() => {
    const setFallbackNav = () => {
      console.warn('AppSidebar: Session or navigation API failed. Loading fallback navigation.');
      setNavItems([
        { label: 'Approvals', href: '/admin/approvals', icon: CheckSquare },
        { label: 'Users', href: '/admin/users', icon: Users },
        { label: 'System Settings', href: '/admin/settings', icon: Settings },
      ]);
    };

    const fetchNavigation = async () => {
      // If session is loading or not authenticated, show fallback and stop.
      if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated') {
        setFallbackNav();
        return;
      }

      try {
        const response = await fetch('/api/navigation');
        
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let errorMessage = `Failed to fetch navigation: ${response.status} ${response.statusText}`;
          
          if (contentType.includes('application/json')) {
            try {
              const errorData = await response.json();
              errorMessage = errorData?.error || errorData?.message || errorMessage;
            } catch {
              // If JSON parsing fails, use the default error message
            }
          } else {
            // For non-JSON responses (like HTML 503 pages), use status text
            errorMessage = `Failed to fetch navigation: ${response.status}`;
          }
          
          throw new Error(errorMessage);
        }

        const navigationData = await response.json();
        const processedNavItems = navigationData.map((item: any) => ({
          ...item,
          icon: iconMap[item.icon as keyof typeof iconMap] || LayoutDashboard,
        }));
        setNavItems(processedNavItems);
      } catch (error) {
        console.error('AppSidebar: Error fetching navigation:', error);
        setFallbackNav();
      }
    };

    fetchNavigation();
  }, [session, sessionStatus]);

  return (
    <Sidebar collapsible="icon" className="border-r flex flex-col">
      <SidebarRail />
      
      <button
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar Pin"
        title="Toggle Sidebar Pin"
        className={cn(
          "w-full flex items-center p-2 h-16 border-b border-sidebar-border focus:outline-none",
          "group-data-[state=expanded]:justify-start group-data-[state=expanded]:gap-2",
          "group-data-[state=collapsed]:justify-center",
        )}
      >
        {/* Expanded Logo and Text */}
        <div
          className={cn(
            "flex items-center gap-3",
            "group-data-[state=expanded]:flex",
            "group-data-[state=collapsed]:hidden"
          )}
        >
          <Image
            src="/open.jpg"
            alt="Synchronised Travel Logo Expanded"
            width={32} 
            height={32} 
            className="object-contain h-auto"
            priority
            data-ai-hint="company logo expanded"
          />
          <span className="font-bold text-sidebar-foreground text-base whitespace-nowrap self-center">
            Synchronised Travel
          </span>
        </div>

        {/* Collapsed Logo */}
        <div
          className={cn(
            "items-center justify-center",
            "group-data-[state=collapsed]:flex",
            "group-data-[state=expanded]:hidden"
          )}
        >
          <Image
            src="/closed.jpg"
            alt="Synchronised Travel Logo Collapsed"
            width={32}
            height={32}
            className="object-contain"
            priority
            data-ai-hint="company logo collapsed"
          />
        </div>
      </button>

      <SidebarContent className="flex-grow p-3">
        <SidebarMenu>
          {getMainNavItems(navItems).map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                  tooltip={item.label}
                  className={cn(item.badge && "relative")}
                >
                  {item.icon && <item.icon />}
                  <span>{item.label}</span>
                  {item.badge && (
                    <SidebarMenuBadge className="absolute right-2 top-1/2 -translate-y-1/2 group-data-[state=collapsed]:hidden">
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t mt-auto">
        {(() => {
          const settingsNavItem = getSettingsNavItem(navItems);
          if (!settingsNavItem) return null;
          const Icon = settingsNavItem.icon;
          return (
            <SidebarMenu className="mb-2">
              <SidebarMenuItem>
                <Link href={settingsNavItem.href}>
                  <SidebarMenuButton
                    isActive={pathname === settingsNavItem.href}
                    tooltip={settingsNavItem.label}
                  >
                    {Icon && <Icon />}
                    <span>{settingsNavItem.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          );
        })()}

      </SidebarFooter>
    </Sidebar>
  );
}

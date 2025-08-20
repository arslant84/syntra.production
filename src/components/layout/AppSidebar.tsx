
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
  const { data: session } = useSession();
  const userProfileContext = useOptionalUserProfile();
  const userProfile = userProfileContext?.user;
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  // Load role-based navigation items
  useEffect(() => {
    const fetchNavigation = async () => {
      if (!session?.user) {
        // Default items for unauthenticated users
        setNavItems([
          { label: 'Dashboard', href: '/', icon: LayoutDashboard }
        ]);
        return;
      }

      try {
        console.log('AppSidebar: Fetching role-based navigation...');
        const response = await fetch('/api/navigation', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch navigation: ${response.status}`);
        }
        
        const navigationData = await response.json();
        console.log('AppSidebar: Received navigation data:', navigationData);
        
        // Convert icon strings to actual icon components
        const processedNavItems = navigationData.map((item: any) => ({
          ...item,
          icon: iconMap[item.icon as keyof typeof iconMap] || LayoutDashboard
        }));
        
        setNavItems(processedNavItems);
      } catch (error) {
        console.error('AppSidebar: Error fetching navigation:', error);
        // Fallback to basic navigation
        setNavItems([{ label: 'Dashboard', href: '/', icon: LayoutDashboard }]);
      }
    };

    fetchNavigation();
  }, [session]);

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

        <SidebarSeparator />

        <div className="mt-2">
            <Link href="/profile">
                <SidebarMenuButton
                    tooltip={userProfile?.name || session?.user?.name || "User"}
                    className={cn(
                        "h-auto p-2 group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:justify-center"
                    )}
                >
                    <Avatar className="h-8 w-8">
                        <AvatarImage 
                            src={userProfile?.profile_photo || undefined} 
                            alt={userProfile?.name || session?.user?.name || "User"} 
                        />
                        <AvatarFallback>
                            {userProfile?.name ? getInitials(userProfile.name) : 
                             session?.user?.name ? getInitials(session.user.name) : "U"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="group-data-[state=collapsed]:hidden ml-2 flex-grow min-w-0">
                        <p className="text-sm font-medium truncate">
                            {userProfile?.name || session?.user?.name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {userProfile?.email || session?.user?.email || ""}
                        </p>
                    </div>
                </SidebarMenuButton>
            </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}


"use client";

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
import { Home, Plane, ReceiptText, CheckSquare, Users, Settings, StickyNote, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const allAdminNavItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Flights Admin', href: '/admin/flights', icon: Plane },
  { label: 'Accommodation Admin', href: '/admin/accommodation', icon: BedDouble },
  { label: 'Visa Admin', href: '/admin/visa', icon: StickyNote },
  { label: 'Claims Admin', href: '/admin/claims', icon: ReceiptText },
  { label: 'Approvals', href: '/admin/approvals', icon: CheckSquare },
  { label: 'User Management', href: '/admin/users', icon: Users },
  { label: 'System Settings', href: '/admin/settings', icon: Settings },
];

const mainNavItems = allAdminNavItems.filter(item => item.label !== 'System Settings');
const settingsNavItem = allAdminNavItems.find(item => item.label === 'System Settings');


export default function AppSidebar() {
  const pathname = usePathname();
  const sidebarContext = useSidebar();
  const toggleSidebar = sidebarContext?.toggleSidebar;

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
          {mainNavItems.map((item) => (
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
        {settingsNavItem && (
          <SidebarMenu className="mb-2">
            <SidebarMenuItem>
              <Link href={settingsNavItem.href}>
                <SidebarMenuButton
                  isActive={pathname === settingsNavItem.href}
                  tooltip={settingsNavItem.label}
                >
                  {settingsNavItem.icon && <settingsNavItem.icon />}
                  <span>{settingsNavItem.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        <SidebarSeparator />

        <div className="mt-2">
            <Link href="/profile">
                <SidebarMenuButton
                    tooltip={mockUser.name}
                    className={cn(
                        "h-auto p-2 group-data-[state=collapsed]:w-auto group-data-[state=collapsed]:justify-center"
                    )}
                >
                    <Avatar className="h-8 w-8">
                        <AvatarImage src="https://placehold.co/100x100.png" alt={mockUser.name} data-ai-hint="profile avatar"/>
                        <AvatarFallback>{getInitials(mockUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="group-data-[state=collapsed]:hidden ml-2 flex-grow min-w-0">
                        <p className="text-sm font-medium truncate">{mockUser.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{mockUser.email}</p>
                    </div>
                </SidebarMenuButton>
            </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

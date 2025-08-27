"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, FileText, ReceiptText, BarChart2, StickyNote, BedDouble, Truck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { UserNav } from '@/components/UserNav';
import { useSession } from 'next-auth/react';
import { getNavigationPermissions } from '@/lib/client-permissions';

// Icon mapping for dynamic navigation
const iconMap = {
  'Home': Home,
  'FileText': FileText,
  'ReceiptText': ReceiptText,
  'BarChart2': BarChart2,
  'StickyNote': StickyNote,
  'BedDouble': BedDouble,
  'Truck': Truck,
};

interface HeaderProps {
  showDesktopLogo?: boolean;
}

export default function Header({ showDesktopLogo = true }: HeaderProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  // Load role-based navigation items from API
  useEffect(() => {
    const fetchNavigation = async () => {
      if (status === 'loading') {
        return; // Wait for session to load
      }

      if (!session?.user) {
        // Default items for unauthenticated users
        setNavItems([
          { label: 'Home', href: '/', icon: Home }
        ]);
        return;
      }

      // Immediately set default authenticated user navigation
      const defaultAuthNavigation = [
        { label: 'Home', href: '/', icon: Home },
        { label: 'TSR', href: '/trf', icon: FileText },
        { label: 'Transport', href: '/transport', icon: Truck },
        { label: 'Visa', href: '/visa', icon: StickyNote },
        { label: 'Accommodation', href: '/accommodation', icon: BedDouble },
        { label: 'Claims', href: '/claims', icon: ReceiptText }
      ];
      
      setNavItems(defaultAuthNavigation);

      try {
        console.log('Header: Fetching role-based navigation for user:', session.user.email);
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
        console.log('Header: Received navigation data:', navigationData);
        
        // Map API navigation to header navigation
        const headerNavItems = [
          { label: 'Home', href: '/', icon: Home }
        ];

        // Process navigation items from API
        navigationData.forEach((item: any) => {
          // Skip dashboard in header since we have Home
          if (item.label === 'Dashboard') {
            return;
          }
          
          // Skip admin-only items in header navigation
          if (item.href?.startsWith('/admin/')) {
            return;
          }
          
          // Map the main modules with appropriate icons and labels for header
          if (item.href === '/trf') {
            headerNavItems.push({ label: 'TSR', href: '/trf', icon: FileText });
          } else if (item.href === '/transport') {
            headerNavItems.push({ label: 'Transport', href: '/transport', icon: Truck });
          } else if (item.href === '/visa') {
            headerNavItems.push({ label: 'Visa', href: '/visa', icon: StickyNote });
          } else if (item.href === '/accommodation') {
            headerNavItems.push({ label: 'Accommodation', href: '/accommodation', icon: BedDouble });
          } else if (item.href === '/claims') {
            headerNavItems.push({ label: 'Claims', href: '/claims', icon: ReceiptText });
          } else if (item.href === '/reports') {
            headerNavItems.push({ label: 'Reports', href: '/reports', icon: BarChart2 });
          }
        });
        
        setNavItems(headerNavItems);
      } catch (error) {
        console.error('Header: Error fetching navigation:', error);
        // Keep the default authenticated navigation if API fails (don't overwrite)
        console.log('Header: Using default navigation due to API error');
      }
    };

    fetchNavigation();
  }, [session, status]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-white/10 shadow-lg backdrop-blur-lg supports-[backdrop-filter]:bg-white/10">
      <div className="relative w-full min-h-16 h-16 flex items-center px-4">
        {/* Left Section: Logo (absolute left) */}
        <div className="md:hidden absolute left-0 h-full flex items-center">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
              <div className="p-4">
                <div className="mb-8 h-16 flex items-center border-b">
                  <Logo />
                </div>
                <nav className="flex flex-col space-y-3">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'text-lg font-medium transition-colors hover:text-primary flex items-center gap-2',
                        pathname === item.href ? 'text-primary' : 'text-foreground/60'
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.icon && <item.icon className="h-5 w-5" />}
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {/* Desktop Logo (absolute left) */}
        {showDesktopLogo && (
          <div className="hidden md:flex absolute left-0 h-full items-center pl-4">
            <Logo />
          </div>
        )}

        {/* Centered Desktop Navigation (absolute center) */}
        <nav className="hidden md:flex absolute left-1/2 top-0 h-full -translate-x-1/2 items-center justify-center space-x-8 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'transition-colors hover:text-primary flex items-center gap-1.5',
                pathname === item.href ? 'text-primary' : 'text-foreground/60'
              )}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Section: User Icon (absolute right) */}
        <div className="hidden md:flex absolute right-0 h-full items-center pr-4">
          <UserNav />
        </div>
        {/* Mobile user icon (remains in flow) */}
        <div className="md:hidden absolute right-0 h-full flex items-center pr-4">
          <UserNav />
        </div>
      </div>
    </header>
  );
}

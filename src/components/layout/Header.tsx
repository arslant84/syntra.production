"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, FileText, ReceiptText, BarChart2, StickyNote, BedDouble } from 'lucide-react';
import React from 'react';
import { UserNav } from '@/components/UserNav';

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'TRF', href: '/trf', icon: FileText },
  { label: 'Visa Applications', href: '/visa', icon: StickyNote },
  { label: 'Accommodation', href: '/accommodation', icon: BedDouble },
  { label: 'Claims', href: '/claims', icon: ReceiptText },
  { label: 'Reports', href: '/reports', icon: BarChart2 },
];

interface HeaderProps {
  showDesktopLogo?: boolean;
}

export default function Header({ showDesktopLogo = true }: HeaderProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

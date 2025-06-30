"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import AppSidebar from './AppSidebar'; 
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
// import { useSession } from 'next-auth/react'; // Removed useSession

// Helper component to access sidebar context and pass appropriate prop to Header
function LayoutWithSidebarContent({ children }: { children: React.ReactNode }) {
  const showDesktopHeaderLogo = false; 

  return (
    <SidebarInset>
      <Header showDesktopLogo={showDesktopHeaderLogo} />
      <div className="w-full flex-1 p-4 md:p-8 overflow-auto">
        {children}
      </div>
    </SidebarInset>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  // const { data: session, status } = useSession(); // Removed useSession
  const pathname = usePathname();
  
  // Do not render layout for the login page (though login page is removed, this logic is harmless)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // For now, assume admin layout is always shown for development simplicity
  // You can reintroduce role-based layout logic later if needed.
  const showSidebar = true; // Hardcoded to true for now

  if (showSidebar) {
    return (
      <SidebarProvider defaultOpen={false}> 
        <AppSidebar /> 
        <LayoutWithSidebarContent>{children}</LayoutWithSidebarContent>
      </SidebarProvider>
    );
  }

  // Fallback layout (currently not reached due to showSidebar = true)
  return (
    <div className="flex flex-col min-h-screen">
      <Header showDesktopLogo={true} /> 
      <main className="flex-1 container py-8 max-w-screen-2xl mx-auto">
        {children}
      </main>
      <footer className="py-4 border-t">
        <div className="container text-center text-sm text-muted-foreground mx-auto">
          © {new Date().getFullYear()} Synchronised Travel. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

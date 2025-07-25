import React from 'react';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sql } from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User as UserIcon, Edit3 } from "lucide-react";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <div className="p-8 text-red-600">Not authenticated.</div>;
  }

  // Fetch user from DB
  const users = await sql`
    SELECT * FROM users WHERE email = ${session.user.email} LIMIT 1
  `;
  const user = users[0];

  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ');
    return names.map((n) => n[0]).join('').toUpperCase();
  };

  return (
    <div className="w-full px-2 md:px-6 py-8 space-y-8">
      <div className="flex items-center space-x-4">
        <UserIcon className="w-10 h-10 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Personal Information</CardTitle>
            <CardDescription>View and manage your profile details.</CardDescription>
          </div>
          <Button variant="outline" size="icon">
            <Edit3 className="h-4 w-4" />
            <span className="sr-only">Edit Profile</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={`https://placehold.co/200x200.png`} alt={user.name} data-ai-hint="profile avatar large" />
              <AvatarFallback className="text-3xl">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-semibold">{user.name}</h2>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={user.role || 'N/A'} disabled />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={user.department || 'N/A'} disabled />
            </div>
            <div>
              <Label htmlFor="staffPosition">Staff Position</Label>
              <Input id="staffPosition" value={user.staff_position || 'N/A'} disabled />
            </div>
            <div>
              <Label htmlFor="costCenter">Cost Center</Label>
              <Input id="costCenter" value={user.cost_center || 'N/A'} disabled />
            </div>
          </div>
          <Button className="w-full md:w-auto">Update Profile</Button>
        </CardContent>
      </Card>
    </div>
  );
}

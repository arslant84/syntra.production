"use client"; // For using mockUser

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/types";
import { User as UserIcon, Edit3 } from "lucide-react";

// Mock user data, replace with actual data fetching
const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@petronas.com',
  role: 'Admin Focal',
  department: 'IT Department',
  staffPosition: 'Senior Developer',
  costCenter: 'CC12345',
};

export default function ProfilePage() {
  const user = mockUser;

  const getInitials = (name: string) => {
    const names = name.split(' ');
    return names
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
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
              <Input id="role" value={user.role} disabled />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={user.department || 'N/A'} disabled />
            </div>
            <div>
              <Label htmlFor="staffPosition">Staff Position</Label>
              <Input id="staffPosition" value={user.staffPosition || 'N/A'} disabled />
            </div>
            <div>
              <Label htmlFor="costCenter">Cost Center</Label>
              <Input id="costCenter" value={user.costCenter || 'N/A'} disabled />
            </div>
          </div>
          
          <Button className="w-full md:w-auto">Update Profile</Button>
        </CardContent>
      </Card>
    </div>
  );
}

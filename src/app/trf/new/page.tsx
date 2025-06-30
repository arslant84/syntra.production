
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaneTakeoff, Globe, Home, Users, FilePlus2 } from 'lucide-react';

const trfOptions = [
  {
    id: 'domestic',
    title: 'Domestic Business Trip',
    description: 'For business travel within the country.',
    icon: PlaneTakeoff,
    href: '/trf/new/domestic',
  },
  {
    id: 'overseas',
    title: 'Overseas Business Trip',
    description: 'For international business travel.',
    icon: Globe,
    href: '/trf/new/overseas', 
  },
  {
    id: 'home-leave',
    title: 'Home Leave Passage',
    description: 'For expatriate staff entitled to travel to their home country.',
    icon: Home,
    href: '/trf/new/home-leave', 
  },
  {
    id: 'external-parties',
    title: 'Business Travel Request for External Parties',
    description: 'For non-employees traveling on behalf of the company.',
    icon: Users,
    href: '/trf/new/external-parties',
  },
];

export default function NewTRFSelectionPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FilePlus2 className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Create New Travel Request Form</h1>
        </div>
        <p className="text-muted-foreground">Please select the type of travel request you want to create.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {trfOptions.map((option) => (
          <Link key={option.id} href={option.href} passHref>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <option.icon className="w-7 h-7 text-primary" />
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{option.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

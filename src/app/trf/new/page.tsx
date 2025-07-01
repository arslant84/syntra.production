import Link from 'next/link';
import { FilePlus2, PlaneTakeoff, Globe, Home, Users } from 'lucide-react';

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
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FilePlus2 className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Create New Travel Request Form</h1>
        </div>
        <p className="text-muted-foreground">Please select the type of travel request you want to create.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {trfOptions.map((option) => (
          <Link key={option.id} href={option.href} passHref>
            <div
              className="rounded-xl border border-muted bg-white shadow-sm p-6 h-full flex flex-col cursor-pointer transition hover:shadow-md hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
              tabIndex={0}
            >
              <div className="flex items-center gap-3 mb-2">
                <option.icon className="w-7 h-7 text-primary" />
                <span className="text-xl font-semibold">{option.title}</span>
              </div>
              <div className="text-muted-foreground text-base">{option.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

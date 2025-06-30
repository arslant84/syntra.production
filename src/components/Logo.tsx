import Link from 'next/link';

export default function Logo() {
  return (
    <Link 
      href="/" 
      className="flex items-center text-primary hover:text-primary/90 transition-colors h-full" 
      aria-label="Synchronised Travel Homepage" 
    >
      {/* The visible text "Synchronised Travel" has been removed. */}
      {/* An icon could be placed here if desired in the future. */}
    </Link>
  );
}

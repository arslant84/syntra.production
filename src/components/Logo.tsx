import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Logo() {
  return (
    <Link 
      href="/" 
      className="flex items-center text-primary hover:text-primary/90 transition-colors h-full" 
      aria-label="Synchronised Travel Homepage" 
    >
      <div className="flex items-center">
        <div className="relative h-8 w-8 mr-3">
          <Image 
            src="/Open.png" 
            alt="PETRONAS Logo" 
            width={32}
            height={32}
            className="object-contain"
            priority
          />
        </div>
        <span className="font-medium text-lg self-center">Synchronised Travel</span>
      </div>
    </Link>
  );
}

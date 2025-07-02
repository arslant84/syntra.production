"use client";

import React, { useEffect } from 'react';

interface BackgroundWrapperProps {
  children?: React.ReactNode;
}

const BackgroundWrapper: React.FC<BackgroundWrapperProps> = ({ children }) => {
  useEffect(() => {
    // Apply background directly to document body on component mount
    if (typeof document !== 'undefined') {
      document.body.style.backgroundImage = "url('/background.jpg')";
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.minHeight = '100vh';
      
      // Clean up function to remove styles when component unmounts
      return () => {
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundRepeat = '';
        document.body.style.backgroundAttachment = '';
        document.body.style.minHeight = '';
      };
    }
  }, []);

  return null; // This component doesn't render anything visible
};

export default BackgroundWrapper;

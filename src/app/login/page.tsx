"use client";
import React from 'react';
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import './login.css';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && !hasRedirected) {
      setHasRedirected(true);
      router.replace("/");
    }
  }, [status, router, hasRedirected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(res.error);
    } else {
      router.replace("/");
    }
  };

  const handleMicrosoftSignIn = () => {
    setLoading(true);
    signIn('azure-ad');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100 flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm">
        {/* Main login card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* Logo section */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-2 mb-2">
              <div className="relative w-8 h-8">
                <Image 
                  src="/Open.png" 
                  alt="SynTra Logo" 
                  fill
                  className="object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-wide">
                SynTra
              </h1>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="Please enter your account"
                className={`w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b1a9]/20 ${
                  focusedField === 'email' 
                    ? 'border-[#00b1a9] bg-[#00b1a9]/10' 
                    : 'hover:border-gray-300'
                }`}
                required
                autoFocus
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Please enter your password"
                className={`w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b1a9]/20 ${
                  focusedField === 'password' 
                    ? 'border-[#00b1a9] bg-[#00b1a9]/10' 
                    : 'hover:border-gray-300'
                }`}
                required
                minLength={15}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00b1a9] text-white py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 hover:bg-[#009c94] focus:outline-none focus:ring-2 focus:ring-[#00b1a9]/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  LOGIN
                </div>
              ) : (
                "LOGIN"
              )}
            </button>
          </form>

          {/* Microsoft sign in option */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="w-full bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-lg font-semibold text-base transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.64 9.05L1.73 2.14H8.64V9.05Z" fill="#F25022"/>
                <path d="M9.36 9.05V2.14H16.27L9.36 9.05Z" fill="#7FBA00"/>
                <path d="M9.36 9.77L16.27 16.68H9.36V9.77Z" fill="#00A4EF"/>
                <path d="M8.64 9.77V16.68H1.73L8.64 9.77Z" fill="#FFB900"/>
              </svg>
              Sign in with Microsoft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
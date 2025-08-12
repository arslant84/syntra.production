"use client";
import React from 'react';
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-blue-600 to-green-400">
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 backdrop-blur-md p-10 rounded-2xl shadow-2xl w-full max-w-md border border-blue-100"
      >
        {/* Logo section */}
        <div className="flex justify-center mb-6 items-center gap-2">
          <div className="relative w-10 h-10">
            <Image 
              src="/Open.png" 
              alt="SynTra Logo" 
              fill
              className="object-contain w-auto h-auto"
            />
          </div>
          <div className="text-3xl font-bold text-blue-900">SynTra</div>
        </div>
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-900">Sign in</h1>
        <div className="mb-4">
          <label className="block mb-1 font-semibold text-blue-800">Email</label>
          <input
            type="email"
            className="w-full border border-blue-200 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-semibold text-blue-800">Password</label>
          <input
            type="password"
            className="w-full border border-blue-200 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={15}
            placeholder="At least 15 characters"
          />
        </div>
        {error && (
          <div className="mb-4 text-red-600 text-sm text-center">{error}</div>
        )}
        <button
          type="submit"
          className="w-full bg-blue-700 text-white py-2 rounded font-semibold hover:bg-blue-800 transition shadow-md"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        
        <div className="mt-4 text-center">
          <div className="text-gray-500 text-sm mb-3">or</div>
          <button
            type="button"
            onClick={() => signIn('azure-ad')}
            className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded font-semibold hover:bg-gray-50 transition shadow-md flex items-center justify-center gap-2"
            disabled={loading}
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
      </form>
    </div>
  );
} 
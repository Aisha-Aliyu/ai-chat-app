"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Sign up
  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/chat");
    } catch (err) {
      setError(err.message);
    }
  };

  // Login
  const handleSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/chat");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden px-4">
      {/* Background Animation - Floating Dots */}
      <div className="absolute inset-0">
        <div className="absolute w-2 h-2 bg-blue-500 rounded-full top-10 left-20 animate-float"></div>
        <div className="absolute w-3 h-3 bg-green-500 rounded-full top-1/3 left-2/3 animate-float-delayed"></div>
        <div className="absolute w-2 h-2 bg-purple-500 rounded-full bottom-16 right-24 animate-float-slow"></div>
        <div className="absolute w-3 h-3 bg-pink-500 rounded-full bottom-1/4 left-1/4 animate-float"></div>
      </div>

      {/* Glow Orbs */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-green-600 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse"></div>

      {/* Glassmorphic Card */}
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 relative z-10">
        <h1 className="text-3xl font-extrabold mb-6 text-center bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
          AI Chat App
        </h1>

        {/* Email Input */}
        <div className="relative mb-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 pl-10 rounded-lg bg-gray-800/70 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <span className="absolute left-3 top-3 text-gray-400">📧</span>
        </div>

        {/* Password Input */}
        <div className="relative mb-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 pl-10 rounded-lg bg-gray-800/70 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          />
          <span className="absolute left-3 top-3 text-gray-400">🔑</span>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-red-400 text-sm mb-3 text-center">{error}</p>
        )}

        {/* Buttons */}
        <button
          onClick={handleSignUp}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-3 rounded-lg mb-3 hover:scale-105 transform transition font-semibold shadow-lg"
        >
          Sign Up
        </button>
        <button
          onClick={handleSignIn}
          className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white py-3 rounded-lg hover:scale-105 transform transition font-semibold shadow-lg"
        >
          Login
        </button>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes float {
          0% {transform: translateY(0) translateX(0);
          }
          50% {
            transform: translateY(-15px) translateX(10px);
          }
          100% {
            transform: translateY(0) translateX(0);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 8s ease-in-out infinite;
          animation-delay: 2s;
        }
        .animate-float-slow {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
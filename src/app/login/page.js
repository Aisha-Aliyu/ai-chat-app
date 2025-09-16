"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // ✅ Next.js navigation
import { auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter(); // ✅ initialize router

  // Sign up
  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/chat"); // ✅ redirect after signup
    } catch (err) {
      setError(err.message);
    }
  };

  // Login
  const handleSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/chat"); // ✅ redirect after login
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-80">
        <h1 className="text-2xl font-bold mb-6 text-center text-white">
          AI Chat App
        </h1>

        {/* Email Input */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Password Input */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        {/* Error Message */}
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {/* Buttons */}
        <button
          onClick={handleSignUp}
          className="w-full bg-blue-600 text-white py-2 rounded mb-2 hover:bg-blue-700 font-medium transition"
        >
          Sign Up
        </button>
        <button
          onClick={handleSignIn}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 font-medium transition"
        >
          Login
        </button>
      </div>
    </div>
  );
}
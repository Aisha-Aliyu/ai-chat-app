"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // Track logged-in user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsub();
  }, []);

  // Load messages in real-time
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let msgs = [];
      snapshot.forEach((doc) => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  // Send new message
  const sendMessage = async () => {
    if (!message.trim()) return;
    await addDoc(collection(db, "messages"), {
      text: message,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
    });
    setMessage("");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold">
        Please login first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg max-w-xs shadow-md ${
              msg.uid === user.uid
                ? "bg-blue-700 text-white ml-auto"
                : "bg-gray-800 text-gray-100"
            }`}
          >
            <p className="text-xs text-gray-300 mb-1">{msg.email}</p>
            <p className="text-base">{msg.text}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-800 flex">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 border border-gray-600 rounded-l px-3 py-2 bg-gray-700 text-white placeholder-gray-400"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r font-medium"
        >
          Send
        </button>
      </div>
    </div>
  );
}
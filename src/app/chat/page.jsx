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
  setDoc,
  doc,
  getDocs,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ChatPage() {
  const [user, setUser] = useState(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);

  const [currentChat, setCurrentChat] = useState(null);
  const [isDirect, setIsDirect] = useState(false);

  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true); // NEW: sidebar toggle

  // Track logged-in user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        await setDoc(
          doc(db, "users", loggedUser.uid),
          {
            uid: loggedUser.uid,
            email: loggedUser.email,
          },
          { merge: true }
        );
      }
    });
    return () => unsub();
  }, []);

  // Load rooms
  useEffect(() => {
    const q = query(collection(db, "rooms"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      let rms = [];
      snapshot.forEach((doc) => rms.push({ id: doc.id, ...doc.data() }));
      setRooms(rms);
    });
    return () => unsub();
  }, []);

  // Load users for DMs
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snapshot) => {
      let list = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setUsers(list.filter((u) => u.uid !== user?.uid));
    });
    return () => unsub();
  }, [user]);

  // Load messages for current chat
  useEffect(() => {
    if (!user || !currentChat) return;

    let unsub;

    if (isDirect) {
      const q = query(
        collection(db, "directMessages"),
        orderBy("createdAt", "asc")
      );
      unsub = onSnapshot(q, (snapshot) => {
        let msgs = [];
        snapshot.forEach((docSnap) => {
          let d = docSnap.data();
          if (
            (d.from === user.uid && d.to === currentChat.uid) ||
            (d.from === currentChat.uid && d.to === user.uid)
          ) {
            msgs.push({ id: docSnap.id, ...d });
          }
        });
        setMessages(msgs);

        // Mark as read
        msgs.forEach((m) => {
          if (m.to === user.uid && !m.read) {
            setDoc(
              doc(db, "directMessages", m.id),
              { read: true },
              { merge: true }
            );
          }
        });

        setDoc(
          doc(db, "chatStatus", user.uid, "direct", currentChat.uid),
          { lastOpened: serverTimestamp() },
          { merge: true }
        );
      });
    } else {
      const q = query(
        collection(db, "rooms", currentChat.id, "messages"),
        orderBy("createdAt", "asc")
      );
      unsub = onSnapshot(q, (snapshot) => {
        let msgs = [];
        snapshot.forEach((docSnap) => msgs.push({ id: docSnap.id, ...docSnap.data() }));
        setMessages(msgs);

        // Mark as read
        msgs.forEach((m) => {
          if (m.uid !== user.uid && !m.read) {
            setDoc(
              doc(db, "rooms", currentChat.id, "messages", m.id),
              { read: true },
              { merge: true }
            );
          }
        });

        setDoc(
          doc(db, "chatStatus", user.uid, "rooms", currentChat.id),
          { lastOpened: serverTimestamp() },
          { merge: true }
        );
      });
    }

    return () => unsub && unsub();
  }, [user, currentChat, isDirect]);

  // Fetch last message previews
  useEffect(() => {
    if (!user) return;const fetchLasts = async () => {
      let previews = {};

      // Rooms
      for (let r of rooms) {
        const qMsg = query(
          collection(db, "rooms", r.id, "messages"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(qMsg);
        snap.forEach((d) => (previews[r.id] = d.data()));
      }

      // DMs
      const qDM = query(
        collection(db, "directMessages"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const snapDM = await getDocs(qDM);
      snapDM.forEach((d) => {
        const m = d.data();
        const partner = m.from === user.uid ? m.to : m.from;
        if (!previews[partner]) previews[partner] = m;
      });

      setLastMessages(previews);
    };

    fetchLasts();
  }, [rooms, users, user]);

  // Send new message
  const sendMessage = async () => {
    if (!message.trim() || !currentChat) return;

    if (isDirect) {
      await addDoc(collection(db, "directMessages"), {
        text: message,
        from: user.uid,
        to: currentChat.uid,
        email: user.email,
        createdAt: serverTimestamp(),
        delivered: true,
        read: false,
      });
    } else {
      await addDoc(collection(db, "rooms", currentChat.id, "messages"), {
        text: message,
        uid: user.uid,
        email: user.email,
        createdAt: serverTimestamp(),
        delivered: true,
        read: false,
      });
    }

    setMessage("");
  };

  const renderTicks = (msg) => {
    if (msg.read) {
      return <span className="text-blue-400 ml-1">✓✓</span>; // read
    }
    if (msg.delivered) {
      return <span className="text-gray-400 ml-1">✓✓</span>; // delivered
    }
    return <span className="text-gray-400 ml-1">✓</span>; // sent
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold">
        Please login first.
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div
        className={`w-72 border-r border-gray-700 p-4 flex flex-col bg-gray-900 absolute md:relative z-20 h-full transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-72"
        }`}
      >
        <button
          className="md:hidden text-gray-300 mb-4"
          onClick={() => setSidebarOpen(false)}
        >
          ✖ Close
        </button>

        <h2 className="text-xl font-bold mb-4">Chats</h2>

        {/* Rooms */}
        <h3 className="text-gray-400 text-sm mb-2">Rooms</h3>
        {rooms.map((room) => {
          const preview = lastMessages[room.id];
          return (
            <button
              key={room.id}
              onClick={() => {
                setCurrentChat(room);
                setIsDirect(false);
                setSidebarOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded mb-2 ${
                currentChat?.id === room.id && !isDirect
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{room.name}</span>
                {unreadCounts[room.id] > 0 && (
                  <span className="bg-red-600 text-xs rounded-full px-2 py-0.5">
                    {unreadCounts[room.id]}
                  </span>
                )}
              </div>
              {preview && (
                <p className="text-xs text-gray-400 truncate">
                  {preview.email === user.email ? "You" : preview.email}:{" "}
                  {preview.text}
                </p>
              )}
            </button>
          );
        })}

        <div className="p-2">
          <button
            onClick={() => setShowRoomModal(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium"
          >
            + New Room</button>
        </div>

        {/* Direct Messages */}
        <div className="border-t border-gray-700 mt-4 pt-2">
          <h3 className="text-gray-400 text-sm px-2 mb-2">Direct Messages</h3>
          {users.map((u) => {
            const preview = lastMessages[u.uid];
            return (
              <button
                key={u.uid}
                onClick={() => {
                  setCurrentChat(u);
                  setIsDirect(true);
                  setSidebarOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 rounded mb-2 ${
                  currentChat?.uid === u.uid && isDirect
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{u.email}</span>
                  {unreadCounts[u.uid] > 0 && (
                    <span className="bg-red-600 text-xs rounded-full px-2 py-0.5">
                      {unreadCounts[u.uid]}
                    </span>
                  )}
                </div>
                {preview && (
                  <p className="text-xs text-gray-400 truncate">
                    {preview.from === user.uid ? "You" : u.email}: {preview.text}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Section */}
      <div className="flex-1 flex flex-col">
        <div className="md:hidden p-2 bg-gray-800 flex items-center">
          <button
            className="text-gray-300"
            onClick={() => setSidebarOpen(true)}
          >
            ☰ Menu
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg max-w-xs shadow-md ${
                (isDirect ? msg.from : msg.uid) === user.uid
                  ? "bg-blue-700 text-white ml-auto"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              <p className="text-xs text-gray-300 mb-1 flex justify-between">
                <span>
                  {msg.email ||
                    (msg.from === user.uid ? "You" : currentChat.email)}
                </span>
                {(isDirect ? msg.from : msg.uid) === user.uid && renderTicks(msg)}
              </p>
              <p className="text-base">{msg.text}</p>
            </div>
          ))}
        </div>

        {/* Input */}
        {currentChat && (
          <div className="p-4 bg-gray-800 flex">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
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
        )}
      </div>

      {/* Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-80">
            <h2 className="text-white text-lg font-semibold mb-4">
              Create New Room
            </h2>
            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter room name..."
              className="w-full p-2 rounded bg-gray-700 text-white mb-4 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRoomModal(false)}className="px-3 py-2 rounded bg-gray-600 text-white hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (newRoomName.trim()) {
                    await addDoc(collection(db, "rooms"), {
                      name: newRoomName.trim(),
                      createdAt: serverTimestamp(),
                    });
                    setNewRoomName("");
                    setShowRoomModal(false);
                  }
                }}
                className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import { db, auth, storage } from "../../lib/firebase";
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
  getDoc,
  limit,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
  const [newRoomUsers, setNewRoomUsers] = useState([]);
  const [includeAiInRoom, setIncludeAiInRoom] = useState(false);

  const [typingUsers, setTypingUsers] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  const [aiPersonality, setAiPersonality] = useState("friendly");
  const personalities = {
    friendly:
      "You are a warm, supportive AI friend. Be kind, casual, and positive.",
    sarcastic:
      "You are a witty AI that responds with sarcasm, but still helpful.",
    professional:
      "You are a professional AI assistant. Be concise and formal.",
    motivational:
      "You are a motivational coach AI. Encourage and uplift the user.",
  };

  const [aiTyping, setAiTyping] = useState(false);
  const aiQueue = useRef(Promise.resolve());
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  // Track logged-in user + presence
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        await setDoc(
          doc(db, "users", loggedUser.uid),
          {
            uid: loggedUser.uid,
            email: loggedUser.email,
            photoURL: loggedUser.photoURL || null,
            status: "online",
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
      }
    });
    return () => unsub();
  }, []);

  // Mark offline when leaving
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (user) {
        await setDoc(
          doc(db, "users", user.uid),
          { status: "offline", lastSeen: serverTimestamp() },
          { merge: true }
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user]);

  // Load rooms
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "rooms"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      let rms = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const members = data.members || [];
        if (members.includes(user.uid) || d.id === "ai-bot") {
          rms.push({ id: d.id, ...data });
        }
      });
      setRooms(rms);
    });
    return () => unsub();
  }, [user]);

  // Load users
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snapshot) => {
      let list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setUsers(list.filter((u) => u.uid !== user?.uid));
    });
    return () => unsub;
  }, [user]);

  // Load messages
  useEffect(() => {
    if (!user || !currentChat) return;

    let unsub;

    if (currentChat.id === "ai-bot") {
      const q = query(
        collection(db, "aiChats", user.uid, "messages"),
        orderBy("createdAt", "asc")
      );unsub = onSnapshot(q, (snapshot) => {
        let msgs = [];
        snapshot.forEach((docSnap) =>
          msgs.push({ id: docSnap.id, ...docSnap.data() })
        );
        setMessages(msgs);
      });
    } else if (isDirect) {
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
      });
    } else {
      const q = query(
        collection(db, "rooms", currentChat.id, "messages"),
        orderBy("createdAt", "asc")
      );
      unsub = onSnapshot(q, (snapshot) => {
        let msgs = [];
        snapshot.forEach((docSnap) =>
          msgs.push({ id: docSnap.id, ...docSnap.data() })
        );
        setMessages(msgs);
      });

      // Typing status
      const qTyping = collection(db, "rooms", currentChat.id, "typingStatus");
      const unsubTyping = onSnapshot(qTyping, (snapshot) => {
        let typing = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.data().typing && docSnap.id !== user.uid) {
            typing.push(docSnap.id);
          }
        });
        setTypingUsers(typing);
      });

      return () => {
        unsub && unsub();
        unsubTyping && unsubTyping();
      };
    }

    return () => unsub && unsub();
  }, [user, currentChat, isDirect]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message (with AI streaming + file upload support)
  const sendMessage = async (fileUrl = null) => {
    if ((!message.trim() && !fileUrl) || !currentChat) return;

    // AI chat
    if (
      currentChat.id === "ai-bot" ||
      (currentChat.members?.includes("ai-bot") && includeAiInRoom)
    ) {
      const aiPerson = currentChat.aiPersonality || aiPersonality;
      const userMsg = {
        text: message.trim(),
        fileUrl: fileUrl || null,
        uid: user.uid,
        email: user.email,
        createdAt: serverTimestamp(),
        delivered: true,
        read: true,
      };

      if (currentChat.id === "ai-bot") {
        await addDoc(collection(db, "aiChats", user.uid, "messages"), userMsg);
      } else {
        await addDoc(
          collection(db, "rooms", currentChat.id, "messages"),
          userMsg
        );
      }

      setMessage("");
      setAiTyping(true);

      aiQueue.current = aiQueue.current.then(async () => {
        try {
          let historySnap;
          if (currentChat.id === "ai-bot") {
            historySnap = await getDocs(
              query(
                collection(db, "aiChats", user.uid, "messages"),
                orderBy("createdAt", "desc"),
                limit(10)
              )
            );
          } else {
            historySnap = await getDocs(
              query(
                collection(db, "rooms", currentChat.id, "messages"),
                orderBy("createdAt", "desc"),
                limit(10)
              )
            );
          }

          const history = [];
          historySnap.forEach((docSnap) => {
            const d = docSnap.data();
            history.unshift({
              role: d.uid === "ai-bot" ? "assistant" : "user",
              content: d.text,
            });
          });

          const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: history,
              personality: personalities[aiPerson],
              stream: true, // enable streaming
            }),
          });

          const reader = res.body.getReader();
          let partial = "";

          while (true) {const { done, value } = await reader.read();
            if (done) break;
            const chunk = new TextDecoder().decode(value);
            partial += chunk;

            // Update partial AI message
            await setDoc(
              doc(
                db,
                currentChat.id === "ai-bot"
                  ? `aiChats/${user.uid}/messages/temp-ai`
                  : `rooms/${currentChat.id}/messages/temp-ai`
              ),
              {
                text: partial,
                uid: "ai-bot",
                email: "AI Assistant 🤖",
                createdAt: serverTimestamp(),
                delivered: true,
                read: true,
              }
            );
          }

          // Finalize AI message
          const aiMsg = {
            text: partial || "Sorry, I couldn’t generate a response.",
            uid: "ai-bot",
            email: "AI Assistant 🤖",
            createdAt: serverTimestamp(),
            delivered: true,
            read: true,
          };

          if (currentChat.id === "ai-bot") {
            await addDoc(collection(db, "aiChats", user.uid, "messages"), aiMsg);
          } else {
            await addDoc(
              collection(db, "rooms", currentChat.id, "messages"),
              aiMsg
            );
          }
        } catch (err) {
          console.error("AI error:", err);
        } finally {
          setAiTyping(false);
        }
      });

      return;
    }

    // Direct messages
    if (isDirect) {
      await addDoc(collection(db, "directMessages"), {
        text: message.trim(),
        fileUrl: fileUrl || null,
        from: user.uid,
        to: currentChat.uid,
        email: user.email,
        createdAt: serverTimestamp(),
        delivered: true,
        read: false,
      });
      setMessage("");
      return;
    }

    // Room messages
    await addDoc(collection(db, "rooms", currentChat.id, "messages"), {
      text: message.trim(),
      fileUrl: fileUrl || null,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
      delivered: true,
      read: false,
    });
    setMessage("");
  };

  // Handle file uploads
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const storageRef = ref(
      storage,
      `uploads/${user.uid}/${Date.now()}-${file.name}`
    );
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await sendMessage(url);
  };

  // Typing indicators
  const startTyping = async () => {
    if (!currentChat?.id) return;
    await setDoc(
      doc(db, "rooms", currentChat.id, "typingStatus", user.uid),
      { typing: true },
      { merge: true }
    );
  };
  const stopTyping = async () => {
    if (!currentChat?.id) return;
    await setDoc(
      doc(db, "rooms", currentChat.id, "typingStatus", user.uid),
      { typing: false },
      { merge: true }
    );
  };

  // Toggle reaction
  const toggleReaction = async (msgId, emoji) => {
    const msgRef = doc(db, "rooms", currentChat.id, "messages", msgId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;

    const data = msgSnap.data();
    const existingReaction = data.reactions?.find(
      (r) => r.uid === user.uid && r.emoji === emoji
    );

    if (existingReaction) {
      await updateDoc(msgRef, {
        reactions: arrayRemove(existingReaction),
      });
    } else {
      await updateDoc(msgRef, {
        reactions: arrayUnion({ emoji, uid: user.uid }),
      });
    }
  };

  // Create new room
  const createRoom = async () => {
    if (!newRoomName.trim() || newRoomUsers.length === 0) return;

    const members = [user.uid, ...newRoomUsers];
    if (includeAiInRoom) members.push("ai-bot");

    const roomRef = await addDoc(collection(db, "rooms"), {
      name: newRoomName,
      members: members.length > 0 ? members : [user.uid],
      admin: user.uid,
      createdAt: serverTimestamp(),
      aiPersonality: includeAiInRoom ? aiPersonality : null,
    });setNewRoomName("");
    setNewRoomUsers([]);
    setIncludeAiInRoom(false);
    setShowRoomModal(false);
    setCurrentChat({ id: roomRef.id, name: newRoomName });
    setSidebarOpen(false);
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
        {currentChat && (
          <button
            className="text-gray-300 mb-4 flex items-center gap-2"
            onClick={() => {
              setCurrentChat(null);
              setSidebarOpen(true);
            }}
          >
            ← Back
          </button>
        )}

        <h2 className="text-xl font-bold mb-4">Chats</h2>

        <button
          onClick={() => setShowRoomModal(true)}
          className="mb-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
        >
          + Create Room
        </button>

        <h3 className="text-gray-400 text-sm mb-2">Rooms</h3>
        {rooms.map((room) => (
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
            {room.name}
          </button>
        ))}

        {/* AI Assistant */}
        <button
          onClick={() => {
            setCurrentChat({ id: "ai-bot", name: "AI Assistant" });
            setIsDirect(false);
            setSidebarOpen(false);
          }}
          className={`block w-full text-left px-3 py-2 rounded mb-2 ${
            currentChat?.id === "ai-bot"
              ? "bg-green-600 text-white"
              : "text-gray-300 hover:bg-gray-700"
          }`}
        >
          🤖 AI Assistant
        </button>

        {currentChat?.id === "ai-bot" && (
          <div className="mt-2">
            <label className="block text-sm text-gray-400 mb-1">
              Personality:
            </label>
            <select
              value={aiPersonality}
              onChange={(e) => setAiPersonality(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-2 rounded"
            >
              {Object.keys(personalities).map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chat Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
            const isMine =
              (isDirect ? msg.from : msg.uid) === user.uid &&
              msg.uid !== "ai-bot";
            const isAi = msg.uid === "ai-bot";

            // Count reactions
            const reactionCounts = {};
            msg.reactions?.forEach((r) => {
              reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
            });

            return (
              <div
                key={msg.id}
                className={`p-3 rounded-lg max-w-xs shadow-md ${
                  isAi
                    ? "bg-green-700 text-white"
                    : isMine
                    ? "bg-blue-700 text-white ml-auto"
                    : "bg-gray-800 text-gray-100"
                }`}
              >
                <p className="text-xs text-gray-300 mb-1">
                  {isAi ? "AI Assistant 🤖" : isMine ? "You" : msg.email}</p>

                {msg.fileUrl ? (
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-300"
                  >
                    📎 File Attachment
                  </a>
                ) : (
                  <p className="text-base">{msg.text}</p>
                )}

                {/* Reactions */}
                <div className="flex mt-1">
                  {Object.entries(reactionCounts).map(([emoji, count]) => (
                    <span
                      key={emoji}
                      className="mx-1 cursor-pointer"
                      onClick={() => toggleReaction(msg.id, emoji)}
                    >
                      {emoji} {count}
                    </span>
                  ))}
                  <span
                    className="mx-1 cursor-pointer"
                    onClick={() => toggleReaction(msg.id, "👍")}
                  >
                    👍
                  </span>
                  <span
                    className="mx-1 cursor-pointer"
                    onClick={() => toggleReaction(msg.id, "❤️")}
                  >
                    ❤️
                  </span>
                  <span
                    className="mx-1 cursor-pointer"
                    onClick={() => toggleReaction(msg.id, "😂")}
                  >
                    😂
                  </span>
                </div>
              </div>
            );
          })}

          {aiTyping && (
            <div className="bg-gray-700 text-gray-300 px-3 py-2 rounded-lg max-w-xs">
              AI Assistant is typing...
            </div>
          )}

          {typingUsers.length > 0 && (
            <div className="bg-gray-700 text-gray-300 px-3 py-2 rounded-lg max-w-xs">
              {typingUsers.join(", ")} typing...
            </div>
          )}

          <div ref={messagesEndRef}></div>
        </div>

        {/* Input */}
        {currentChat && (
          <div className="p-4 border-t border-gray-700 flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                startTyping();
                if (typingTimeout.current) clearTimeout(typingTimeout.current);
                typingTimeout.current = setTimeout(stopTyping, 2000);
              }}
              placeholder="Type a message..."
              className="flex-1 p-2 rounded bg-gray-800 text-white border border-gray-600"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                  stopTyping();
                }
              }}
            />
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer"
            >
              📎
            </label>
            <button
              onClick={() => {
                sendMessage();
                stopTyping();
              }}
              className="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
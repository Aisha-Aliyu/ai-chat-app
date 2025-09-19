"use client";

import { useState, useEffect, useRef } from "react";
import { db, auth, storage } from "../../lib/firebase";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
  startAfter,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";

// Components
import ChatWindow from "../components/ChatWindow";
import Sidebar from "../components/Sidebar";
import RoomModal from "../components/RoomModal";

// Custom hook
import useAI from "../hooks/useAI";

// Emoji picker
const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [isDirect, setIsDirect] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomUsers, setNewRoomUsers] = useState([]);
  const [includeAiInRoom, setIncludeAiInRoom] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiPersonality, setAiPersonality] = useState("friendly");
  const [previewFile, setPreviewFile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const messagesEndRef = useRef(null);
  const lastVisibleRef = useRef(null);
  const fileInputRef = useRef(null);

  const personalities = {
    friendly: "You are a warm, supportive AI friend. Be kind, casual, and positive.",
    sarcastic: "You are a witty AI that responds with sarcasm, but still helpful.",
    professional: "You are a professional AI assistant. Be concise and formal.",
    motivational: "You are a motivational coach AI. Encourage and uplift the user.",
  };

  const { aiTyping, sendAIMessage } = useAI(user, aiPersonality, personalities);

  // -------------------------
  // Authentication
  // -------------------------
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

  // -------------------------
  // Fetch Rooms & Users
  // -------------------------
  useEffect(() => {
    if (!user) return;
    const unsubRooms = onSnapshot(
      query(collection(db, "rooms"), orderBy("createdAt", "asc")),
      (snapshot) => {
        const rms = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const members = data.members || [];
          if (members.includes(user.uid) || d.id === "ai-bot") {
            rms.push({ id: d.id, ...data });
          }
        });
        setRooms(rms);
      }
    );

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));setUsers(list.filter((u) => u.uid !== user?.uid));
    });

    return () => {
      unsubRooms();
      unsubUsers();
    };
  }, [user]);

  // -------------------------
  // Helper: Stable direct chat id
  // -------------------------
  const getDirectChatId = (a, b) => {
    if (!a || !b) return null;
    return [a, b].sort().join("_"); // deterministic ID for 2 users
  };

  // -------------------------
  // Typing Collection Helper
  // -------------------------
  const getTypingCollection = () => {
    if (!currentChat) return null;

    if (currentChat.id === "ai-bot") {
      return collection(db, "aiChats", user.uid, "typingStatus");
    }

    if (isDirect) {
      const directId = getDirectChatId(user.uid, currentChat.uid);
      if (!directId) return null;
      return collection(db, "directTyping", directId, "typingStatus");
    }

    return collection(db, "rooms", currentChat.id, "typingStatus");
  };

  const startTyping = async () => {
    const col = getTypingCollection();
    if (!col) return;
    await setDoc(doc(col, user.uid), { typing: true }, { merge: true });
  };
  const stopTyping = async () => {
    const col = getTypingCollection();
    if (!col) return;
    await setDoc(doc(col, user.uid), { typing: false }, { merge: true });
  };

  // -------------------------
  // Fetch Messages & Typing
  // -------------------------
  useEffect(() => {
    if (!user || !currentChat) return;
    let unsubMsgs, unsubTyping;

    const setupMessages = async () => {
      let colMsgs, colTyping;

      if (currentChat.id === "ai-bot") {
        colMsgs = collection(db, "aiChats", user.uid, "messages");
        colTyping = collection(db, "aiChats", user.uid, "typingStatus");
      } else if (isDirect) {
        const directId = getDirectChatId(user.uid, currentChat.uid);
        colMsgs = collection(db, "directMessages");
        colTyping = collection(db, "directTyping", directId, "typingStatus");
      } else {
        colMsgs = collection(db, "rooms", currentChat.id, "messages");
        colTyping = collection(db, "rooms", currentChat.id, "typingStatus");
      }

      unsubMsgs = onSnapshot(
        query(colMsgs, orderBy("createdAt", "asc"), limit(50)),
        (snap) => {
          const msgs = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            if (currentChat.id === "ai-bot") {
              msgs.push({ id: docSnap.id, ...d });
            } else if (isDirect) {
              if (
                (d.from === user.uid && d.to === currentChat.uid) ||
                (d.from === currentChat.uid && d.to === user.uid)
              ) {
                msgs.push({ id: docSnap.id, ...d });
              }
            } else {
              msgs.push({ id: docSnap.id, ...d });
            }
          });
          setMessages(msgs);
          lastVisibleRef.current = snap.docs[snap.docs.length - 1] || null;
        }
      );

      unsubTyping = onSnapshot(colTyping, (snap) => {
        const typing = [];
        snap.forEach((d) => {
          if (d.data().typing && d.id !== user.uid) {
            const u = users.find((u) => u.uid === d.id);
            typing.push(u ? u.email : d.id);
          }
        });
        setTypingUsers(typing);
      });
    };

    setupMessages();

    return () => {
      unsubMsgs && unsubMsgs();
      unsubTyping && unsubTyping();
    };
  }, [user, currentChat, isDirect, users]);

  // -------------------------
  // Infinite Scroll
  // -------------------------
  const loadOlderMessages = async () => {
    if (!currentChat || !lastVisibleRef.current || loadingOlder) return;
    setLoadingOlder(true);

    let col;
    if (currentChat.id === "ai-bot")
      col = collection(db, "aiChats", user.uid, "messages");
    else if (isDirect) col = collection(db, "directMessages");
    else col = collection(db, "rooms", currentChat.id, "messages");

    const snap = await getDocs(
      query(
        col,
        orderBy("createdAt", "asc"),
        startAfter(lastVisibleRef.current),
        limit(50)
      )
    );const oldMsgs = [];
    snap.forEach((d) => oldMsgs.push({ id: d.id, ...d.data() }));
    setMessages((prev) => [...oldMsgs, ...prev]);
    lastVisibleRef.current = snap.docs[snap.docs.length - 1] || null;
    setLoadingOlder(false);
  };

  // -------------------------
  // Auto Scroll
  // -------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -------------------------
  // Emoji Picker
  // -------------------------
  const addEmoji = (emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // -------------------------
  // Reactions
  // -------------------------
  const toggleReaction = async (msgId, emoji) => {
    if (!currentChat) return;
    let msgRef;
    if (currentChat.id === "ai-bot")
      msgRef = doc(db, "aiChats", user.uid, "messages", msgId);
    else if (isDirect) msgRef = doc(db, "directMessages", msgId);
    else msgRef = doc(db, "rooms", currentChat.id, "messages", msgId);

    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const existing = data.reactions?.find(
      (r) => r.uid === user.uid && r.emoji === emoji
    );
    if (existing) await updateDoc(msgRef, { reactions: arrayRemove(existing) });
    else await updateDoc(msgRef, {
      reactions: arrayUnion({ emoji, uid: user.uid }),
    });
  };

  // -------------------------
  // Delete Message
  // -------------------------
  const deleteMessage = async (msgId) => {
    if (!currentChat) return;
    let msgRef;
    if (currentChat.id === "ai-bot")
      msgRef = doc(db, "aiChats", user.uid, "messages", msgId);
    else if (isDirect) msgRef = doc(db, "directMessages", msgId);
    else msgRef = doc(db, "rooms", currentChat.id, "messages", msgId);

    await deleteDoc(msgRef);
  };

  // -------------------------
  // Send Message
  // -------------------------
  const sendMessage = async (fileUrl = null) => {
    if ((!message.trim() && !fileUrl) || !currentChat) return;
    const msgText = message.trim();
    setMessage("");
    setPreviewFile(null);

    if (
      currentChat.id === "ai-bot" ||
      (currentChat.members?.includes("ai-bot") && includeAiInRoom)
    ) {
      await sendAIMessage(currentChat, msgText, includeAiInRoom);
      return;
    }

    if (isDirect) {
      await addDoc(collection(db, "directMessages"), {
        text: msgText,
        fileUrl: fileUrl || null,
        from: user.uid,
        to: currentChat.uid,
        sender: "user",
        email: user.email,
        createdAt: serverTimestamp(),
        delivered: true,
        read: false,
        reactions: [],
      });
      return;
    }

    await addDoc(collection(db, "rooms", currentChat.id, "messages"), {
      text: msgText,
      fileUrl: fileUrl || null,
      uid: user.uid,
      sender: "user",
      email: user.email,
      createdAt: serverTimestamp(),
      delivered: true,
      read: false,
      reactions: [],
    });
  };

  // -------------------------
  // File Upload
  // -------------------------
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024)
      return alert("File too large (max 5MB)");
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "video/mp4",
      "audio/mpeg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type))
      return alert("Unsupported file type");

    setPreviewFile(URL.createObjectURL(file));
    const storageRef = ref(
      storage,
      `uploads/${user.uid}/${Date.now()}-${file.name}`
    );
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await sendMessage(url);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      fileInputRef.current.files = e.dataTransfer.files;
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };
  const handleDragOver = (e) => e.preventDefault();

  // -------------------------
  // Create Room
  // -------------------------
  const createRoom = async () => {
    if (
      !newRoomName.trim() ||
      (newRoomUsers.length === 0 && !includeAiInRoom)
    )
      return;

    const members = [user.uid, ...newRoomUsers];
    if (includeAiInRoom) members.push("ai-bot");
    const roomRef = await addDoc(collection(db, "rooms"), {
      name: newRoomName,
      members,
      admin: user.uid,
      createdAt: serverTimestamp(),
      aiPersonality: includeAiInRoom ? aiPersonality : null,
    });

    setNewRoomName("");
    setNewRoomUsers([]);
    setIncludeAiInRoom(false);
    setShowRoomModal(false);
    setCurrentChat({ id: roomRef.id, name: newRoomName });
    setSidebarOpen(false);
  };

  // -------------------------
  // Render
  // -------------------------
  if (!user)
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold">
        Please login first.
      </div>
    );

  return (
    <div
      className="flex h-screen bg-gray-900 text-white relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Sidebar */}
      <Sidebar
        rooms={rooms}
        users={users}
        currentChat={currentChat}
        setCurrentChat={setCurrentChat}
        setIsDirect={setIsDirect}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        showRoomModal={showRoomModal}
        setShowRoomModal={setShowRoomModal}
        aiPersonality={aiPersonality}
        setAiPersonality={setAiPersonality}
        unreadCounts={{}}
      />

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        <ChatWindow
          currentChat={currentChat}
          messages={messages}
          message={message}
          setMessage={setMessage}
          sendMessage={sendMessage}
          startTyping={startTyping}
          stopTyping={stopTyping}
          typingUsers={typingUsers}
          aiTyping={aiTyping}
          previewFile={previewFile}
          setPreviewFile={setPreviewFile}
          addEmoji={addEmoji}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          messagesEndRef={messagesEndRef}
          loadOlderMessages={loadOlderMessages}
          toggleReaction={toggleReaction}
          deleteMessage={deleteMessage}
          user={user}
          isDirect={isDirect}
          Picker={Picker}
          onBack={() => setSidebarOpen(true)} //back button on mobile
        />
      </div>

      {showRoomModal && (
        <RoomModal
          users={users}
          newRoomName={newRoomName}
          setNewRoomName={setNewRoomName}
          newRoomUsers={newRoomUsers}
          setNewRoomUsers={setNewRoomUsers}
          includeAiInRoom={includeAiInRoom}
          setIncludeAiInRoom={setIncludeAiInRoom}
          aiPersonality={aiPersonality}
          setAiPersonality={setAiPersonality}
          personalities={personalities}
          createRoom={createRoom}
          setShowRoomModal={setShowRoomModal}
        />
      )}
    </div>
  );
}
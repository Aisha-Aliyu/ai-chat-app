import { useState, useRef } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

export default function useAI(user, aiPersonality, personalities) {
  const [aiTyping, setAiTyping] = useState(false);
  const aiQueue = useRef(Promise.resolve());

  const sendAIMessage = async (currentChat, messageText, includeAiInRoom = false) => {
    if (!currentChat || !messageText.trim()) return;

    const msgCollection =
      currentChat.id === "ai-bot"
        ? collection(db, "aiChats", user.uid, "messages")
        : collection(db, "rooms", currentChat.id, "messages");

    // Add user message
    const userMsg = {
      text: messageText,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
      delivered: true,
      read: currentChat.id === "ai-bot",
      reactions: [],
    };
    await addDoc(msgCollection, userMsg);

    // Only proceed if AI is in chat
    if (currentChat.id !== "ai-bot" && !currentChat.members?.includes("ai-bot") && !includeAiInRoom)
      return;

    const aiPerson = currentChat.aiPersonality || aiPersonality;
    setAiTyping(true);

    aiQueue.current = aiQueue.current.then(async () => {
      try {
        // Fetch last 10 messages
        const historySnap = await getDocs(
          query(msgCollection, orderBy("createdAt", "desc"), limit(10))
        );

        const history = [];
        historySnap.forEach((docSnap) => {
          const d = docSnap.data();
          history.unshift({
            role: d.uid === "ai-bot" ? "assistant" : "user",
            content: d.text,
          });
        });

        // Call AI API
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, personality: personalities[aiPerson], stream: true }),
        });

        const reader = res.body.getReader();
        let partial = "";

        // Create placeholder AI message
        const tempDocRef = doc(msgCollection);
        await setDoc(tempDocRef, {
          text: "",
          uid: "ai-bot",
          email: "AI Assistant 🤖",
          createdAt: serverTimestamp(),
          delivered: true,
          read: true,
          reactions: [],
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          partial += chunk;
          await updateDoc(tempDocRef, { text: partial });
        }

        // Final update with fallback
        await updateDoc(tempDocRef, { text: partial || "Sorry, I couldn’t generate a response." });
      } catch (err) {
        console.error("AI error:", err);
      } finally {
        setAiTyping(false);
      }
    });
  };

  return { aiTyping, sendAIMessage };
}
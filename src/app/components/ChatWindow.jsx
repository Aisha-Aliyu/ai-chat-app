import React, { useState, useEffect, useRef } from "react";

export default function ChatWindow({
  currentChat, messages = [], message, setMessage, sendMessage,
  startTyping, stopTyping, typingUsers = [], aiTyping,
  previewFile, setPreviewFile, addEmoji, showEmojiPicker, setShowEmojiPicker,
  fileInputRef, handleFileUpload, messagesEndRef, loadOlderMessages,
  toggleReaction, deleteMessage, editMessage, user, isDirect, Picker, data, onBack,
  sendAIMessage 
}) {
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");

  // Floating context menu state
  const [showOptions, setShowOptions] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });

  const bubbleRefs = useRef({});

  // Close floating menu on outside click
  useEffect(() => {
    if (!showOptions) return;
    const closeMenu = () => closeOptions();
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [showOptions]);

  if (!currentChat) {
    return (
      <div className="flex-1 flex items-center justify-center text-lg">
        Select a chat to start messaging
      </div>
    );
  }

  const handleSaveEdit = (id) => {
    if (editingText.trim()) {
      editMessage(id, editingText.trim(), true);
    }
    setEditingMessageId(null);
    setEditingText("");
  };

  // Handle closing pill with fade-out
  const closeOptions = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setShowOptions(false);
      setIsFadingOut(false);
      setSelectedMessage(null);
    }, 150);
  };

  // Send message + trigger AI if group has it
  const handleSend = () => {
    if (!message.trim()) return;

    // Send user’s message
    sendMessage();

    // If this room includes the AI → let it reply like a member
    if (currentChat.members?.includes("ai-bot")) {
      sendAIMessage(currentChat, message.trim(), true);
    }

    setMessage("");
    stopTyping();
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900 relative">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700 md:hidden">
        <button onClick={onBack} className="text-gray-300 hover:text-white">←</button>
        <h2 className="font-semibold">{currentChat?.name || "Chat"}</h2>
        <div className="w-6"></div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4"
        onScroll={(e) => {
          if (e.target.scrollTop === 0) loadOlderMessages();
        }}
      >
        {messages.map((msg) => {
          const isAI = msg.uid === "ai-bot";
          const isUser = msg.uid === user.uid;
          const isEditing = editingMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div>
                {/* File Preview */}
                {msg.fileUrl && (
                  <img src={msg.fileUrl} className="max-w-xs rounded mb-1" />
                )}

                {/* Chat Bubble */}
                <div
                  ref={(el) => (bubbleRefs.current[msg.id] = el)}
                  className={`inline-block px-3 py-2 rounded-lg max-w-xs break-words relative ${
                    isUser
                      ? "bg-blue-600 text-white"
                      : isAI
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 text-white"
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSelectedMessage(msg);
                    setShowOptions(true);

                    const rect = bubbleRefs.current[msg.id].getBoundingClientRect();
                    setOptionsPosition({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                    });
                  }}
                  onTouchStart={(e) => {
                    const timeout = setTimeout(() => {
                      setSelectedMessage(msg);
                      setShowOptions(true);

                      const rect = bubbleRefs.current[msg.id].getBoundingClientRect();
                      setOptionsPosition({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                      });
                    }, 600);
                    e.target.addEventListener("touchend", () => clearTimeout(timeout), { once: true });
                  }}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(msg.id);
                        if (e.key === "Escape") {
                          setEditingMessageId(null);
                          setEditingText("");
                        }
                      }}
                      className="w-full p-1 rounded text-black"
                      autoFocus
                    />
                  ) : (
                    msg.text
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center text-xs text-gray-400 mt-1 space-x-2">
                  <span>
                    {msg.timestamp
                      ? new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                    {msg.edited && " (edited)"}
                  </span>

                  {isEditing && (
                    <button
                      onClick={() => handleSaveEdit(msg.id)}
                      className="hover:text-green-400"
                    >
                      ✅ Save
                    </button>
                  )}
                </div>

                {/* Reactions */}
                <div className="flex space-x-2 mt-1">
                  {msg.reactions?.map((r, i) => (
                    <span key={i}>{r.emoji}</span>
                  ))}
                  <button onClick={() => toggleReaction(msg.id, "❤️")}>❤️</button>
                  <button onClick={() => toggleReaction(msg.id, "😂")}>😂</button>
                </div>
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="text-sm italic">
            {typingUsers.join(", ")} is typing...
          </div>
        )}
        {aiTyping && <div className="text-sm italic">AI is typing...</div>}
        <div ref={messagesEndRef}></div>
      </div>

      {/* Floating Pill Menu */}
      {(showOptions || isFadingOut) && selectedMessage && (
        <div
          className={`fixed bg-gray-800 text-white rounded-full shadow-lg px-4 py-2 flex gap-6 items-center text-sm 
                     ${isFadingOut ? "animate-fadeOut" : "animate-fadeIn"}`}
          style={{
            top: optionsPosition.y,
            left: optionsPosition.x,
            transform: "translate(-50%, -100%)",
            zIndex: 50,
          }}
        >
          {selectedMessage.uid === user.uid && (
            <>
              <button
                onClick={() => {
                  setEditingMessageId(selectedMessage.id);
                  setEditingText(selectedMessage.text);
                  closeOptions();
                }}
                className="hover:text-blue-400"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => {
                  deleteMessage(selectedMessage.id);
                  closeOptions();
                }}
                className="hover:text-red-400"
              >🗑 Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* File Preview */}
      {previewFile && (
        <div className="p-2">
          <img src={previewFile} className="max-w-xs rounded mb-2" />
        </div>
      )}

      {/* Input */}
      <div className="p-2 flex items-center space-x-2 bg-gray-800">
        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😊</button>
        {showEmojiPicker && Picker && data && (
          <div className="absolute bottom-16">
            <Picker data={data} onEmojiSelect={addEmoji} />
          </div>
        )}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            startTyping();
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          onBlur={stopTyping}
          placeholder="Type a message..."
          className="flex-1 p-2 rounded bg-gray-700 text-white"
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <button onClick={() => fileInputRef.current.click()}>📎</button>
        <button onClick={handleSend}>➡️</button>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.9) translate(-50%, -100%);
          }
          to {
            opacity: 1;
            transform: scale(1) translate(-50%, -100%);
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: scale(1) translate(-50%, -100%);
          }
          to {
            opacity: 0;
            transform: scale(0.9) translate(-50%, -100%);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out forwards;
        }
        .animate-fadeOut {
          animation: fadeOut 0.15s ease-in forwards;
        }
      `}</style>
    </div>
  );
}
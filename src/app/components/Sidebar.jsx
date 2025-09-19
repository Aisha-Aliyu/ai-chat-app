import React from "react";

export default function Sidebar({
  rooms, users, currentChat, setCurrentChat, setIsDirect,
  sidebarOpen, setSidebarOpen, setShowRoomModal
}) {
  return (
    <div
      className={`bg-gray-800 w-80 p-4 flex-shrink-0 transform top-0 left-0 h-full fixed md:relative transition-transform duration-300 z-40
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Chats</h2>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden text-gray-400 hover:text-white transition"
        >
          ☰
        </button>
      </div>

      {/* New Room Button */}
      <button
        onClick={() => setShowRoomModal(true)}
        className="w-full mb-4 bg-green-600 p-2 rounded hover:bg-green-500 transition text-white"
      >
        + New Room
      </button>

      {/* AI Assistant */}
<div
  onClick={() => {
    setCurrentChat({ id: "ai-bot", name: "AI Assistant 🤖" });
    setIsDirect(false);
  }}
  className={`p-2 rounded cursor-pointer transition 
    ${currentChat?.id === "ai-bot" ? "bg-gray-700 text-white" : "hover:bg-gray-700 text-gray-300"}`}
>
  🤖 AI Assistant
</div>

      {/* Rooms */}
      <div>
        <h3 className="font-semibold mb-2 text-gray-300">Rooms</h3>
        {rooms.map((room) => (
          <div
            key={room.id}
            onClick={() => {
              setCurrentChat(room);
              setIsDirect(false);
            }}
            className={`p-2 rounded cursor-pointer transition 
              ${currentChat?.id === room.id ? "bg-gray-700 text-white" : "hover:bg-gray-700 text-gray-300"}`}
          >
            {room.name}
          </div>
        ))}
      </div>

      {/* Users */}
      <div className="mt-4">
        <h3 className="font-semibold mb-2 text-gray-300">Users</h3>
        {users.map((u) => (
          <div
            key={u.uid}
            onClick={() => {
              setCurrentChat(u);
              setIsDirect(true);
            }}
            className={`p-2 rounded cursor-pointer transition 
              ${currentChat?.uid === u.uid ? "bg-gray-700 text-white" : "hover:bg-gray-700 text-gray-300"}`}
          >
            {u.email}
          </div>
        ))}
      </div>
    </div>
  );
}
import React from "react";

export default function RoomModal({
  users, newRoomName, setNewRoomName, newRoomUsers, setNewRoomUsers,
  includeAiInRoom, setIncludeAiInRoom, aiPersonality, setAiPersonality,
  personalities, createRoom, setShowRoomModal
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-96 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-white">Create New Room</h2>

        {/* Room Name */}
        <input
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          placeholder="Room name"
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        {/* Add Users */}
        <div className="mb-4">
          <label className="block mb-1 text-gray-300">Add Users:</label>
          <select
            multiple
            value={newRoomUsers}
            onChange={(e) =>
              setNewRoomUsers(Array.from(e.target.selectedOptions, (option) => option.value))
            }
            className="w-full p-2 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.email}
              </option>
            ))}
          </select>
        </div>

        {/* Include AI */}
        <div className="mb-4">
          <label className="flex items-center space-x-2 text-gray-300">
            <input
              type="checkbox"
              checked={includeAiInRoom}
              onChange={(e) => setIncludeAiInRoom(e.target.checked)}
              className="form-checkbox text-green-600"
            />
            <span>Include AI</span>
          </label>

          {includeAiInRoom && (
            <select
              value={aiPersonality}
              onChange={(e) => setAiPersonality(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 text-white mt-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {Object.keys(personalities).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => setShowRoomModal(false)}
            className="bg-gray-600 px-4 py-2 rounded hover:bg-gray-500 transition"
          >
            Cancel
          </button>
          <button
            onClick={createRoom}
            className="bg-green-600 px-4 py-2 rounded hover:bg-green-500 transition"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
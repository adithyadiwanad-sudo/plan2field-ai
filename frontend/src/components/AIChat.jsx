import { useState } from "react";
import { C1Component } from "@thesysai/genui-sdk";

export default function AIChat() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  async function sendMessage(e) {
    e.preventDefault();

    if (!message.trim() || loading) return;

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Chat request failed");
      }

      setResponse(data.message);
      setMessage("");
    } catch (error) {
      console.error(error);
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] rounded-2xl border bg-white shadow-2xl">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Plan2Field AI</h2>
        <p className="text-xs text-gray-500">
          Ask about reports, schedules, delays and project progress
        </p>
      </div>

      <div className="max-h-[500px] overflow-y-auto p-4">
        {response ? (
          <C1Component
            c1Response={response}
            isStreaming={false}
          />
        ) : (
          <p className="text-sm text-gray-500">
            Ask me anything about your project.
          </p>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask Plan2Field AI..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
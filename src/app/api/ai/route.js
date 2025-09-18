import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages = [], personality = "", stream = false } = body;

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = {
      role: "system",
      content: personality || "You are a helpful AI assistant.",
    };

    const chatMessages = [
      systemPrompt,
      ...messages
        .filter((m) => m && m.role && m.content)
        .map((m) => ({ role: m.role, content: String(m.content) })),
    ];

    // Streaming mode
    if (stream) {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        temperature: 0.7,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          stream.on("data", (chunk) => {
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          });
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
      });

      return new Response(readableStream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Regular non-stream fallback
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      temperature: 0.7,
    });

    const reply = response.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI route error:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
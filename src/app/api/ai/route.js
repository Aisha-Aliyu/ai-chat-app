import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    // Safely parse JSON body
    const body = await req.json().catch(() => ({}));
    const { messages = [], personality = "" } = body;

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // System personality prompt
    const systemPrompt = {
      role: "system",
      content: personality || "You are a helpful AI assistant.",
    };

    // Ensure only valid roles are passed
    const chatMessages = [
      systemPrompt,
      ...messages
        .filter((m) => m && m.role && m.content)
        .map((m) => ({
          role: m.role,
          content: String(m.content),
        })),
    ];

    // Request to OpenAI
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
      JSON.stringify({
        error: "Internal Server Error",
        details: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
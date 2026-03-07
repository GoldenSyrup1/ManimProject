const form = document.querySelector("#chat-form");
const promptInput = document.querySelector("#prompt");
const sendBtn = document.querySelector("#send-btn");
const messagesEl = document.querySelector("#messages");
const clearBtn = document.querySelector("#clear-btn");

const STORAGE_KEY = "gpt5nano_conversation_v1";

// --- Conversation state (persisted) ---
let conversation = loadConversation();

// Render existing conversation (or show greeting once)
if (conversation.length === 0) {
  addMessage("assistant", "Hi, I am GPT-5 Nano. Ask me anything.");
} else {
  for (const msg of conversation) addMessage(msg.role, msg.content);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = promptInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  conversation.push({ role: "user", content: text });
  saveConversation(conversation);

  promptInput.value = "";
  autoResizeTextarea();
  setLoading(true);

  // Create an assistant bubble we will stream into
  const assistantBubble = addMessage("assistant", "");
  assistantBubble.classList.add("streaming");

  try {
    const fullText = await streamChat(conversation, (delta) => {
      appendToBubble(assistantBubble, delta);
    });

    // Replace bubble with final content (ensures markdown renders cleanly)
    setBubbleContent(assistantBubble, fullText || "No response text returned.");

    conversation.push({ role: "assistant", content: fullText || "" });
    saveConversation(conversation);
  } catch (error) {
    setBubbleContent(assistantBubble, "");
    assistantBubble.remove();
    addMessage("system", `Error: ${error.message}`);
  } finally {
    setLoading(false);
    promptInput.focus();
  }
});

promptInput.addEventListener("input", autoResizeTextarea);

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    conversation = [];
    saveConversation(conversation);
    messagesEl.innerHTML = "";
    addMessage("assistant", "Cleared. Ask me anything.");
  });
}

// --- Streaming fetch (SSE over fetch) ---
async function streamChat(messages, onDelta) {
  const response = await fetch("/api/chat-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok || !response.body) {
    const errorPayload = await safeJson(response);
    throw new Error(errorPayload?.error || `Request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE splits on blank line
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;

      const payload = JSON.parse(line.slice(6));

      if (payload.error) {
        throw new Error(payload.error);
      }

      if (payload.delta) {
        fullText += payload.delta;
        onDelta(payload.delta);
      }

      if (payload.type === "done" && typeof payload.output_text === "string") {
        // Server may also send final text
        fullText = payload.output_text || fullText;
      }
    }
  }

  return fullText.trim();
}

// --- UI helpers ---
function addMessage(role, text) {
  const bubble = document.createElement("article");
  bubble.className = `bubble ${role}`;
  setBubbleContent(bubble, text);
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function appendToBubble(bubble, delta) {
  // Append raw text into a buffer attribute, then render markdown
  const current = bubble.dataset.raw || "";
  const next = current + delta;
  bubble.dataset.raw = next;
  setBubbleContent(bubble, next);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setBubbleContent(bubble, text) {
  bubble.dataset.raw = text;

  // Markdown rendering (requires marked + DOMPurify)
  if (window.marked && window.DOMPurify) {
    const html = window.marked.parse(text, { breaks: true });
    bubble.innerHTML = window.DOMPurify.sanitize(html);
  } else {
    bubble.textContent = text;
  }
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  promptInput.disabled = isLoading;
}

function autoResizeTextarea() {
  promptInput.style.height = "auto";
  promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + "px";
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// --- Persistence ---
function loadConversation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversation(messages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}
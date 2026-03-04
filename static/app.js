const form = document.querySelector("#chat-form");
const promptInput = document.querySelector("#prompt");
const sendBtn = document.querySelector("#send-btn");
const messagesEl = document.querySelector("#messages");

const conversation = [];

addMessage("assistant", "Hi, I am GPT-5 Nano. Ask me anything.");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  conversation.push({ role: "user", content: text });

  promptInput.value = "";
  autoResizeTextarea();
  setLoading(true);
  const typingBubble = addTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation })
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      throw new Error(errorPayload?.error || `Request failed (${response.status})`);
    }

    const data = await response.json();
    const answer = (data?.output_text || "").trim() || "No response text returned.";

    typingBubble.remove();
    addMessage("assistant", answer);
    conversation.push({ role: "assistant", content: answer });
  } catch (error) {
    typingBubble.remove();
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

function addMessage(role, text) {
  const bubble = document.createElement("article");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function addTyping() {
  const bubble = document.createElement("article");
  bubble.className = "bubble assistant";
  bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  promptInput.disabled = isLoading;
}

function autoResizeTextarea() {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

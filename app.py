import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from openai import OpenAI

load_dotenv()

app = Flask(__name__)


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    messages = payload.get("messages")

    if not isinstance(messages, list) or len(messages) == 0:
        return jsonify({"error": "messages must be a non-empty array."}), 400

    input_messages = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = "assistant" if message.get("role") == "assistant" else "user"
        content = message.get("content", "")
        if isinstance(content, str) and content.strip():
            input_messages.append({"role": role, "content": content})

    if len(input_messages) == 0:
        return jsonify({"error": "messages must contain at least one text message."}), 400

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"error": "Server is missing OPENAI_API_KEY."}), 500

    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(model="gpt-5-nano", input=input_messages)
        return jsonify({"output_text": response.output_text or ""})
    except Exception as err:
        return jsonify({"error": str(err)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    app.run(host="127.0.0.1", port=port, debug=True)

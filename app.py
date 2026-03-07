import os
import json
import time
from typing import List, Dict, Any

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, Response

from openai import OpenAI

load_dotenv()

app = Flask(__name__)

def _normalize_messages(payload: Dict[str, Any]) -> List[Dict[str, str]]:
    messages = payload.get("messages")
    if not isinstance(messages, list) or len(messages) == 0:
        raise ValueError("messages must be a non-empty array.")

    input_messages: List[Dict[str, str]] = []

    # Optional: prepend a system message for consistent behavior
    # (Responses API accepts role/content items; this matches your current style.)
    input_messages.append({
        "role": "system",
        "content": "You are GPT-5 Nano, a helpful assistant. Use markdown for code blocks."
    })

    for message in messages:
        if not isinstance(message, dict):
            continue
        role = "assistant" if message.get("role") == "assistant" else "user"
        content = message.get("content", "")
        if isinstance(content, str) and content.strip():
            input_messages.append({"role": role, "content": content})

    if len(input_messages) <= 1:
        raise ValueError("messages must contain at least one text message.")

    return input_messages

def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Server is missing OPENAI_API_KEY.")
    return OpenAI(api_key=api_key)

@app.get("/")
def index():
    return render_template("index.html")

@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    try:
        input_messages = _normalize_messages(payload)
        client = _get_client()

        # Your current non-stream call:
        response = client.responses.create(
            model="gpt-5-nano",
            input=input_messages,
        )
        return jsonify({"output_text": response.output_text or ""})
    except Exception as err:
        return jsonify({"error": str(err)}), 500

@app.post("/api/chat-stream")
def chat_stream():
    payload = request.get_json(silent=True) or {}

    try:
        input_messages = _normalize_messages(payload)
        client = _get_client()
    except Exception as err:
        # SSE error response
        def _err():
            yield f"data: {json.dumps({'error': str(err)})}\n\n"
        return Response(_err(), mimetype="text/event-stream")

    def generate():
        # Tell proxies not to buffer
        yield "retry: 1000\n"
        yield f"data: {json.dumps({'type': 'start'})}\n\n"

        try:
            # Streaming via Responses API
            with client.responses.stream(
                model="gpt-5-nano",
                input=input_messages,
            ) as stream:
                for event in stream:
                    # We only care about text deltas
                    # Different SDK versions expose different event shapes,
                    # so we handle a few common patterns safely.
                    delta = None

                    # Pattern A: event has .type and .delta
                    if hasattr(event, "type") and getattr(event, "type", "") in ("response.output_text.delta", "response.output_text.annotated.delta"):
                        delta = getattr(event, "delta", None)

                    # Pattern B: event is dict-like
                    if delta is None and isinstance(event, dict):
                        if event.get("type") == "response.output_text.delta":
                            delta = event.get("delta")

                    if isinstance(delta, str) and delta:
                        yield f"data: {json.dumps({'delta': delta})}\n\n"

                final = stream.get_final_response()
                yield f"data: {json.dumps({'type': 'done', 'output_text': getattr(final, 'output_text', '') or ''})}\n\n"

        except Exception as err:
            yield f"data: {json.dumps({'error': str(err)})}\n\n"

        # End event stream
        yield "data: " + json.dumps({"type": "end"}) + "\n\n"

    return Response(generate(), mimetype="text/event-stream")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    app.run(host="127.0.0.1", port=port, debug=True, threaded=True)
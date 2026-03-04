# GPT-5 Nano Chat UI (Flask)

Simple local website with a chat interface connected to OpenAI `gpt-5-nano`.

## 1) Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) Configure environment

```bash
cp .env.example .env
```

Then set your key in `.env`:

```env
OPENAI_API_KEY=your_real_key_here
PORT=3000
```

## 3) Run

```bash
python app.py
```

Open `http://localhost:3000`.

## Notes

- API key stays server-side (`app.py`) and is never exposed in browser code.
- Frontend is plain HTML/CSS/JS in `templates/` and `static/`.
- Press `Enter` to send, `Shift+Enter` for a new line.

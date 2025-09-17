## 🚀 Entry Point & Class Initialization
- 🏁 **Starts with `main()`** → creates `FreeAnalyzer` instance  
- 🏗️ **Constructor parameter:** API choice → `'huggingface'`, `'groq'`, or fallback  
- ⚙️ **API Configuration:**
  - 🤗 **HuggingFace:** sets inference endpoints, needs `HUGGINGFACE_API_KEY`
  - ⚡ **Groq:** configures OpenAI-compatible endpoint, needs `GROQ_API_KEY`

- 📑 **System Prompt Loaded:** structured tweet analysis (political alignment, emotions, topics)

---

## 📂 File Processing Pipeline
- 🔄 **`batchProcess()` orchestrates multiple file analysis**
  - 📥 **Input:** CLI args (JSON files) or hardcoded defaults
  - 📁 **Output:** creates timestamped directory
  - 🛡️ **Error Handling:** continues other files if one fails
  - ⏱️ **Rate Limits:** 500ms delay between files

---

## 📄 Individual File Processing
- ⚙️ **`processFile()` workflow**
  - 📖 Reads raw JSON tweet data
  - 🧹 **`preProcess()` stage:**
    - 📦 Parses tweet objects  
    - 🖼️ Media handling: optional alt-text appending  
    - 🔢 Subsetting: limit tweets with `tweet_per_file`  
    - ✂️ Extracts text for analysis  

- 📡 Routes tweets to correct analysis method  
- 💾 Saves results in timestamped output file  

---

## 🔍 Analysis Method Routing

### ⚡ Groq Path → `analyzeWithGroq()`
- 🔌 API: OpenAI-compatible chat completions  
- 🧠 Model: `"openai/gpt-oss-120b"`  
- 🌊 Streaming response enabled  
- 📦 JSON enforced  

- 🔎 **Response Handling:**
  - 📡 **Streaming (SSE):** parsed via `parseStreamingResponse()`  
  - 📜 **Standard JSON:** direct parsing  
  - ❌ **Errors:** return message (no fallback)  

- 🧮 Stream parsing: accumulates text, ignores reasoning chunks  

---

### 🧪 Connection Testing → `testGroqConnection()`
- ✅ Standalone API validation  
- 📝 Logs status, headers, raw responses  
- 🪄 Minimal test prompt for connectivity  

---

## 📝 Result Processing & Formatting
- 🧾 **`formatResults()`**
  - 📌 Per-tweet JSON array with indices  
  - 📊 Batch insights: dominant emotions, topics, ratios  
  - 😄 Humor detection + 🗳️ political content stats  
  - 📤 Output: JSON + bullet-point insights  

---

## ⚠️ Error Handling & Fallbacks


### ⏱️ Rate Limiting
- 🤗 HuggingFace: built-in delays + 10 tweet cap  
- ⚡ Groq: relies on provider-side limits  
- 📂 Batch: 500ms inter-file delay  

---

## ⚙️ Configuration & Environment

### 🔑 Required Environment Variables
- `HUGGINGFACE_API_KEY` → HuggingFace inference  
- `GROQ_API_KEY` → Groq chat completions  

### 📂 File System
- 📥 Input: JSON tweet objects  
- 📤 Output dir auto-created  
- 🕒 Timestamped filenames prevent overwrite  

---


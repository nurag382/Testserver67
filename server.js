import express from 'express';
import Bytez from 'bytez.js';

const app = express();
const PORT = 3000;

const API_KEY = "3a7baeb7da038006d1f8dfc1fd7bae40"; 
const sdk = new Bytez(API_KEY);

const imgModel = sdk.model("ZB-Tech/Text-to-Image");
const chatModel = sdk.model("openai/gpt-4o"); 

// --- HIDDEN LIMITS ---
const IMAGE_LIMIT = 20;
const userUsage = new Map();

app.use(express.json({ limit: '50mb' }));

app.post('/api/message', async (req, res) => {
    const { message } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const lowerMsg = message.toLowerCase();
    
    const artKeywords = ["generate", "draw", "picture", "image", "img", "photo"];
    const codeKeywords = ["code", "html", "css", "js", "script", "program", "write a"];
    const triggerImage = artKeywords.some(k => lowerMsg.includes(k)) && !codeKeywords.some(k => lowerMsg.includes(k));

    try {
        if (triggerImage) {
            const currentCount = userUsage.get(ip) || 0;
            if (currentCount >= IMAGE_LIMIT) return res.json({ type: 'text', content: "Art Engine capacity reached." });
            const { output } = await imgModel.run(message);
            let url = Array.isArray(output) ? output[0] : output;
            if (url && !url.startsWith('http')) url = "data:image/jpeg;base64," + url;
            userUsage.set(ip, currentCount + 1);
            return res.json({ type: 'image', content: url });
        } else {
            const { output } = await chatModel.run(`Expert Assistant. Date: ${new Date().toDateString()}. Use markdown. User: ${message}`);
            let text = typeof output === 'object' ? (output.choices?.[0]?.message?.content || JSON.stringify(output)) : String(output);
            text = text.replace(/^{"role":"assistant","content":"/, "").replace(/"}$/, "").replace(/\\n/g, '\n').replace(/\\"/g, '"');
            return res.json({ type: 'text', content: text });
        }
    } catch (err) { res.status(500).json({ type: 'error', content: "System Error." }); }
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <title>Shreeji AI</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&family=Fira+Code&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Poppins', sans-serif; background: #000; color: #fff; height: 100dvh; display: flex; flex-direction: column; margin: 0; overflow: hidden; }
            
            /* Center Infinity Loader */
            #loader-screen { position: fixed; inset: 0; background: #000; z-index: 9999; display: flex; flex-direction: column; items: center; justify-content: center; }
            .infinity-path { width: 80px; height: 40px; border: 4px solid #a855f7; border-radius: 50px 50px 0 50px; transform: rotate(-45deg); animation: pulse 1.5s infinite; }
            .infinity-path::after { content: ""; position: absolute; width: 80px; height: 40px; border: 4px solid #a855f7; border-radius: 50px 50px 50px 0; transform: rotate(90deg); left: 36px; top: -36px; }
            @keyframes pulse { 0% { opacity: 0.3; transform: rotate(-45deg) scale(0.9); } 50% { opacity: 1; filter: drop-shadow(0 0 15px #a855f7); transform: rotate(-45deg) scale(1); } 100% { opacity: 0.3; transform: rotate(-45deg) scale(0.9); } }

            header { flex: 0 0 auto; padding: 20px; border-bottom: 1px solid #111; display: flex; justify-content: space-between; align-items: center; }
            #chatArea { flex: 1; overflow-y: auto; padding: 20px; scrollbar-width: none; }
            #chatArea::-webkit-scrollbar { display: none; }

            /* History Sidebar */
            #sideBar { position: fixed; left: -100%; top: 0; width: 85%; max-width: 320px; height: 100%; background: #080808; z-index: 1000; transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); border-right: 1px solid #222; padding: 25px; }
            #sideBar.open { left: 0; }
            .date-group { font-size: 10px; color: #a855f7; font-weight: bold; margin: 25px 0 10px; border-bottom: 1px solid #111; padding-bottom: 5px; text-transform: uppercase; }
            .h-item { padding: 12px; background: #111; border-radius: 14px; margin-bottom: 8px; font-size: 13px; cursor: pointer; border: 1px solid #1a1a1a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

            /* Bubbles & Animation */
            .msg-row { margin-bottom: 28px; clear: both; width: 100%; animation: slideIn 0.3s ease; }
            @keyframes slideIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            .user-bubble { background: #111; padding: 12px 18px; border-radius: 20px; max-width: 85%; float: right; border: 1px solid #222; font-size: 14px; }
            .ai-label { font-size: 9px; font-weight: 700; color: #a855f7; margin-bottom: 6px; letter-spacing: 1px; }
            .ai-content { font-size: 15px; color: #fff !important; line-height: 1.6; }
            
            /* Streaming Cursor */
            .cursor { display: inline-block; width: 8px; height: 15px; background: #a855f7; margin-left: 2px; vertical-align: middle; animation: blink 0.8s infinite; }
            @keyframes blink { 50% { opacity: 0; } }

            .code-wrap { background: #050505; border: 1px solid #222; border-radius: 12px; margin: 15px 0; overflow: hidden; }
            .code-head { background: #111; padding: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #666; }
            .code-body { padding: 15px; overflow-x: auto; color: #00ffaa; font-family: 'Fira Code'; font-size: 13px; }

            .input-zone { padding: 15px; background: #000; border-top: 1px solid #111; padding-bottom: env(safe-area-inset-bottom, 15px); }
            .input-wrap { max-width: 600px; margin: auto; display: flex; background: #111; border-radius: 25px; padding: 5px 15px; align-items: center; border: 1px solid #222; }
            input { flex: 1; background: transparent; border: none; color: #fff; padding: 10px; outline: none; font-size: 15px; }
            
            .sig { font-size: 9px; color: #444; font-weight: 600; text-transform: uppercase; }
        </style>
    </head>
    <body>
        <div id="loader-screen">
            <div class="infinity-path"></div>
            <p class="mt-10 text-[10px] tracking-[0.5em] font-bold text-purple-500">NEURAL LINKING</p>
        </div>

        <header>
            <button onclick="toggleSide()"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7"/></svg></button>
            <div class="text-center"><div class="font-bold">Shreeji <span class="text-purple-500">AI</span></div><div class="sig">Anurag x AI</div></div>
            <button onclick="location.reload()"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </header>

        <div id="sideBar">
            <h2 class="text-xl font-bold mb-4">Past History</h2>
            <div id="hList"></div>
            <button onclick="toggleSide()" class="w-full mt-10 bg-white text-black py-4 rounded-2xl font-bold text-xs uppercase">Close</button>
        </div>

        <main id="chatArea"></main>

        <div class="input-zone">
            <div class="input-wrap">
                <input id="uIn" placeholder="Chat or create art..." autocomplete="off">
                <button onclick="fire()" class="bg-white text-black p-2 rounded-full"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg></button>
            </div>
        </div>

        <script>
            let history = JSON.parse(localStorage.getItem('sj_v10_history') || '[]');

            window.onload = () => {
                setTimeout(() => {
                    const loader = document.getElementById('loader-screen');
                    loader.style.opacity = '0';
                    setTimeout(() => loader.style.display = 'none', 500);
                }, 2500);
            };

            function toggleSide() {
                const side = document.getElementById('sideBar');
                side.classList.toggle('open');
                if(side.classList.contains('open')) renderHistory();
            }

            function renderHistory() {
                const list = document.getElementById('hList');
                list.innerHTML = '';
                const groups = { Today: [], Yesterday: [], Older: [] };
                const now = new Date().getTime();

                history.forEach(h => {
                    const diff = (now - h.time) / (1000 * 60 * 60 * 24);
                    if (diff < 1) groups.Today.push(h);
                    else if (diff < 2) groups.Yesterday.push(h);
                    else groups.Older.push(h);
                });

                for (let key in groups) {
                    if (groups[key].length) {
                        list.innerHTML += \`<div class="date-group">\${key}</div>\`;
                        groups[key].forEach((h, i) => {
                            const item = document.createElement('div');
                            item.className = 'h-item';
                            item.innerText = h.q;
                            item.onclick = () => {
                                document.getElementById('chatArea').innerHTML = '';
                                toggleSide();
                                addBubble('user', h.q);
                                renderAI(h.type, h.a);
                            };
                            list.appendChild(item);
                        });
                    }
                }
            }

            function addBubble(type, content) {
                const area = document.getElementById('chatArea');
                if(type === 'user') {
                    area.innerHTML += \`<div class="msg-row"><div class="user-bubble">\${content}</div></div>\`;
                } else {
                    const id = 'ai-' + Date.now();
                    area.innerHTML += \`<div id="\${id}" class="msg-row"><div class="ai-label">\${type}</div><div class="ai-content"></div></div>\`;
                    return document.getElementById(id).querySelector('.ai-content');
                }
                area.scrollTop = area.scrollHeight;
            }

            async function streamText(el, text) {
                const cursor = document.createElement('span');
                cursor.className = 'cursor';
                el.appendChild(cursor);
                for(let i=0; i < text.length; i++) {
                    cursor.before(text.charAt(i));
                    document.getElementById('chatArea').scrollTop = document.getElementById('chatArea').scrollHeight;
                    await new Promise(r => setTimeout(r, 6));
                }
                cursor.remove();
            }

            function escape(str) {
                return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
            }

            async function renderAI(type, content, target = null) {
                const el = target || addBubble(type === 'image' ? 'Art Engine' : 'Assistant', '');
                if(type === 'image') {
                    el.innerHTML = \`<img src="\${content}" class="w-full rounded-2xl border border-[#222] mt-2 shadow-2xl" onclick="window.open('\${content}')">\`;
                } else {
                    const parts = content.split('\`\`\`');
                    for(let i=0; i<parts.length; i++) {
                        if(i % 2 === 1) {
                            const code = parts[i].trim();
                            el.innerHTML += \`<div class="code-wrap"><div class="code-head"><span>SOURCE</span><span class="text-purple-400 font-bold" onclick="dl(this)">DOWNLOAD</span><span class="hidden">\${code}</span></div><div class="code-body">\${escape(code)}</div></div>\`;
                        } else {
                            const span = document.createElement('span');
                            el.appendChild(span);
                            await streamText(span, parts[i]);
                        }
                    }
                }
            }

            function dl(btn) {
                const blob = new Blob([btn.nextElementSibling.innerText], {type: 'text/plain'});
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = 'code.txt'; a.click();
            }

            async function fire() {
                const input = document.getElementById('uIn');
                const val = input.value.trim(); if(!val) return; input.value = '';
                addBubble('user', val);
                const loading = addBubble('Thinking', '•••');
                try {
                    const res = await fetch('/api/message', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ message: val })
                    });
                    const data = await res.json();
                    loading.parentElement.remove();
                    await renderAI(data.type, data.content);
                    history.unshift({ q: val, a: data.content, type: data.type, time: new Date().getTime() });
                    localStorage.setItem('sj_v10_history', JSON.stringify(history.slice(0, 20)));
                } catch(e) { loading.innerText = "Error."; }
            }
            document.getElementById('uIn').onkeypress = (e) => { if(e.key === 'Enter') fire(); };
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => { console.log("🚀 Platinum V10 Live"); });

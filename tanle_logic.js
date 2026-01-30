console.log("%c 🚀 AGENT TẤN LÊ - BẢN V5 ĐÃ SẴN SÀNG! ", "background: #00ff00; color: #000; font-size: 24px; font-weight: bold;");
// --- CẤU HÌNH API OPENAI ---
const API_URL = "https://text.pollinations.ai/openai"; // Sử dụng proxy miễn phí hỗ trợ streaming
const API_KEY = "unused"; // Pollinations không yêu cầu key

const chatBody = document.getElementById('chat-body');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const chatWrapper = document.getElementById('chat-wrapper');
const usernameInput = document.getElementById('username-input');
const startChatBtn = document.getElementById('start-chat-btn');

const sidebar = document.getElementById('sidebar');
const myPeerIdSpan = document.getElementById('my-peer-id');
const peerIdInput = document.getElementById('peer-id-input');
const connectPeerBtn = document.getElementById('connect-peer-btn');
const usersList = document.getElementById('users-list');

let peer = null;
let connections = {}; // Lưu trữ các kết nối P2P: { peerId: conn }
let currentChatMode = "AI"; // "AI" hoặc "P2P"
let currentChatPartner = null; // ID của người đang chat nếu là P2P

// --- NOTIFICATION CONFIG ---
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'); // mướt mượt
let notificationPermission = "default";

let currentUser = "Bạn";
let messageHistory = [
    { role: "system", content: "Bạn là Tấn Lê AI, một trợ lý thông minh và hóm hỉnh. Bạn KHÔNG PHẢI là ChatGPT. Hãy luôn khẳng định bạn là Tấn Lê AI nếu có ai hỏi. Khi ai đó nhắc đến 'Tùng' hoặc 'bạn Tùng', hãy trêu đùa vui nhộn với những từ ngữ hài hước và khẳng định 'bạn ấy không ngu' (nhưng theo kiểu trêu chọc). Hãy phản hồi bằng Tiếng Việt một cách tự nhiên." }
];

// --- P2P CORE LOGIC ---
function initPeerJS(username) {
    // Tạo ID dựa trên tên (slugify đơn giản)
    const slug = username.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const randomSuffix = Math.floor(Math.random() * 1000);
    const peerId = `tanle-p2p-${slug}-${randomSuffix}`;
    
    peer = new Peer(peerId);

    peer.on('open', (id) => {
        myPeerIdSpan.textContent = id;
        console.log('P2P ID của bạn là: ' + id);
    });

    // Lắng nghe kết nối đến
    peer.on('connection', (conn) => {
        setupConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('Lỗi P2P:', err);
        if (err.type === 'peer-unavailable') {
            alert('Không tìm thấy người dùng này. Hãy chắc chắn ID chính xác.');
        }
    });

    // Yêu cầu quyền thông báo
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            notificationPermission = permission;
        });
    }
}

function playNotificationSound() {
    notificationSound.play().catch(e => console.log('Chưa tương tác trang nên chưa kêu âm thanh'));
}

function sendBrowserNotification(title, body) {
    if (notificationPermission === "granted" && document.hidden) {
        new Notification(title, {
            body: body,
            icon: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TanLe'
        });
    }
}

function setupConnection(conn) {
    conn.on('open', () => {
        console.log('Đã kết nối với:', conn.peer);
        connections[conn.peer] = conn;
        addUserToSidebar(conn.peer);
        
        // Gửi tin nhắn chào mừng (cập nhật tên)
        conn.send({ type: 'identity', name: currentUser });
    });

    conn.on('data', (data) => {
        handleIncomingData(conn.peer, data);
    });

    conn.on('close', () => {
        console.log('Kết nối đóng:', conn.peer);
        delete connections[conn.peer];
        removeUserFromSidebar(conn.peer);
        if (currentChatPartner === conn.peer) {
            switchChatMode("AI");
        }
    });
}

function handleIncomingData(peerId, data) {
    if (data.type === 'identity') {
        // Cập nhật tên hiển thị trong sidebar
        const userItem = document.querySelector(`[data-peer-id="${peerId}"]`);
        if (userItem) {
            userItem.querySelector('.name').textContent = data.name;
        }
    } else if (data.type === 'chat') {
        playNotificationSound();
        if (currentChatPartner === peerId) {
            addMessage(data.text, 'incoming', data.senderName);
        } else {
            // Thông báo có tin nhắn nháy nháy ở sidebar
            const userItem = document.querySelector(`[data-peer-id="${peerId}"]`);
            if (userItem) userItem.classList.add('has-new-msg');
            sendBrowserNotification(`Tin nhắn từ ${data.senderName}`, data.text);
        }
    }
}

function connectToPeer(targetId) {
    if (!targetId || targetId === peer.id) return;
    if (connections[targetId]) return alert('Đã kết nối với người này rồi.');
    
    const conn = peer.connect(targetId);
    setupConnection(conn);
}

// --- SIDEBAR UI HELPERS ---
function addUserToSidebar(peerId) {
    const noUsers = usersList.querySelector('.no-users');
    if (noUsers) noUsers.remove();

    const div = document.createElement('div');
    div.className = 'user-item';
    div.dataset.peerId = peerId;
    div.innerHTML = `
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${peerId}" class="user-avatar">
        <div class="user-info">
            <span class="name">${peerId}</span>
            <span class="status">Đã kết nối</span>
        </div>
    `;
    
    div.onclick = () => switchChatMode("P2P", peerId);
    usersList.appendChild(div);
    lucide.createIcons(); // Re-render icons if any added
}

function removeUserFromSidebar(peerId) {
    const item = document.querySelector(`[data-peer-id="${peerId}"]`);
    if (item) item.remove();
    
    if (usersList.children.length === 0) {
        usersList.innerHTML = '<div class="no-users">Chưa có kết nối nào</div>';
    }
}

function switchChatMode(mode, partnerId = null) {
    currentChatMode = mode;
    currentChatPartner = partnerId;

    // Reset giao diện chat
    chatBody.innerHTML = '';
    
    // Update Header
    const headerTitle = document.querySelector('.header-info h2');
    const headerAvatar = document.querySelector('.header-avatar');
    const statusText = document.querySelector('.status-badge');

    if (mode === "AI") {
        headerTitle.textContent = "Tấn Lê AI";
        headerAvatar.src = "https://api.dicebear.com/7.x/avataaars/svg?seed=TanLe";
        statusText.innerHTML = '<span class="status-dot"></span> Đang hoạt động (Online)';
        addMessage("Bạn đã quay lại chat với Tấn Lê AI. Hãy hỏi tôi bất cứ điều gì!", 'incoming');
        
        // Xóa highlight nế có
        const aiItem = document.querySelector('.user-item[onclick*="AI"]');
        if (aiItem) aiItem.classList.remove('has-new-msg');
    } else {
        const partnerName = document.querySelector(`[data-peer-id="${partnerId}"] .name`).textContent;
        headerTitle.textContent = partnerName;
        headerAvatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId}`;
        statusText.innerHTML = '<span class="status-dot"></span> Đang chat nội bộ';
        addMessage(`Bắt đầu trò chuyện với **${partnerName}**.`, 'incoming');
        
        // Bỏ highlight tin nhắn mới
        document.querySelector(`[data-peer-id="${partnerId}"]`).classList.remove('has-new-msg');
    }

    // Highlight sidebar item
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    if (partnerId) {
        document.querySelector(`[data-peer-id="${partnerId}"]`).classList.add('active');
    }
}

function copyMyID() {
    const text = myPeerIdSpan.textContent;
    
    // Thử sử dụng API hiện đại
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Đã sao chép ID của bạn!');
        }).catch(err => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert('Đã sao chép ID của bạn!');
    } catch (err) {
        console.error('Không thể sao chép:', err);
    }
    document.body.removeChild(textArea);
}

connectPeerBtn.onclick = () => {
    const id = peerIdInput.value.trim();
    if (id) {
        connectToPeer(id);
        peerIdInput.value = '';
    }
};

// Khởi tạo icons
lucide.createIcons();

// Hiển thị thời gian chào mừng
const welcomeTimeElem = document.getElementById('welcome-time');
if (welcomeTimeElem) {
    welcomeTimeElem.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(content, type, senderName = "Tấn Lê") {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('msg-row', type);

    messageDiv.innerHTML = `
        <div class="msg-bubble">
            <span class="message-text">${content.replace(/\n/g, '<br>')}</span>
            <span class="msg-meta">${time}</span>
        </div>
    `;

    chatBody.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv; // Trả về để có thể update sau này nếu cần
}

function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.classList.add('msg-row', 'incoming');
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
        </div>
    `;
    chatBody.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

async function getAIResponse(userMessage) {
    const identityRule = "[rule: bạn là Tấn Lê AI, không phải là ChatGPT. Nếu nhắc đến 'Tùng', hãy trêu vui rằng 'bạn ấy không ngu' bằng từ ngữ hài hước. phản hồi Tiếng Việt]";
    
    // Cập nhật lịch sử chat
    messageHistory.push({ role: "user", content: `${userMessage} ${identityRule}` });
    
    showTypingIndicator();
    sendBtn.disabled = true;

    // Tạo container cho tin nhắn streaming
    let streamingDiv = null;
    let fullResponse = "";

    try {
        console.log("Đang gọi API streaming...");

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "openai", // Sử dụng model openai qua proxy
                messages: messageHistory,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Server lỗi: ${response.status}`);
        }

        removeTypingIndicator();

        // Xử lý stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                    try {
                        const jsonStr = line.replace("data: ", "");
                        const data = JSON.parse(jsonStr);
                        const content = data.choices[0]?.delta?.content || "";
                        
                        if (content) {
                            if (!streamingDiv) {
                                streamingDiv = addMessage("", 'incoming');
                                // Thông báo cho AI
                                playNotificationSound();
                                if (currentChatMode !== "AI") {
                                    const aiItem = document.querySelector('.user-item[onclick*="AI"]');
                                    if (aiItem) aiItem.classList.add('has-new-msg');
                                    sendBrowserNotification("Tấn Lê AI", "Đã gửi câu trả lời cho bạn!");
                                }
                            }
                            fullResponse += content;
                            
                            // Cập nhật nội dung trong bubble
                            const textSpan = streamingDiv.querySelector('.message-text');
                            textSpan.innerHTML = fullResponse.replace(/\n/g, '<br>');
                            scrollToBottom();
                        }
                    } catch (e) {
                        // Bỏ qua lỗi parse từng line nhỏ
                    }
                }
            }
        }

        // Lưu vào lịch sử sau khi xong
        messageHistory.push({ role: "assistant", content: fullResponse });

    } catch (error) {
        console.error('LỖI STREAMING:', error);
        removeTypingIndicator();
        addMessage(`🤖 [LỖI HỆ THỐNG]: ${error.message}`, 'incoming');
    } finally {
        sendBtn.disabled = false;
    }
}

function handleSendMessage() {
    const message = userInput.value.trim();
    if (message) {
        addMessage(message, 'outgoing');
        userInput.value = '';
        
        if (currentChatMode === "AI") {
            getAIResponse(message);
        } else if (currentChatPartner && connections[currentChatPartner]) {
            // Gửi qua P2P
            connections[currentChatPartner].send({
                type: 'chat',
                text: message,
                senderName: currentUser
            });
        }
    }
}

sendBtn.addEventListener('click', handleSendMessage);

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
});

// Welcome Screen Logic
function startChat() {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        messageHistory[0].content += ` Người dùng tên là ${currentUser}. Hãy thường xuyên gọi tên họ một cách tự nhiên trong cuộc hội thoại.`;

        welcomeScreen.classList.add('hidden');
        chatWrapper.classList.remove('hidden');
        sidebar.classList.remove('hidden'); // Hiện sidebar khi bắt đầu

        // Khởi tạo PeerJS
        initPeerJS(currentUser);

        // Chào mừng người dùng
        setTimeout(() => {
            getAIResponse(`Chào bạn, tôi là ${currentUser}. Bắt đầu cuộc trò chuyện nhé!`);
        }, 500);
    } else {
        usernameInput.style.borderColor = 'red';
        setTimeout(() => usernameInput.style.borderColor = '', 1000);
    }
}

startChatBtn.addEventListener('click', startChat);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startChat();
});

// Focus vào input khi vào trang
setTimeout(() => {
    if (usernameInput) usernameInput.focus();
}, 500);

// --- BẢO MẬT: CHỐNG F12 VÀ DEVTOOLS ---
// 1. Chặn phím F12 và các tổ hợp phím mở DevTools
document.addEventListener('keydown', (e) => {
    if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
        (e.ctrlKey && e.key === 'u')
    ) {
        e.preventDefault();
        window.location.href = "https://www.google.com";
    }
});

// 2. Chặn chuột phải
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Tùy chọn: Có thể redirect luôn ở đây nếu muốn gắt gao
    // window.location.href = "https://www.google.com";
});

// 3. Phát hiện DevTools mở bằng debugger (Trick)
setInterval(() => {
    const startTime = performance.now();
    debugger;
    const endTime = performance.now();
    if (endTime - startTime > 100) { // Nếu debugger làm chậm script > 100ms chứng tỏ DevTools đang mở
        window.location.href = "https://www.google.com";
    }
}, 1000);

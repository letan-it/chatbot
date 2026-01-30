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

let currentUser = "Bạn";
let messageHistory = [
    { role: "system", content: "Bạn là Tấn Lê AI, một trợ lý thông minh và hóm hỉnh. Bạn KHÔNG PHẢI là ChatGPT. Hãy luôn khẳng định bạn là Tấn Lê AI nếu có ai hỏi. Khi ai đó nhắc đến 'Tùng' hoặc 'bạn Tùng', hãy trêu đùa vui nhộn với những từ ngữ hài hước và khẳng định 'bạn ấy không ngu' (nhưng theo kiểu trêu chọc). Hãy phản hồi bằng Tiếng Việt một cách tự nhiên." }
];

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
        getAIResponse(message);
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

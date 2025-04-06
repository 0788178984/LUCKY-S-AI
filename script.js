const API_KEY = "AIzaSyAAJ06nHdpAc3DdCoHXCrJ8_5izL8jO4bc"; // Replace with your API key
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');

// Load showdown for markdown support
const converter = typeof showdown !== 'undefined' ? new showdown.Converter({
    simplifiedAutoLink: true,
    strikethrough: true,
    tables: true,
    tasklists: true,
    emoji: true
}) : null;

function formatMessage(message) {
    // Handle code blocks
    message = message.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Handle inline code
    message = message.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Simple URL detection
    message = message.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Process markdown if showdown is available
    if (converter) {
        return converter.makeHtml(message);
    }
    
    // Convert line breaks to <br> tags
    return message.replace(/\n/g, '<br>');
}

function addMessage(message, isUser = false, timestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    // Special handling for welcome message
    if (!isUser && message.includes("Hello! I'm Lucky's AI assistant")) {
        messageDiv.className += ' welcome-message';
        messageDiv.textContent = message;
    } else {
        // Format the message and set as HTML
        const formattedMessage = isUser ? message : formatMessage(message);
        
        // Create message content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (isUser) {
            contentDiv.textContent = formattedMessage;
        } else {
            contentDiv.innerHTML = formattedMessage;
        }
        
        messageDiv.appendChild(contentDiv);
    }
    
    if (timestamp) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'timestamp';
        timeSpan.textContent = timestamp;
        messageDiv.appendChild(timeSpan);
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add animation class
    setTimeout(() => {
        messageDiv.classList.add('visible');
    }, 10);
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return indicator;
}

async function callGeminiAPI(prompt) {
    const identityKeywords = [
        "who made you", "who created you", "who developed you",
        "what are you", "who are you", "what model are you",
        "what's your name", "what is your name", "when was you created"
    ];
    
    if (identityKeywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
        return "I'm Lucky's AI assistant. I was created by Lucky to help you!";
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': API_KEY
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
            }
        })
    });

    if (response.ok) {
        const result = await response.json();
        let responseText = result.candidates[0].content.parts[0].text;
        return responseText
            .replace(/Gemini/g, "Lucky")
            .replace(/gemini/g, "Lucky")
            .replace(/Google/g, "Lucky")
            .replace(/google/g, "Lucky");
    } else {
        throw new Error(`API Error: ${response.status} - ${await response.text()}`);
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;

    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    
    addMessage(message, true, timestamp);
    const typingIndicator = showTypingIndicator();

    try {
        // Add a small delay to show typing indicator (min 1 second)
        const startTime = Date.now();
        const response = await callGeminiAPI(message);
        const elapsedTime = Date.now() - startTime;
        
        if (elapsedTime < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - elapsedTime));
        }
        
        typingIndicator.remove();
        addMessage(response, false, timestamp);
    } catch (error) {
        typingIndicator.remove();
        addMessage(`Error: ${error.message}`, false, timestamp);
    } finally {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}

// Add input event listener to enable/disable send button based on input
messageInput.addEventListener('input', () => {
    sendButton.disabled = messageInput.value.trim() === '';
});

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

messageInput.focus();

// Add initial welcome message
window.addEventListener('load', () => {
    addMessage("Hello! I'm Lucky's AI assistant. How can I help you today?", false, 
        new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        })
    );
});
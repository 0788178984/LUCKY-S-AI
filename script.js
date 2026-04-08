const DEFAULT_API_KEY = "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";
const API_KEY = localStorage.getItem("OPENROUTER_API_KEY") || DEFAULT_API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_NAME = "openai/gpt-4o-mini";

const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const installAppButton = document.getElementById('install-app-button');
const RATE_LIMIT_DOCS_URL = "https://openrouter.ai/docs/limits";
const USAGE_DASHBOARD_URL = "https://openrouter.ai/settings/credits";
let deferredInstallPrompt = null;

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

function extractRetryDelaySeconds(errorPayload, retryAfterHeader) {
    if (retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))) {
        return Number(retryAfterHeader);
    }

    const retryDelay = errorPayload?.error?.details?.find(
        detail => detail?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
    )?.retryDelay;

    if (typeof retryDelay === "string" && retryDelay.endsWith("s")) {
        const seconds = Number(retryDelay.slice(0, -1));
        if (!Number.isNaN(seconds)) {
            return Math.ceil(seconds);
        }
    }

    return null;
}

function buildFriendlyApiError(status, payload, retryAfterHeader) {
    if (status === 429) {
        const retrySeconds = extractRetryDelaySeconds(payload, retryAfterHeader);
        const retryText = retrySeconds
            ? `Try again in about ${retrySeconds} seconds.`
            : "Please wait a bit and try again.";

        return [
            "Rate or credit limit reached for this API key/project.",
            retryText,
            `Check limits: ${RATE_LIMIT_DOCS_URL}`,
            `Usage dashboard: ${USAGE_DASHBOARD_URL}`,
            "If balance is 0, top up credits or use a different key."
        ].join(" ");
    }

    if (status === 401 || status === 403) {
        const providerMessage = payload?.error?.message;
        return providerMessage
            ? `Authentication failed: ${providerMessage}`
            : "API key is invalid, revoked, or lacks permission. Verify the key and model access.";
    }

    const apiMessage = payload?.error?.message;
    return apiMessage
        ? `API Error (${status}): ${apiMessage}`
        : `API Error (${status}). Please try again.`;
}

function isIOSDevice() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {
                // Intentionally silent: app still works without offline support.
            });
        });
    }
}

function setupInstallPrompt() {
    if (!installAppButton) return;

    if (isInStandaloneMode()) {
        installAppButton.hidden = true;
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installAppButton.hidden = false;
    });

    installAppButton.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            installAppButton.hidden = true;
            return;
        }

        if (isIOSDevice()) {
            addMessage("To install on iPhone/iPad: tap Share, then choose 'Add to Home Screen'.", false);
        }
    });

    window.addEventListener('appinstalled', () => {
        installAppButton.hidden = true;
    });

    if (isIOSDevice()) {
        installAppButton.hidden = false;
    }
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

    if (!API_KEY) {
        throw new Error("No API key set. Run localStorage.setItem('OPENROUTER_API_KEY', 'sk-or-v1-...') and reload.");
    }

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': window.location.origin || "https://localhost",
            'X-Title': 'Asmart AI'
        },
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1024
        })
    });

    const rawText = await response.text();
    let parsedBody = null;
    try {
        parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
        parsedBody = null;
    }

    if (response.ok) {
        const result = parsedBody;
        let responseText = result?.choices?.[0]?.message?.content || "";
        if (!responseText) {
            throw new Error("Empty response from model. Try a different prompt or model.");
        }
        return responseText
            .replace(/Gemini/g, "Lucky")
            .replace(/gemini/g, "Lucky")
            .replace(/Google/g, "Lucky")
            .replace(/google/g, "Lucky");
    } else {
        const friendlyMessage = buildFriendlyApiError(
            response.status,
            parsedBody,
            response.headers.get("retry-after")
        );
        throw new Error(friendlyMessage);
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';
    messageInput.disabled = true;
    sendButton.disabled = true;

    // Format timestamp to be more compact
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }).replace(/\s/g, '').toLowerCase(); // Makes "12:30 PM" into "12:30pm"
    
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
registerServiceWorker();
setupInstallPrompt();

// Add initial welcome message
window.addEventListener('load', () => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    }).replace(/\s/g, '').toLowerCase(); // Makes "12:30 PM" into "12:30pm"
    
    addMessage("Hello! I'm Lucky's AI assistant. How can I help you today?", false, timestamp);
});
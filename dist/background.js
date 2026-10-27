chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "GET_COOKIES") {
        // Fallback to YouTube if no domain is specified
        const targetDomain = message.domain || ".youtube.com"; 
        
        chrome.cookies.getAll({ domain: targetDomain }, (cookieArray) => {
            const cookieString = cookieArray.map(c => `${c.name}=${c.value}`).join('; ');
            sendResponse({ cookieString: cookieString });
        });
        return true; 
    }
});
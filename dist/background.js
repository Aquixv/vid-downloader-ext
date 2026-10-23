chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "GET_COOKIES") {
        // Extract live residential cookies for YouTube
        chrome.cookies.getAll({ domain: ".youtube.com" }, (cookieArray) => {
            const cookieString = cookieArray.map(c => `${c.name}=${c.value}`).join('; ');
            sendResponse({ cookieString: cookieString });
        });
        return true; // Keep the message channel open for the async response
    }
});
// At the very top of your content.js file:
chrome.storage.local.get(['sitePreferences'], (result) => {
    const prefs = result.sitePreferences || { youtube: true, tiktok: true, reddit: true };
    
    const currentUrl = window.location.href;
    
    let shouldInject = false;
    if (currentUrl.includes('youtube.com') && prefs.youtube) shouldInject = true;
    if (currentUrl.includes('tiktok.com') && prefs.tiktok) shouldInject = true;
    if (currentUrl.includes('reddit.com') && prefs.reddit) shouldInject = true;

    if (shouldInject) {
        injectFloatingButton(); 
    }
});

function injectFloatingButton() {
    const triggerBtn = document.createElement('button');
triggerBtn.innerHTML = `<svg width="30px" height="30px" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 16L7 11H10V4H14V11H17L12 16Z"/><path d="M4 18H20V20H4V18Z"/></svg>`;
triggerBtn.id = 'plug-and-play-trigger';
document.body.appendChild(triggerBtn);

let isBtnDragging = false, btnStartX, btnStartY, btnInitialX, btnInitialY, hasMoved = false;

triggerBtn.addEventListener('mousedown', (e) => {
    isBtnDragging = true;
    hasMoved = false;
    btnStartX = e.clientX; btnStartY = e.clientY;
    const rect = triggerBtn.getBoundingClientRect();
    btnInitialX = rect.left; btnInitialY = rect.top;
});

document.addEventListener('mousemove', (e) => {
    if (!isBtnDragging) return;
    const dx = e.clientX - btnStartX; const dy = e.clientY - btnStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
        triggerBtn.style.bottom = 'auto'; triggerBtn.style.right = 'auto';
        triggerBtn.style.left = `${btnInitialX + dx}px`;
        triggerBtn.style.top = `${btnInitialY + dy}px`;
    }
});

document.addEventListener('mouseup', () => isBtnDragging = false);

triggerBtn.addEventListener('click', () => {
    if (hasMoved) return; 
    
    // Note: If you want this to work on TikTok/Reddit too, you might want to adjust this '/watch' check later
const path = window.location.pathname;
    if (!path.includes('/watch') && !path.includes('/shorts') && !path.includes('/post')) {
        alert("Please navigate to a valid YouTube video, Short, or Community Post first.");
        return;
    }
    const originalIcon = triggerBtn.innerHTML;
    triggerBtn.innerHTML = '⏳'; 

    const videoUrl = window.location.href;
    const videoTitle = document.title.replace(' - YouTube', '').replace(/[^\w\s-]/g, '').trim();

    // The message fetch block stays INSIDE the click listener
    chrome.runtime.sendMessage({ action: "GET_COOKIES" }, async (response) => {
        if (!response || !response.cookieString) {
            console.error("Failed to intercept cookies.");
            triggerBtn.innerHTML = '❌';
            setTimeout(() => triggerBtn.innerHTML = originalIcon, 2000);
            return;
        }

        try {
            const res = await fetch('https://video-downloader-jjay.onrender.com/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: videoUrl,
                    cookieHeader: response.cookieString 
                }) 
            });

            if (!res.ok) throw new Error(`Backend rejected request: ${res.status}`);

            // 1. Check what kind of data the backend actually sent back
            const contentType = res.headers.get("content-type");

            if (contentType && contentType.includes("application/json")) {
                // 2. It's a YouTube Community Post or Image Gallery
                const data = await res.json();
                
                if (data.type === 'gallery' && data.images) {
                    console.log(`[Content Script] Found ${data.images.length} images. Downloading...`);
                    
                    data.images.forEach((base64Data, index) => {
                        const a = document.createElement('a');
                        a.href = base64Data;
                        // Use the post title and an index for clean file names
                        a.download = `${videoTitle}_image_${index + 1}.jpg`; 
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    });
                    triggerBtn.innerHTML = '✅';
                } else {
                    throw new Error("Invalid gallery data returned.");
                }
                
            } else {
                // 3. It's a standard Video Blob (the original flow)
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `${videoTitle}.mp4`;
                document.body.appendChild(a);
                a.click();
                
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);

                triggerBtn.innerHTML = '✅';
            }
            
        } catch (err) {
            console.error("[Content Script] Download failed:", err);
            triggerBtn.innerHTML = '❌';
        }

        setTimeout(() => triggerBtn.innerHTML = originalIcon, 2000);
    });
});
};
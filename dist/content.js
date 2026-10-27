chrome.storage.local.get(['sitePreferences'], (result) => {
    const prefs = result.sitePreferences || { youtube: true, tiktok: true, reddit: true, twitter: true, instagram: true};
    const currentUrl = window.location.href;
    
    let shouldInject = false;
    if (currentUrl.includes('youtube.com') && prefs.youtube) shouldInject = true;
    if (currentUrl.includes('tiktok.com') && prefs.tiktok) shouldInject = true;
    if (currentUrl.includes('reddit.com') && prefs.reddit) shouldInject = true;
    if (currentUrl.includes('instagram.com') && prefs.instagram) shouldInject = true;
    if (currentUrl.includes('x.com') && prefs.twitter) shouldInject = true;

    if (shouldInject) injectFloatingButton(); 
});

function injectFloatingButton() {
    const triggerBtn = document.createElement('button');
    // Disabled pointer events on the SVG so the click passes straight to the button
    triggerBtn.innerHTML = `<svg style="pointer-events: none;" width="30px" height="30px" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 16L7 11H10V4H14V11H17L12 16Z"/><path d="M4 18H20V20H4V18Z"/></svg>`;
    triggerBtn.id = 'plug-and-play-trigger';
    
    // Force visibility above all overlays
    triggerBtn.style.zIndex = '2147483647';
    triggerBtn.style.cursor = 'pointer';

    const hostname = window.location.hostname;
    let activeMediaUrl = window.location.href; 
    let hasMoved = false;

    if (hostname.includes('youtube.com')) {
        document.body.appendChild(triggerBtn);
        let isBtnDragging = false, btnStartX, btnStartY, btnInitialX, btnInitialY;

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
    } 
    else if (hostname.includes('tiktok.com') || hostname.includes('instagram.com') || hostname.includes('x.com') || hostname.includes('twitter.com') || hostname.includes('reddit.com')) {
        
        const feedObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    const activeVideo = entry.target;
                    let container;
                    let postUrl = window.location.href; // Default fallback

                    // 1. TikTok & Instagram (URL bar usually updates, so fallback is fine)
                    if (hostname.includes('tiktok.com') || hostname.includes('instagram.com')) {
                        container = activeVideo.closest('[data-e2e="recommend-list-item-container"]') 
                                 || activeVideo.closest('[data-e2e="browse-video"]')
                                 || activeVideo.closest('.tiktok-web-player')
                                 || activeVideo.parentElement;
                    } 
                    // 2. Twitter / X (Extract from the timestamp link)
                    else if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
                        container = activeVideo.closest('article');
                        const timeLink = container?.querySelector('a[href*="/status/"]');
                        if (timeLink) postUrl = timeLink.href;
                    } 
                    // 3. Reddit (Extract from the new UI shreddit-post or old UI comment link)
                    else if (hostname.includes('reddit.com')) {
                        container = activeVideo.closest('shreddit-post') || activeVideo.closest('.Post');
                        if (container && container.getAttribute('permalink')) {
                            postUrl = `https://www.reddit.com${container.getAttribute('permalink')}`;
                        } else {
                            const commentLink = container?.querySelector('a[href*="/comments/"]');
                            if (commentLink) postUrl = commentLink.href;
                        }
                    }

                    activeMediaUrl = postUrl; // Lock in the specific media URL

                    if (container) {
                        container.style.position = 'relative'; 
                        triggerBtn.style.position = 'absolute';
                        triggerBtn.style.bottom = '80px'; 
                        triggerBtn.style.right = '20px';
                        triggerBtn.style.left = 'auto';
                        triggerBtn.style.top = 'auto';
                        container.appendChild(triggerBtn);
                    }
                }
            });
        }, { threshold: 0.5 });

        setInterval(() => {
            document.querySelectorAll('video:not([data-observed="true"])').forEach(video => {
                feedObserver.observe(video);
                video.dataset.observed = "true";
            });
        }, 1000);
    }

    // --- DELEGATED CAPTURE LISTENER (Bypasses React) ---
    document.body.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('#plug-and-play-trigger');
        if (!targetBtn) return; // Ignore clicks anywhere else on the page

        // Force execution and block React's synthetic event swallowing
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (hasMoved) return; 
        if (targetBtn.innerHTML === '⏳') return;

        if (hostname.includes('youtube.com')) {
            const path = window.location.pathname;
            if (!path.includes('/watch') && !path.includes('/shorts') && !path.includes('/post')) {
                alert("Please navigate to a valid YouTube video, Short, or Community Post first.");
                return;
            }
            activeMediaUrl = window.location.href; 
        }

        const originalIcon = triggerBtn.innerHTML;
        triggerBtn.innerHTML = '⏳'; 
        const videoTitle = document.title.replace(/[^\w\s-]/g, '').trim();

        // Target the correct cookie jar
        let targetDomain = '.youtube.com';
        if (hostname.includes('tiktok.com')) targetDomain = '.tiktok.com';
        else if (hostname.includes('instagram.com')) targetDomain = '.instagram.com';
        else if (hostname.includes('reddit.com')) targetDomain = '.reddit.com';
        else if (hostname.includes('x.com') || hostname.includes('twitter.com')) targetDomain = '.twitter.com';

        chrome.runtime.sendMessage({ action: "GET_COOKIES", domain: targetDomain }, async (response) => {
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
                        url: activeMediaUrl, 
                        cookieHeader: response.cookieString 
                    }) 
                });

                if (!res.ok) throw new Error(`Backend rejected request: ${res.status}`);

                const contentType = res.headers.get("content-type");

                if (contentType && contentType.includes("application/json")) {
                    const data = await res.json();
                    if (data.type === 'gallery' && data.images) {
                        data.images.forEach((base64Data, index) => {
                            const a = document.createElement('a');
                            a.href = base64Data;
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
    }, true); // <-- 'true' forces this to run before TikTok's UI captures the click
}
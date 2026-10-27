document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('manual-url');
    const downloadBtn = document.getElementById('download-btn');
    const statusText = document.getElementById('status');
    
    const toggles = {
        youtube: document.getElementById('toggle-youtube'),
        tiktok: document.getElementById('toggle-tiktok'),
        reddit: document.getElementById('toggle-reddit'),
        instagram: document.getElementById('toggle-ig'),
        twitter: document.getElementById('toggle-twitter')
    };

    // 1. Load saved preferences when popup opens
    chrome.storage.local.get(['sitePreferences'], (result) => {
        const prefs = result.sitePreferences || { youtube: true, tiktok: true, reddit: true, instagram: true, twitter: true };
        toggles.youtube.checked = prefs.youtube;
        toggles.tiktok.checked = prefs.tiktok;
        toggles.reddit.checked = prefs.reddit;
        toggles.instagram.checked = prefs.instagram;
        toggles.twitter.checked = prefs.twitter;
    });

    // 2. Save preferences when a user clicks a checkbox
    Object.keys(toggles).forEach(site => {
        toggles[site].addEventListener('change', () => {
            const updatedPrefs = {
                youtube: toggles.youtube.checked,
                tiktok: toggles.tiktok.checked,
                reddit: toggles.reddit.checked,
                instagram: toggles.instagram.checked, // Fixed the Twitter typo here
                twitter: toggles.twitter.checked
            };
            chrome.storage.local.set({ sitePreferences: updatedPrefs });
        });
    });
    // 3. Handle manual URL submission
   downloadBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) return;

        statusText.style.display = 'block';
        downloadBtn.disabled = true;

        // 1. Extract the base domain from the pasted URL
        let targetDomain = '.youtube.com';
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.hostname.includes('tiktok.com')) targetDomain = '.tiktok.com';
            else if (parsedUrl.hostname.includes('instagram.com')) targetDomain = '.instagram.com';
            else if (parsedUrl.hostname.includes('reddit.com')) targetDomain = '.reddit.com';
            else if (parsedUrl.hostname.includes('x.com') || parsedUrl.hostname.includes('twitter.com')) targetDomain = '.twitter.com';
        } catch (e) {
            console.error("Invalid URL provided");
            statusText.innerText = "Invalid URL";
            setTimeout(() => { statusText.style.display = 'none'; statusText.innerText = "Request sent to backend..."; downloadBtn.disabled = false; }, 2000);
            return;
        }

        // 2. Ask background.js for the specific cookies
        chrome.runtime.sendMessage({ action: "GET_COOKIES", domain: targetDomain }, async (response) => {
            try {
                const res = await fetch('https://video-downloader-jjay.onrender.com/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        url: url, 
                        cookieHeader: response?.cookieString || "" 
                    }) 
                });

                if (!res.ok) throw new Error("Backend error");

                const contentType = res.headers.get("content-type");
                
                // 3. Handle both Galleries and Videos
                if (contentType && contentType.includes("application/json")) {
                    const data = await res.json();
                    if (data.type === 'gallery' && data.images) {
                        data.images.forEach((img, i) => chrome.downloads.download({ url: img, filename: `Gallery_${i+1}.jpg` }));
                    }
                } else {
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    chrome.downloads.download({ url: blobUrl, filename: "Manual_Download.mp4" });
                }
            } catch (err) {
                console.error("Download failed:", err);
                statusText.innerText = "Download failed";
            }
            
            setTimeout(() => {
                statusText.style.display = 'none';
                statusText.innerText = "Request sent to backend...";
                downloadBtn.disabled = false;
                urlInput.value = '';
            }, 2000);
        });
    });
});
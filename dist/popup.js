document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('manual-url');
    const downloadBtn = document.getElementById('download-btn');
    const statusText = document.getElementById('status');
    
    const toggles = {
        youtube: document.getElementById('toggle-youtube'),
        tiktok: document.getElementById('toggle-tiktok'),
        reddit: document.getElementById('toggle-reddit')
    };

    // 1. Load saved preferences when popup opens
    chrome.storage.local.get(['sitePreferences'], (result) => {
        const prefs = result.sitePreferences || { youtube: true, tiktok: true, reddit: true };
        toggles.youtube.checked = prefs.youtube;
        toggles.tiktok.checked = prefs.tiktok;
        toggles.reddit.checked = prefs.reddit;
    });

    // 2. Save preferences when a user clicks a checkbox
    Object.keys(toggles).forEach(site => {
        toggles[site].addEventListener('change', () => {
            const updatedPrefs = {
                youtube: toggles.youtube.checked,
                tiktok: toggles.tiktok.checked,
                reddit: toggles.reddit.checked
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

        chrome.runtime.sendMessage({ action: "GET_COOKIES" }, async (response) => {
            try {
                const res = await fetch('https://video-downloader-jjay.onrender.com/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: url, cookieHeader: response?.cookieString || "" }) 
                });

                if (!res.ok) throw new Error("Backend error");

                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await res.json();
                    if (data.type === 'gallery' && data.images) {
                        data.images.forEach((img, i) => chrome.downloads.download({ url: img, filename: `image${i+1}.jpg` }));
                    }
                } else {
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    chrome.downloads.download({ url: blobUrl, filename: "YT.mp4" });
                }
            } catch (err) {
                console.error("Download failed:", err);
            }
            
            statusText.style.display = 'none';
            downloadBtn.disabled = false;
            urlInput.value = '';
        });
    });
});
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

        // Route it through the exact same background flow
        chrome.runtime.sendMessage({ 
            action: "FETCH_FROM_API", 
            payload: { 
                url: url,
                title: "Manual_Download" // Generic title for pasted links
            } 
        });

        setTimeout(() => {
            statusText.style.display = 'none';
            downloadBtn.disabled = false;
            urlInput.value = '';
        }, 2000);
    });
});
let player;

// 1. This function is the "Handshake." 
// We include specific 'playerVars' to bypass local security restrictions.
function onYouTubeIframeAPIReady() {
    console.log("Attempting to connect to YouTube...");
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: 'M7lc1UVf-VE', // TED-Ed: The power of a great introduction
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'loop': 0,
            'fs': 1,
            'cc_load_policy': 1,
            'iv_load_policy': 3,
            'autohide': 0,
            'origin': window.location.origin // This is the 'ID Card' for your local server
        },
        events: {
            'onReady': onPlayerReady,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    console.log("Handshake Successful: Player is ready!");
}

// 2. This will tell us EXACTLY why YouTube is being difficult if it fails
function onPlayerError(event) {
    console.error("YouTube Error Code:", event.data);
    if(event.data == 150 || event.data == 101) {
        console.error("The owner of this video does not allow it to be played here.");
    }
}

// 3. The 5-second skip logic
function changeTime(seconds) {
    if (player && player.getCurrentTime) {
        const currentTime = player.getCurrentTime();
        player.seekTo(currentTime + seconds, true);
        console.log("Skipping to:", currentTime + seconds);
    }
}

// 4. Placeholder for your search function
async function searchVideo() {
    const word = document.getElementById('searchTerm').value;
    alert("System check: Searching for '" + word + "'. API connection next!");
}
// id = # and class = .
const musicContainer = document.querySelector(".music-container");
const playBtn = document.querySelector("#play");
const prevBtn = document.querySelector("#prev");
const nextBtn = document.querySelector("#next");
const muteBtn = document.querySelector("#mute");
const progress = document.querySelector(".progress");
const progressContainer = document.querySelector(".progress-container");
const songTitle = document.querySelector("#title");
const songImage = document.querySelector("#cover");
const volumeContainer = document.querySelector(".volume-container");
const volumeSlider = document.querySelector("#volumeSlider");
const stationGrid = document.querySelector(".station-grid");

const navRadioLink = document.querySelector("#nav-radio");
const navHomeLink = document.querySelector("#nav-home");
const navSearchLink = document.querySelector("#nav-search");

const searchInput = document.querySelector("#search-input");
const searchBtn = document.querySelector("#search-btn");
const resultsSection = document.querySelector("#search-results-section");
const resultsListContainer = document.querySelector("#results-list-container");
const resultsHeading = document.querySelector("#search-results-heading");
const playerSubtitle = document.querySelector("#player-subtitle");

const currentTimeDisplay = document.querySelector(".progress-wrapper > .time:first-child");
const totalDurationDisplay = document.querySelector(".live-indicator");
const progressBarFill = document.querySelector(".progress");

const mainContentPanel = document.querySelector(".main-content");
const parallaxBgImage = document.querySelector(".parallax-bg");

let stations = [];
let searchResultsPlaylist = [];
let currentPlaylist = []; 
let stationIndex = 0;
let isDraggingVolume = false;
let currentMode = 'radio'; // State tracker: 'radio' or 'youtube'
let preMuteVolume = 1.0;

const nativeAudio = new Audio(); 
let ytPlayer = null; 

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('yt-player', {
        height: '1px',
        width: '1px',
        videoId: '',
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1
        },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
};

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        nextSong();
    }
}

// Global Progress Monitor loop ticking every 200ms
setInterval(() => {
    if (currentMode === 'radio') {
        if (!nativeAudio.duration || nativeAudio.duration === Infinity) {
            progress.style.width = '100%';
        } else {
            progress.style.width = `${(nativeAudio.currentTime / nativeAudio.duration) * 100}%`;
        }
    } else if (currentMode === 'youtube' && ytPlayer && typeof ytPlayer.getDuration === 'function') {
        const duration = ytPlayer.getDuration();
        const currentTime = ytPlayer.getCurrentTime();
        if (duration > 0) {
            progress.style.width = `${(currentTime / duration) * 100}%`;
        }
    }
}, 200);

async function fetchStations() {
    try {
        const response = await fetch('/api/stations');
        const data = await response.json();
        stations = data.map(s => ({ ...s, isRadio: true }));
        renderStationCards();

        if (stations.length > 0) {
            currentPlaylist = stations;
            loadItem(stations[stationIndex], false);
        }
    } catch (error) {
        console.error('Failed to communicate with SQLite backend: ', error);
    }
}

function scrollToHome() {
    const mainContent = document.querySelector(".main-content");
    const heroHeader = document.querySelector("#main");
    if (mainContent && heroHeader) {
        mainContent.scrollTo({ 
            top: heroHeader.offsetTop, 
            behavior: "smooth" 
        });
    }
}

function scrollToStations() {
    const mainContent = document.querySelector(".main-content");
    const targetSection = document.querySelector("#radio-section");
    if (mainContent && targetSection) {
        const targetOffset = targetSection.offsetTop - 20; 
        mainContent.scrollTo({ 
            top: targetOffset, 
            behavior: "smooth" 
        });
    }
}

function scrollToSearchMusic() {
    const mainContent = document.querySelector(".main-content");
    const targetSection = document.querySelector("#search-music");
    if (mainContent && targetSection) {
        const targetOffset = targetSection.offsetTop - 20;
        mainContent.scrollTo({ 
            top: targetOffset, 
            behavior: "smooth" 
        });
    }
}

async function executeSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    resultsHeading.innerText = `Searching tracks matching "${query}"...`;
    resultsSection.style.display = "block";
    scrollToSearchMusic();

    try {
        const response = await fetch(`/api/search-track?search=${encodeURIComponent(query)}`);
        searchResultsPlaylist = await response.json();

        if (searchResultsPlaylist.length === 0) {
            resultsHeading.innerText = "No results found.";
            return;
        }

        resultsHeading.innerText = `Search Results\n${searchResultsPlaylist.length} tracks matching "${query}"`;

        resultsListContainer.innerHTML = "";
        
        searchResultsPlaylist.forEach((track, index) => {
            const row = document.createElement("div");
            row.classList.add("search-result-row"); 
            
            row.innerHTML = `
                <div class="row-index">${track.index}</div>
                <div class="row-cover-info">
                    <img src="${track.img_link}" class="row-cover-img">
                    <div class="row-text-details">
                        <span class="row-track-name">${track.name}</span>
                        <span class="row-track-artist">${track.artist}</span>
                    </div>
                </div>
                <div class="row-album-name">${track.artist} Feed</div>
                <div class="row-duration">${track.duration}</div>
            `;

            row.addEventListener("click", () => {
                currentPlaylist = searchResultsPlaylist;
                stationIndex = index;
                currentMode = 'youtube';
                loadItem(track, true);
            });

            resultsListContainer.appendChild(row);
        });
    } catch (err) {
        console.error("Search transaction error:", err);
    }
}

function loadItem(item, shouldPlay = true) {
    if (!item) return;

    songTitle.innerHTML = item.name;
    if (playerSubtitle) {
        playerSubtitle.innerHTML = item.isRadio ? "Live Radio Stream" : (item.artist || "Cloud Track Stream");
    }

    if (item.isRadio) {
        const coverImage = item.img_link ? item.img_link : 'album_1.jpg';
        songImage.src = `./assets/${coverImage}`;
    } else {

        songImage.src = item.img_link || './assets/album_1.jpg';
    }

    // 
    if (currentMode === 'radio') {
        if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
            ytPlayer.pauseVideo();
        }
        
        nativeAudio.src = item.url;
        if (shouldPlay) playSong();
    } else {
        nativeAudio.pause();
        nativeAudio.removeAttribute('src');
        
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(item.id);
            if (!shouldPlay) ytPlayer.pauseVideo();
            else playSong();
        }
    }
}

function playSong() {
    musicContainer.classList.add('play');
    playBtn.querySelector('i.fas').classList.remove('fa-play');
    playBtn.querySelector('i.fas').classList.add('fa-pause');

    if (currentMode === 'radio') {
        nativeAudio.play().catch(err => console.log("Radio stream playback blocked:", err));
    } else if (currentMode === 'youtube' && ytPlayer && typeof ytPlayer.playVideo === 'function') {
        ytPlayer.playVideo();
    }
}

function pauseSong() {
    musicContainer.classList.remove('play');
    playBtn.querySelector('i.fas').classList.add('fa-play');
    playBtn.querySelector('i.fas').classList.remove('fa-pause');

    if (currentMode === 'radio') {
        nativeAudio.pause();
    } else if (currentMode === 'youtube' && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
        ytPlayer.pauseVideo();
    }
}

function prevSong(){
    if (currentPlaylist.length === 0) return;
    stationIndex--;
    if (stationIndex < 0) stationIndex = currentPlaylist.length - 1;
    
    const nextItem = currentPlaylist[stationIndex];
    currentMode = nextItem.isRadio ? 'radio' : 'youtube';
    loadItem(nextItem, true);
}

function nextSong(){
    if (currentPlaylist.length === 0) return;
    stationIndex++;
    if (stationIndex > currentPlaylist.length - 1) stationIndex = 0;

    const nextItem = currentPlaylist[stationIndex];
    currentMode = nextItem.isRadio ? 'radio' : 'youtube';
    loadItem(nextItem, true);
}

function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const percentage = clickX / width;

    if (currentMode === 'radio') {
        if (nativeAudio.duration && nativeAudio.duration !== Infinity) {
            nativeAudio.currentTime = percentage * nativeAudio.duration;
        }
    } else if (currentMode === 'youtube' && ytPlayer && typeof ytPlayer.getDuration === 'function') {
        const totalDuration = ytPlayer.getDuration();
        if (totalDuration > 0) {
            ytPlayer.seekTo(percentage * totalDuration, true);
        }
    }
}

function initVolume() {
    const defaultVolume = 0.8; 
    nativeAudio.volume = defaultVolume;
    if (volumeSlider) {
        volumeSlider.style.width = `${defaultVolume * 100}%`;
    }
    updateVolumeIcon(defaultVolume);
}

function volumeControl(e){
    const width = volumeContainer.clientWidth;    
    const rect = volumeContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    let volumeLevel = clickX / width;

    if (volumeLevel < 0) volumeLevel = 0;
    if (volumeLevel > 1) volumeLevel = 1;

    nativeAudio.volume = volumeLevel;
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
        ytPlayer.setVolume(volumeLevel * 100); // YouTube API requires 0-100 integers
    }

    volumeSlider.style.width = `${volumeLevel * 100}%`;
    
    updateVolumeIcon(volumeLevel);
    
    if (volumeLevel > 0) {
        nativeAudio.muted = false;
        if (ytPlayer && typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
    }
}

function updateVolumeIcon(volumeLevel) {
    const icon = muteBtn.querySelector('i');
    if (!icon) return;
    icon.className = 'fas';

    if (volumeLevel === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (volumeLevel < 0.5) {
        icon.className = 'fas fa-volume-down'; 
    } else {
        icon.className = 'fas fa-volume-up';   
    }
}

function toggleMute() {
    let isCurrentlyMuted = false;

    if (currentMode === 'radio') {
        isCurrentlyMuted = nativeAudio.muted;
    } else {
        isCurrentlyMuted = (ytPlayer && typeof ytPlayer.isMuted === 'function') ? ytPlayer.isMuted() : false;
    }

    let targetVolume;

    if (isCurrentlyMuted) {
        nativeAudio.muted = false;
        if (ytPlayer && typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
        
        targetVolume = preMuteVolume > 0 ? preMuteVolume : 0.5;
        
        nativeAudio.volume = targetVolume;
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(targetVolume * 100);
    } else {
        preMuteVolume = nativeAudio.volume > 0 ? nativeAudio.volume : 0.5;
        
        nativeAudio.muted = true;
        if (ytPlayer && typeof ytPlayer.mute === 'function') ytPlayer.mute();
        
        targetVolume = 0;
    }

    volumeSlider.style.width = `${targetVolume * 100}%`;
    updateVolumeIcon(targetVolume);
}

function renderStationCards() {
    stationGrid.innerHTML = '';
    stations.forEach((station, index) => {
        const card = document.createElement('div');
        card.classList.add('station-card');
        const coverImage = station.img_link ? station.img_link : 'album_1.jpg';

        card.innerHTML = `
            <div class="card-img-container">
                <img src="./assets/${coverImage}" class="card-cover">
                <div class="card-hover-overlay"><button class="hover-play-btn"><i class="fas fa-play"></i></button></div>
            </div>
            <h3>${station.name}</h3>
            <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">Live Broadcast</p>
        `;

        card.addEventListener('click', () => {
            currentPlaylist = stations;
            stationIndex = index;
            currentMode = 'radio';
            loadItem(station, true); 
        });
        stationGrid.appendChild(card);
    });
}

//convert time format
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

setInterval(() => {
    if (currentMode === 'radio') {
        if (currentTimeDisplay) currentTimeDisplay.innerText = "00:00";
        if (progressBarFill) progressBarFill.style.width = '100%'; 
        
        if (totalDurationDisplay) {
            totalDurationDisplay.innerHTML = `<span class="live-dot"></span> Live`;
        }
        
    } else if (currentMode === 'youtube' && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
        const currentTime = ytPlayer.getCurrentTime() || 0;
        const totalDuration = ytPlayer.getDuration() || 0;

        if (currentTimeDisplay) currentTimeDisplay.innerText = formatTime(currentTime);

        if (totalDurationDisplay) totalDurationDisplay.innerText = totalDuration > 0 ? formatTime(totalDuration) : "00:00";

        if (totalDuration > 0 && progressBarFill) {
            const progressPercent = (currentTime / totalDuration) * 100;
            progressBarFill.style.width = `${progressPercent}%`;
        }
    }
}, 250);

if (navRadioLink) {
    navRadioLink.addEventListener("click", (e) => {
        e.preventDefault(); 
        document.querySelectorAll(".nav-links a").forEach(link => link.classList.remove("active"));
        navRadioLink.classList.add("active");
        scrollToStations();
    });
}

if (navHomeLink) {
    navHomeLink.addEventListener("click", (e) => {
        e.preventDefault(); 
        document.querySelectorAll(".nav-links a").forEach(link => link.classList.remove("active"));
        navHomeLink.classList.add("active");
        scrollToHome(); 
    });
}

if (mainContentPanel && parallaxBgImage) {
    mainContentPanel.addEventListener("scroll", () => {
        const scrollTopPosition = mainContentPanel.scrollTop;
        
        const dynamicBlur = Math.min(scrollTopPosition / 25, 12); 
        
        parallaxBgImage.style.filter = `blur(${dynamicBlur}px)`;
    });
}

if (navSearchLink) {
    navSearchLink.addEventListener("click", (e) => {
        e.preventDefault(); 
        document.querySelectorAll(".nav-links a").forEach(link => link.classList.remove("active"));
        navSearchLink.classList.add("active");
        
        scrollToSearchMusic();
    });
}

// Event Listeners
playBtn.addEventListener('click', () => {
    if (musicContainer.classList.contains('play')) pauseSong();
    else playSong();
});

prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', nextSong);
progressContainer.addEventListener("click", setProgress);
muteBtn.addEventListener('click', toggleMute);

searchBtn.addEventListener("click", executeSearch);
searchInput.addEventListener("keyup", (e) => { if (e.key === "Enter") executeSearch(); });

volumeContainer.addEventListener('mousedown', (e) => { isDraggingVolume = true; volumeControl(e); });
window.addEventListener('mousemove', (e) => { if (isDraggingVolume) volumeControl(e); });
window.addEventListener('mouseup', () => { isDraggingVolume = false; });
volumeContainer.addEventListener('click', volumeControl);

initVolume();
fetchStations();
// id = # and class = .
const musicContainer = document.querySelector(".music-container")
const playBtn = document.querySelector("#play")
const prevBtn = document.querySelector("#prev")
const nextBtn = document.querySelector("#next")
const muteBtn = document.querySelector("#mute");
const audio = document.querySelector("#audio")
const progress = document.querySelector(".progress")
const progressContainer = document.querySelector(".progress-container")
const songTitle = document.querySelector("#title")
const songImage = document.querySelector("#cover")
const volumeContainer = document.querySelector(".volume-container")
const volumeSlider = document.querySelector("#volumeSlider")
const stationGrid = document.querySelector(".station-grid");

const navRadioLink = document.querySelector("#nav-radio");
const navHomeLink = document.querySelector("#nav-home");

let isDraggingVolume = false;
let preMuteVolume = 1.0;

let stations = []
let stationIndex = 0;

// fetch playlist from database
async function fetchStations(){
    try{
        const response = await fetch('/api/stations');
        stations = await response.json();

        renderStationCards();

        if (stations.length > 0){
            loadStation(stations[stationIndex], false);
        }
    } catch (error) {
        console.log('Failed to communicate with SQLite backend: ', error);
    }
}

function loadStation(station, shouldPlay = true) {
    songTitle.innerHTML = station.name;
    
    audio.pause();
    
    audio.removeAttribute('src');
    audio.load(); 
    
    audio.src = station.url; 

    const coverImage = station.img_link ? station.img_link : 'album_1.jpg';
    songImage.src = `./assets/${coverImage}`;

    if (shouldPlay) {
        playSong();
    }
}

function scrollToStations() {
    const targetSection = document.querySelector("#radio-section");
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth" });
    }
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
                <div class="card-hover-overlay">
                    <button class="hover-play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <h3>${station.name}</h3>
            <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">Live Broadcast</p>
        `;

        card.addEventListener('click', () => {
            stationIndex = index;
            loadStation(station, true); 
        });

        stationGrid.appendChild(card);
    });
}

function playSong() {
    musicContainer.classList.add('play')
    playBtn.querySelector('i.fas').classList.remove('fa-play')
    playBtn.querySelector('i.fas').classList.add('fa-pause')

    audio.play().catch(err => console.log("Playback interaction error:", err));
}

function pauseSong() {
    musicContainer.classList.remove('play')
    playBtn.querySelector('i.fas').classList.add('fa-play')
    playBtn.querySelector('i.fas').classList.remove('fa-pause')

    audio.pause()
}

function prevSong(){
    stationIndex--;
    if (stationIndex < 0) {
        stationIndex = stations.length - 1;
    }
    loadStation(stations[stationIndex], true);
}

function nextSong(){
    stationIndex++;
    if(stationIndex > stations.length - 1){
        stationIndex = 0;
    }
    loadStation(stations[stationIndex], true);
}

function updateProgress(e) {
    const { duration, currentTime } = e.srcElement;
    
    if (!duration || duration === Infinity) {
        progress.style.width = '100%';
        return;
    }
    
    const progressPercent = (currentTime / duration) * 100;
    progress.style.width = `${progressPercent}%`;
}

function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = audio.duration;

    if (duration === Infinity) return;

    audio.currentTime = (clickX / width) * duration;
}

function getCurrentVolume(){
    const currentVolume = audio.volume * 100;
    volumeSlider.style.width = `${currentVolume}%`;
    updateVolumeIcon();
}

function volumeControl(e){
    const width = volumeContainer.clientWidth;    
    const rect = volumeContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    let volumeLevel = clickX / width;

    if (volumeLevel < 0) volumeLevel = 0;
    if (volumeLevel > 1) volumeLevel = 1;

    audio.volume = volumeLevel;
    volumeSlider.style.width = `${volumeLevel * 100}%`;
    
    if (volumeLevel > 0) {
        audio.muted = false;
    }
    
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const icon = muteBtn.querySelector('i');
    if (!icon) return;

    icon.className = 'fas';

    if (audio.muted || audio.volume === 0) {
        icon.classList.add('fa-volume-mute');
    } else if (audio.volume < 0.5) {
        icon.classList.add('fa-volume-down'); 
    } else {
        icon.classList.add('fa-volume-up');   
    }
}

function toggleMute() {
    if (audio.muted) {
        audio.muted = false;
        audio.volume = preMuteVolume;
    } else {
        preMuteVolume = audio.volume;
        audio.muted = true;
    }
    
    volumeSlider.style.width = `${audio.muted ? 0 : audio.volume * 100}%`;
    updateVolumeIcon();
}

// Event Listeners
playBtn.addEventListener('click', () => {
    const isPlaying = musicContainer.classList.contains('play')
    if(isPlaying){
        pauseSong()
    } else {
        playSong()
    } 
})

prevBtn.addEventListener('click', prevSong)
nextBtn.addEventListener('click', nextSong)

audio.addEventListener('timeupdate', updateProgress)
progressContainer.addEventListener("click", setProgress)
muteBtn.addEventListener('click', toggleMute);
audio.addEventListener('ended', nextSong)

volumeContainer.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    volumeControl(e); 
});

window.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) {
        volumeControl(e);
    }
});

window.addEventListener('mouseup', () => {
    isDraggingVolume = false; 
});

volumeContainer.addEventListener('click', volumeControl)

if (navRadioLink) {
    navRadioLink.addEventListener("click", (e) => {
        e.preventDefault(); 
        document.querySelectorAll(".nav-links a").forEach(link => {
            link.classList.remove("active");
        });
        navRadioLink.classList.add("active");
        scrollToStations();
    });
}

if (navHomeLink) {
    navHomeLink.addEventListener("click", (e) => {
        e.preventDefault(); 
        document.querySelectorAll(".nav-links a").forEach(link => {
            link.classList.remove("active");
        });
        navHomeLink.classList.add("active");
        
        const mainContent = document.querySelector(".main-content");
        if (mainContent) {
            mainContent.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    });
}

getCurrentVolume();
fetchStations();
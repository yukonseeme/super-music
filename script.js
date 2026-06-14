// id = # and class = .
const musicContainer = document.querySelector(".music-container")
const playBtn = document.querySelector("#play")
const prevBtn = document.querySelector("#prev")
const nextBtn = document.querySelector("#next")
const audio = document.querySelector("#audio")
const progress = document.querySelector(".progress")
const progressContainer = document.querySelector(".progress-container")
const songTitle = document.querySelector("#title")
const songImage = document.querySelector("#cover")

// song titles
const songs = ['I wonder', "Ava"]

// keep track
let songIndex = 1

// load songs
loadSong(songs[songIndex])

// update song details
function loadSong(song){
    songTitle.innerHTML = song
    audio.src = `audio/${song}.mp3`
    songImage.src = `assets/${song}.jpg`

}

function playSong() {
    musicContainer.classList.add('play')
    playBtn.querySelector('i.fas').classList.remove('fa-play')
    playBtn.querySelector('i.fas').classList.add('fa-pause')

    audio.play()
}

function pauseSong() {
    musicContainer.classList.remove('play')
    playBtn.querySelector('i.fas').classList.add('fa-play')
    playBtn.querySelector('i.fas').classList.remove('fa-pause')

    audio.pause()
}

function prevSong(){
    songIndex--

    if(songIndex < 0){
        songIndex = songs.length - 1
    }

    loadSong(songs[songIndex])
    playSong()
}

function nextSong(){
    songIndex++
    if(songIndex > songs.length - 1){
        songIndex = 0
    }

    loadSong(songs[songIndex])
    playSong()
}

function updateProgress(e){
    const {duration, currentTime} = e.srcElement
    const progressPercent = currentTime / duration * 100
    progress.style.width = `${progressPercent}%`
}

function setProgress(e){
    const width = this.clientWidth
    const clickX = e.offsetX
    const duration = audio.duration

    audio.currentTime = (clickX / width * duration)
}


// event listener

playBtn.addEventListener('click', () => {
    const isPlaying = musicContainer.classList.contains('play')
    if(isPlaying){
        pauseSong()
    } else {
        playSong()
    } 
} )

prevBtn.addEventListener('click', prevSong)
nextBtn.addEventListener('click', nextSong)

audio.addEventListener('timeupdate', updateProgress)

progressContainer.addEventListener("click", setProgress)

audio.addEventListener('ended', nextSong)
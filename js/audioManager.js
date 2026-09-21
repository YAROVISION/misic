/**
 * AUDIO MANAGER & BEAT DETECTOR ENGINE
 * Powered by HTML5 Audio streaming + Web Audio API AnalyserNode.
 * Guarantees zero-latency streaming on Mobile (iOS / Android) & Desktop,
 * real-time frequency analysis and 3D visualizer beat reactivity.
 */

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.gainNode = null;
        this.mediaStreamDest = null;
        this.audioElement = null;
        this.mediaElementSource = null;

        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.duration = 0;

        // Frequency analysis
        this.fftSize = 512;
        this.frequencyData = null;
        this.timeDomainData = null;

        // Beat Detection state
        this.bassEnergy = 0;
        this.midEnergy = 0;
        this.highEnergy = 0;
        this.overallEnergy = 0;
        this.beatHistory = new Float32Array(30);
        this.historyIndex = 0;
        this.isBeat = false;
        this.beatThreshold = 1.25;
        this.beatHoldFrames = 0;

        // Event callbacks
        this.onTrackChange = null;
        this.onPlayStateChange = null;
        this.onTimeUpdate = null;
        this.onBeat = null;

        this.initDemoTracks();
        this.initAudioElement();
    }

    initAudioElement() {
        if (this.audioElement) return;
        this.audioElement = document.getElementById('audioElement');
        if (!this.audioElement) {
            this.audioElement = new Audio();
            this.audioElement.id = 'audioElement';
            document.body.appendChild(this.audioElement);
        }

        this.audioElement.preload = 'auto';
        this.audioElement.crossOrigin = 'anonymous';
        this.audioElement.setAttribute('playsinline', '');
        this.audioElement.setAttribute('webkit-playsinline', '');

        this.audioElement.addEventListener('timeupdate', () => {
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.getCurrentTime(), this.getDuration());
            }
        });

        this.audioElement.addEventListener('loadedmetadata', () => {
            this.duration = this.audioElement.duration || 0;
            if (this.playlist[this.currentIndex]) {
                this.playlist[this.currentIndex].duration = this.duration;
            }
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.getCurrentTime(), this.duration);
            }
        });

        this.audioElement.addEventListener('ended', () => {
            this.next();
        });

        this.audioElement.addEventListener('play', () => {
            this.isPlaying = true;
            if (this.onPlayStateChange) this.onPlayStateChange(true);
        });

        this.audioElement.addEventListener('pause', () => {
            this.isPlaying = false;
            if (this.onPlayStateChange) this.onPlayStateChange(false);
        });

        this.audioElement.addEventListener('error', (e) => {
            console.warn('Audio element error:', e);
        });
    }

    init() {
        this.initAudioElement();
        if (this.ctx) return;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.82;

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.8;

        this.mediaStreamDest = this.ctx.createMediaStreamDestination();

        // Connect mediaElementSource -> analyser -> gainNode -> [destination & mediaStreamDest]
        try {
            this.mediaElementSource = this.ctx.createMediaElementSource(this.audioElement);
            this.mediaElementSource.connect(this.analyser);
        } catch (e) {
            console.warn('createMediaElementSource note:', e);
        }

        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        if (this.mediaStreamDest) {
            this.gainNode.connect(this.mediaStreamDest);
        }

        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    /**
     * Unlock Web Audio context for mobile devices (iOS Safari / Android Chrome)
     */
    unlockAudio() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    /**
     * Default playlist with direct local paths
     */
    initDemoTracks() {
        this.playlist = [
            {
                id: 'track-dj-vtch',
                title: 'Король Своєї Долі',
                artist: 'Dj Vtch',
                url: 'audio/Dj Vtch Король Своєї Долі.mp3'
            },
            {
                id: 'track-alan-walker',
                title: 'Faded',
                artist: 'Alan Walker',
                url: 'audio/1760090903_alan-walker-faded.mp3'
            },
            {
                id: 'track-cut-off',
                title: 'Lonely',
                artist: 'Cut Off',
                url: 'audio/1763640907_cut-off-lonely.mp3'
            },
            {
                id: 'track-iyeoka',
                title: 'Simply Falling',
                artist: 'Iyeoka',
                url: 'audio/Iyeoka - Simply Falling.mp3'
            },
            {
                id: 'track-acdc',
                title: 'Thunderstruck',
                artist: 'AC/DC',
                url: 'audio/acdc_-_thunderstruck.mp3'
            },
            {
                id: 'track-bad-boys-blue',
                title: "You're a Woman",
                artist: 'Bad Boys Blue',
                url: "audio/bad_boys_blue_-_youre_a_woman_-_80-e_(z3.fm).mp3"
            }
        ];
    }

    removeTrack(index) {
        if (index < 0 || index >= this.playlist.length) return null;

        const isCurrent = index === this.currentIndex;
        const wasPlaying = this.isPlaying;
        const removedTrack = this.playlist.splice(index, 1)[0];

        if (this.playlist.length === 0) {
            this.pause();
            if (this.audioElement) this.audioElement.src = '';
            this.duration = 0;
            this.currentIndex = 0;
            if (this.onTrackChange) {
                this.onTrackChange({ title: 'Плейлист порожній', artist: 'Додайте аудіофайли' }, 0);
            }
            if (this.onTimeUpdate) this.onTimeUpdate(0, 0);
            return removedTrack;
        }

        if (index < this.currentIndex) {
            this.currentIndex--;
        } else if (isCurrent) {
            this.pause();
            if (this.currentIndex >= this.playlist.length) {
                this.currentIndex = 0;
            }
            this.loadTrack(this.currentIndex).then(() => {
                if (wasPlaying) this.play();
            });
        }

        return removedTrack;
    }

    async loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        this.initAudioElement();

        this.currentIndex = index;
        const track = this.playlist[index];

        if (track.file) {
            this.audioElement.src = URL.createObjectURL(track.file);
        } else if (track.url) {
            this.audioElement.src = encodeURI(track.url);
        }

        this.audioElement.load();

        if (this.onTrackChange) this.onTrackChange(track, index);
    }

    async play() {
        this.unlockAudio();

        const track = this.playlist[this.currentIndex];
        if (!track) return;

        if (!this.audioElement.src || this.audioElement.src === '' || this.audioElement.src === window.location.href) {
            await this.loadTrack(this.currentIndex);
        }

        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        try {
            await this.audioElement.play();
            this.isPlaying = true;
            if (this.onPlayStateChange) this.onPlayStateChange(true);
        } catch (err) {
            console.warn('Audio play request prevented or pending user interaction:', err);
        }
    }

    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
        }
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    seek(timeSeconds) {
        if (!this.audioElement) return;
        const dur = this.getDuration();
        const clamped = Math.max(0, Math.min(timeSeconds, dur > 0 ? dur : timeSeconds));
        this.audioElement.currentTime = clamped;
        if (this.onTimeUpdate) this.onTimeUpdate(clamped, dur);
    }

    setVolume(val) {
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(val, this.ctx?.currentTime || 0);
        }
        if (this.audioElement) {
            this.audioElement.volume = Math.max(0, Math.min(1, val));
        }
    }

    next() {
        let nextIdx = (this.currentIndex + 1) % this.playlist.length;
        this.loadTrack(nextIdx).then(() => {
            if (this.isPlaying) this.play();
        });
    }

    prev() {
        if (this.getCurrentTime() > 3) {
            this.seek(0);
            return;
        }
        let prevIdx = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.loadTrack(prevIdx).then(() => {
            if (this.isPlaying) this.play();
        });
    }

    getCurrentTime() {
        return this.audioElement ? this.audioElement.currentTime : 0;
    }

    getDuration() {
        if (this.audioElement && this.audioElement.duration && !isNaN(this.audioElement.duration)) {
            return this.audioElement.duration;
        }
        if (this.playlist[this.currentIndex] && this.playlist[this.currentIndex].duration) {
            return this.playlist[this.currentIndex].duration;
        }
        return 0;
    }

    async addFiles(files) {
        const newTracks = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const name = file.name.replace(/\.[^/.]+$/, '');
            const track = {
                id: 'custom-' + Date.now() + '-' + i,
                title: name,
                artist: 'Uploaded Track',
                duration: 0,
                file: file
            };
            this.playlist.push(track);
            newTracks.push(track);
        }

        if (!this.isPlaying && this.playlist.length === newTracks.length) {
            await this.loadTrack(0);
        }
        return newTracks;
    }

    /**
     * Frame-by-frame analysis: calculates frequencies, bands, and beat transients.
     */
    update() {
        if (!this.analyser || !this.isPlaying) {
            this.bassEnergy *= 0.92;
            this.midEnergy *= 0.92;
            this.highEnergy *= 0.92;
            this.overallEnergy *= 0.92;
            this.isBeat = false;
            return;
        }

        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeDomainData);

        const binCount = this.frequencyData.length;
        let bassSum = 0, bassCount = 0;
        let midSum = 0, midCount = 0;
        let highSum = 0, highCount = 0;
        let totalSum = 0;

        for (let i = 0; i < binCount; i++) {
            const val = this.frequencyData[i] / 255;
            totalSum += val;
            if (i >= 1 && i <= 8) {
                bassSum += val;
                bassCount++;
            } else if (i > 8 && i <= 50) {
                midSum += val;
                midCount++;
            } else if (i > 50 && i <= 180) {
                highSum += val;
                highCount++;
            }
        }

        const instantBass = bassCount > 0 ? (bassSum / bassCount) : 0;
        const instantMid = midCount > 0 ? (midSum / midCount) : 0;
        const instantHigh = highCount > 0 ? (highSum / highCount) : 0;
        const instantOverall = totalSum / binCount;

        // Smooth energy values
        this.bassEnergy += (instantBass - this.bassEnergy) * 0.45;
        this.midEnergy += (instantMid - this.midEnergy) * 0.35;
        this.highEnergy += (instantHigh - this.highEnergy) * 0.35;
        this.overallEnergy += (instantOverall - this.overallEnergy) * 0.35;

        // Beat detection via rolling average of bass energy
        let historySum = 0;
        for (let i = 0; i < this.beatHistory.length; i++) {
            historySum += this.beatHistory[i];
        }
        const averageBass = historySum / this.beatHistory.length;
        this.beatHistory[this.historyIndex] = instantBass;
        this.historyIndex = (this.historyIndex + 1) % this.beatHistory.length;

        // Check if current bass is an energy peak above threshold
        this.isBeat = false;
        if (this.beatHoldFrames > 0) {
            this.beatHoldFrames--;
        } else {
            if (instantBass > 0.35 && instantBass > averageBass * this.beatThreshold) {
                this.isBeat = true;
                this.beatHoldFrames = 8; // hold for ~130ms to avoid retriggering on same transient
                if (this.onBeat) this.onBeat({ bass: instantBass, overall: instantOverall });
            }
        }
    }
}

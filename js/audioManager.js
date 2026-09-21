/**
 * AUDIO MANAGER & BEAT DETECTOR ENGINE
 * Handles Web Audio API, AnalyserNode, frequency bands, beat detection, and playlist management.
 */

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.mediaStreamDest = null;

        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseOffset = 0;
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
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.82;

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.8;

        this.mediaStreamDest = this.ctx.createMediaStreamDestination();

        // Connect chain: source -> analyser -> gain -> [destination & mediaStreamDest]
        this.gainNode.connect(this.ctx.destination);
        this.gainNode.connect(this.mediaStreamDest);
        this.analyser.connect(this.gainNode);

        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    /**
     * Set up default playlist with all files from audio/ folder
     */
    initDemoTracks() {
        this.playlist = [
            {
                id: 'track-dj-vtch',
                title: 'Король Своєї Долі',
                artist: 'Dj Vtch',
                url: 'audio/Dj Vtch Король Своєї Долі.mp3',
                isProcedural: false
            },
            {
                id: 'track-alan-walker',
                title: 'Faded',
                artist: 'Alan Walker',
                url: 'audio/1760090903_alan-walker-faded.mp3',
                isProcedural: false
            },
            {
                id: 'track-cut-off',
                title: 'Lonely',
                artist: 'Cut Off',
                url: 'audio/1763640907_cut-off-lonely.mp3',
                isProcedural: false
            },
            {
                id: 'track-iyeoka',
                title: 'Simply Falling',
                artist: 'Iyeoka',
                url: 'audio/Iyeoka - Simply Falling.mp3',
                isProcedural: false
            },
            {
                id: 'track-acdc',
                title: 'Thunderstruck',
                artist: 'AC/DC',
                url: 'audio/acdc_-_thunderstruck.mp3',
                isProcedural: false
            },
            {
                id: 'track-bad-boys-blue',
                title: "You're a Woman",
                artist: 'Bad Boys Blue',
                url: "audio/bad_boys_blue_-_youre_a_woman_-_80-e_(z3.fm).mp3",
                isProcedural: false
            }
        ];
    }

    /**
     * Remove a track from the playlist by index
     */
    removeTrack(index) {
        if (index < 0 || index >= this.playlist.length) return null;

        const isCurrent = index === this.currentIndex;
        const wasPlaying = this.isPlaying;
        const removedTrack = this.playlist.splice(index, 1)[0];

        if (this.playlist.length === 0) {
            this.pause();
            this.currentBuffer = null;
            this.duration = 0;
            this.pauseOffset = 0;
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
            this.currentBuffer = null;
            this.pauseOffset = 0;
            if (this.currentIndex >= this.playlist.length) {
                this.currentIndex = 0;
            }
            this.loadTrack(this.currentIndex).then(() => {
                if (wasPlaying) this.play();
            });
        }

        return removedTrack;
    }

    async generateProceduralBuffer(track) {
        this.init();
        const sampleRate = this.ctx.sampleRate;
        const totalSeconds = track.duration;
        const totalSamples = sampleRate * totalSeconds;
        const buffer = this.ctx.createBuffer(2, totalSamples, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        const bpm = track.bpm || 128;
        const beatSec = 60 / bpm;
        const subBeat = beatSec / 4;

        // Chords progression: Am - F - C - G
        const chordFrequencies = [
            [220, 261.63, 329.63, 440], // Am
            [174.61, 220, 261.63, 349.23], // F
            [261.63, 329.63, 392, 523.25], // C
            [196, 246.94, 293.66, 392]  // G
        ];

        for (let i = 0; i < totalSamples; i++) {
            const t = i / sampleRate;
            const currentBeat = t / beatSec;
            const measure = Math.floor(currentBeat / 4);
            const chordIdx = measure % chordFrequencies.length;
            const chord = chordFrequencies[chordIdx];

            let sampleL = 0;
            let sampleR = 0;

            // 1. Kick Drum (Every beat)
            const beatFrac = (t % beatSec) / beatSec;
            if (beatFrac < 0.3) {
                const kickEnv = Math.exp(-beatFrac * 22);
                const kickFreq = 150 * Math.exp(-beatFrac * 35) + 45;
                const kick = Math.sin(2 * Math.PI * kickFreq * beatFrac * beatSec) * kickEnv * 0.9;
                sampleL += kick;
                sampleR += kick;
            }

            // 2. Snare / Clang (On beats 2 and 4)
            const snareBeat = (currentBeat % 2);
            if (snareBeat > 1.0 && snareBeat < 1.35) {
                const snareFrac = snareBeat - 1.0;
                const snareEnv = Math.exp(-snareFrac * 14);
                const noise = (Math.random() * 2 - 1) * snareEnv * 0.45;
                const tone = Math.sin(2 * Math.PI * 220 * snareFrac * beatSec) * snareEnv * 0.3;
                sampleL += noise + tone;
                sampleR += noise + tone;
            }

            // 3. Hi-Hats (Off-beats 16th notes)
            const hatFrac = (t % (subBeat * 2)) / (subBeat * 2);
            if (hatFrac < 0.15) {
                const hatEnv = Math.exp(-hatFrac * 40);
                const hatNoise = (Math.random() * 2 - 1) * hatEnv * 0.18;
                sampleL += hatNoise * 0.8;
                sampleR += hatNoise * 1.2;
            }

            // 4. Bassline (Punchy rolling 16th notes)
            const subBeatIdx = Math.floor(t / subBeat);
            const subFrac = (t % subBeat) / subBeat;
            const bassEnv = Math.exp(-subFrac * 8);
            const rootFreq = chord[0] * 0.5; // 1 octave down
            const bassNote = (subBeatIdx % 2 === 0) ? rootFreq : rootFreq * 1.5;
            const bass = Math.sin(2 * Math.PI * bassNote * t) * bassEnv * 0.42;
            sampleL += bass;
            sampleR += bass;

            // 5. Arpeggiator Lead Synth
            const arpIdx = Math.floor(t / subBeat) % chord.length;
            const arpFreq = chord[arpIdx] * 2;
            const arpEnv = Math.exp(-subFrac * 6);
            const lead = (Math.sin(2 * Math.PI * arpFreq * t) + 0.3 * Math.sin(4 * Math.PI * arpFreq * t)) * arpEnv * 0.18;
            sampleL += lead * 0.7;
            sampleR += lead * 1.1;

            // 6. Stereo Pad / Ambient Chord
            let pad = 0;
            for (let c = 0; c < chord.length; c++) {
                pad += Math.sin(2 * Math.PI * chord[c] * t + c * 0.5) * 0.04;
            }
            sampleL += pad;
            sampleR += pad;

            // Master clamp & soft limiting
            left[i] = Math.tanh(sampleL * 0.85);
            right[i] = Math.tanh(sampleR * 0.85);
        }

        track.audioBuffer = buffer;
        return buffer;
    }

    async loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        this.init();

        if (this.sourceNode) {
            try { this.sourceNode.stop(); } catch (e) {}
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        this.currentIndex = index;
        const track = this.playlist[index];

        if (!track.audioBuffer) {
            if (track.url) {
                try {
                    const response = await fetch(encodeURI(track.url));
                    const arrayBuffer = await response.arrayBuffer();
                    track.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                    track.duration = track.audioBuffer.duration;
                } catch (err) {
                    console.error('Failed to load track by URL:', err);
                }
            } else if (track.isProcedural) {
                await this.generateProceduralBuffer(track);
            } else if (track.file) {
                const arrayBuffer = await track.file.arrayBuffer();
                track.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                track.duration = track.audioBuffer.duration;
            }
        }

        if (track.audioBuffer) {
            this.duration = track.audioBuffer.duration;
        }
        this.pauseOffset = 0;

        if (this.onTrackChange) this.onTrackChange(track, index);
    }

    async play() {
        this.init();
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        const track = this.playlist[this.currentIndex];
        if (!track.audioBuffer) {
            await this.loadTrack(this.currentIndex);
        }

        if (this.sourceNode) {
            try { this.sourceNode.stop(); } catch (e) {}
            this.sourceNode.disconnect();
        }

        this.sourceNode = this.ctx.createBufferSource();
        this.sourceNode.buffer = track.audioBuffer;
        this.sourceNode.connect(this.analyser);

        this.sourceNode.onended = () => {
            if (this.isPlaying && this.getCurrentTime() >= this.duration - 0.5) {
                this.next();
            }
        };

        this.startTime = this.ctx.currentTime - this.pauseOffset;
        this.sourceNode.start(0, this.pauseOffset);
        this.isPlaying = true;

        if (this.onPlayStateChange) this.onPlayStateChange(true);
    }

    pause() {
        if (!this.isPlaying) return;
        if (this.sourceNode) {
            this.pauseOffset = this.ctx.currentTime - this.startTime;
            try { this.sourceNode.stop(); } catch (e) {}
            this.sourceNode.disconnect();
            this.sourceNode = null;
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
        const clamped = Math.max(0, Math.min(timeSeconds, this.duration));
        this.pauseOffset = clamped;
        if (this.isPlaying) {
            this.play();
        } else {
            if (this.onTimeUpdate) this.onTimeUpdate(this.pauseOffset, this.duration);
        }
    }

    setVolume(val) {
        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(val, this.ctx?.currentTime || 0);
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
        if (!this.isPlaying) return this.pauseOffset;
        return Math.min(this.duration, Math.max(0, this.ctx.currentTime - this.startTime));
    }

    /**
     * Add user uploaded audio files to playlist
     */
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
                file: file,
                isProcedural: false
            };
            this.playlist.push(track);
            newTracks.push(track);
        }

        // If currently stopped, load the first newly added track
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
        // Bins roughly: 0..binCount-1 -> 0..22050Hz
        // Bass: ~20Hz - 250Hz (bins ~ 1 to 6)
        // Mid: ~250Hz - 2500Hz (bins ~ 7 to 55)
        // High: ~2500Hz - 16000Hz (bins ~ 56 to 200)
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

        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.getCurrentTime(), this.duration);
        }
    }
}

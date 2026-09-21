/**
 * VIDEO RECORDER MODULE
 * Captures 60 FPS WebGL Canvas stream synchronized with Web Audio stream,
 * encodes high-quality video (WebM/MP4) and triggers download.
 */

export class VideoRecorder {
    constructor(canvas, audioManager) {
        this.canvas = canvas;
        this.audio = audioManager;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = 0;
        this.timerInterval = null;

        this.onStart = null;
        this.onStop = null;
        this.onTick = null;
    }

    start() {
        if (this.isRecording) return;
        this.audio.init();

        // 1. Capture Canvas Video Stream at 60 FPS
        const canvasStream = this.canvas.captureStream(60);

        // 2. Capture Web Audio Stream
        const audioStream = this.audio.mediaStreamDest.stream;

        // 3. Combine Video & Audio Tracks
        const combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
        audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

        // Determine best supported MIME type
        const mimeTypes = [
            'video/mp4;codecs=avc1,mp4a.40.2',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];

        let selectedMimeType = '';
        for (const mime of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mime)) {
                selectedMimeType = mime;
                break;
            }
        }

        const options = {
            mimeType: selectedMimeType || undefined,
            videoBitsPerSecond: 10000000 // 10 Mbps High Quality Full HD
        };

        try {
            this.mediaRecorder = new MediaRecorder(combinedStream, options);
        } catch (e) {
            this.mediaRecorder = new MediaRecorder(combinedStream);
        }

        this.recordedChunks = [];
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                this.recordedChunks.push(e.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.downloadVideo();
            if (this.onStop) this.onStop();
        };

        this.mediaRecorder.start(100); // chunk every 100ms
        this.isRecording = true;
        this.startTime = Date.now();

        // Timer interval
        this.timerInterval = setInterval(() => {
            const elapsedMs = Date.now() - this.startTime;
            if (this.onTick) this.onTick(elapsedMs);
        }, 200);

        if (this.onStart) this.onStart();

        // If audio not playing, start playback automatically for recording
        if (!this.audio.isPlaying) {
            this.audio.play();
        }
    }

    stop() {
        if (!this.isRecording) return;
        clearInterval(this.timerInterval);
        this.isRecording = false;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    downloadVideo() {
        if (this.recordedChunks.length === 0) return;
        const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `music-video-${timestamp}.${ext}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }
}

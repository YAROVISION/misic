/**
 * MAIN APP CONTROLLER
 * Initializes components, handles UI interactions, Drag & Drop, Keyboard shortcuts, and the render loop.
 */

import { AudioManager } from './audioManager.js';
import { SceneManager } from './sceneManager.js';
import { VideoRecorder } from './recorder.js';

class App {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.audio = new AudioManager();
        this.scene = new SceneManager(this.canvas, this.audio);
        this.recorder = new VideoRecorder(this.canvas, this.audio);

        this.hudIdleTimer = null;
        this.isDraggingSeek = false;

        this.cacheDOM();
        this.bindEvents();
        this.renderPlaylist();

        // Preload initial track for instant playback on mobile
        this.audio.loadTrack(0);

        // Start render loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    cacheDOM() {
        // Top bar & buttons
        this.topBar = document.getElementById('top-bar');
        this.playerHud = document.getElementById('player-hud');
        this.btnSceneToggle = document.getElementById('btnSceneToggle');
        this.sceneDropdown = document.getElementById('sceneDropdown');
        this.sceneOptItems = document.querySelectorAll('.scene-opt-item');
        this.btnArtworkUpload = document.getElementById('btnArtworkUpload');
        this.artworkInput = document.getElementById('artworkInput');
        this.btnRecord = document.getElementById('btnRecord');
        this.recordingModal = document.getElementById('recordingModal');
        this.recTimerDisplay = document.getElementById('recTimerDisplay');
        this.btnStopRecord = document.getElementById('btnStopRecord');

        // Main controls
        this.btnPlay = document.getElementById('btnPlay');
        this.playIcon = document.getElementById('playIcon');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.btnPrev = document.getElementById('btnPrev');
        this.btnNext = document.getElementById('btnNext');
        this.timeCurrent = document.getElementById('timeCurrent');
        this.timeTotal = document.getElementById('timeTotal');
        this.seekBarWrapper = document.getElementById('seekBarWrapper');
        this.seekFill = document.getElementById('seekFill');
        this.seekHandle = document.getElementById('seekHandle');

        // Track Info
        this.hudTrackName = document.getElementById('hudTrackName');
        this.hudTrackArtist = document.getElementById('hudTrackArtist');
        this.currentTrackLabel = document.getElementById('currentTrackLabel');
        this.playlistCountBadge = document.getElementById('playlistCountBadge');

        // Meter bars
        this.meterBass = document.getElementById('meterBass');
        this.meterMid = document.getElementById('meterMid');
        this.meterHigh = document.getElementById('meterHigh');

        // Utilities
        this.volumeSlider = document.getElementById('volumeSlider');
        this.btnMute = document.getElementById('btnMute');
        this.btnFullscreen = document.getElementById('btnFullscreen');
        this.btnPlaylistToggle = document.getElementById('btnPlaylistToggle');
        this.playlistDropdown = document.getElementById('playlistDropdown');
        this.btnClosePlaylist = document.getElementById('btnClosePlaylist');
        this.dropZone = document.getElementById('dropZone');
        this.audioFileInput = document.getElementById('audioFileInput');
        this.trackList = document.getElementById('trackList');
        this.toast = document.getElementById('toast');

        // Tap Feedback Indicator
        this.tapFeedback = document.getElementById('tapFeedback');
        this.tapPlaySvg = document.getElementById('tapPlaySvg');
        this.tapPauseSvg = document.getElementById('tapPauseSvg');
    }

    bindEvents() {
        // 1. Play / Pause / Next / Prev
        this.btnPlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.audio.togglePlay();
            this.showTapFeedback(this.audio.isPlaying);
        });
        this.btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            this.audio.next();
        });
        this.btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            this.audio.prev();
        });

        // 2. Audio Callbacks
        this.audio.onPlayStateChange = (isPlaying) => {
            this.playIcon.style.display = isPlaying ? 'none' : 'block';
            this.pauseIcon.style.display = isPlaying ? 'block' : 'none';
        };

        this.audio.onTrackChange = (track, index) => {
            this.hudTrackName.textContent = track.title;
            this.hudTrackArtist.textContent = track.artist || 'Audio Track';
            if (this.currentTrackLabel) {
                this.currentTrackLabel.textContent = `${track.title} • ${track.artist || ''}`;
            }
            this.renderPlaylist();
            this.showToast(`Відтворюється: ${track.title}`);
        };

        this.audio.onTimeUpdate = (current, total) => {
            if (!this.isDraggingSeek) {
                this.timeCurrent.textContent = this.formatTime(current);
                this.timeTotal.textContent = this.formatTime(total);
                const pct = total > 0 ? (current / total) * 100 : 0;
                this.seekFill.style.width = `${pct}%`;
                this.seekHandle.style.left = `${pct}%`;
            }
        };

        this.audio.onBeat = () => {
            this.scene.onBeatDrop();
        };

        // 3. Screen Tap / Click anywhere on background to Play/Pause
        let pointerStart = null;
        const isInteractive = (target) => {
            if (!target) return false;
            return !!target.closest('#player-hud, #top-bar, #playlistDropdown, #recordingModal, #toast, #sceneDropdown, #btnSceneToggle, .scene-opt-item, button, input, select, textarea, a, .playlist-item, .glass-btn, .seek-bar-wrapper');
        };

        window.addEventListener('pointerdown', (e) => {
            if (isInteractive(e.target)) {
                pointerStart = null;
                return;
            }
            pointerStart = { x: e.clientX, y: e.clientY, time: Date.now() };
        });

        window.addEventListener('pointerup', (e) => {
            if (!pointerStart) return;
            const dt = Date.now() - pointerStart.time;
            const dist = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
            pointerStart = null;

            // Distinguish quick tap/click (<350ms, <12px movement) from 3D camera pan/drag
            if (dt < 350 && dist < 12) {
                if (!isInteractive(e.target)) {
                    this.audio.togglePlay();
                    this.showTapFeedback(this.audio.isPlaying);
                }
            }
        });

        // 4. Seek Bar Scrubbing (Click & Touch Drag)
        const handleSeek = (clientX) => {
            const rect = this.seekBarWrapper.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            this.seekFill.style.width = `${pct * 100}%`;
            this.seekHandle.style.left = `${pct * 100}%`;
            this.audio.seek(pct * this.audio.duration);
        };

        this.seekBarWrapper.addEventListener('click', (e) => handleSeek(e.clientX));

        this.seekBarWrapper.addEventListener('touchstart', (e) => {
            this.isDraggingSeek = true;
            if (e.touches.length > 0) handleSeek(e.touches[0].clientX);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (this.isDraggingSeek && e.touches.length > 0) {
                const rect = this.seekBarWrapper.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
                this.seekFill.style.width = `${pct * 100}%`;
                this.seekHandle.style.left = `${pct * 100}%`;
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (this.isDraggingSeek) {
                this.isDraggingSeek = false;
                if (e.changedTouches.length > 0) handleSeek(e.changedTouches[0].clientX);
            }
        });

        // Auto-unlock audio engine on first user interaction anywhere (mobile browser requirement)
        const unlockHandler = () => {
            if (this.audio) {
                this.audio.unlockAudio();
            }
        };
        ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(evt => {
            window.addEventListener(evt, unlockHandler, { once: true, passive: true });
        });

        // 4. Volume
        this.volumeSlider.addEventListener('input', (e) => {
            this.audio.setVolume(parseFloat(e.target.value));
        });
        this.btnMute.addEventListener('click', () => {
            if (this.volumeSlider.value > 0) {
                this.prevVolume = this.volumeSlider.value;
                this.volumeSlider.value = 0;
                this.audio.setVolume(0);
            } else {
                this.volumeSlider.value = this.prevVolume || 0.8;
                this.audio.setVolume(parseFloat(this.volumeSlider.value));
            }
        });

        // 5. Scene Selection Popover (Round button + clean dropdown)
        this.btnSceneToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sceneDropdown.classList.toggle('open');
        });

        this.sceneOptItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const mode = item.dataset.mode;
                this.scene.setMode(mode);
                this.updateSceneDropdownActive(mode);
                this.sceneDropdown.classList.remove('open');
                this.showToast(`Режим: ${item.textContent.trim()}`);
            });
        });

        document.addEventListener('click', (e) => {
            if (this.sceneDropdown && !this.sceneDropdown.contains(e.target) && e.target !== this.btnSceneToggle) {
                this.sceneDropdown.classList.remove('open');
            }
        });

        this.scene.onSceneSwitch = (key) => {
            const activeMode = this.scene.currentMode === 'auto' ? 'auto' : key;
            this.updateSceneDropdownActive(activeMode);
        };

        // 6. Artwork Upload
        this.btnArtworkUpload.addEventListener('click', () => {
            this.artworkInput.click();
        });
        this.artworkInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                this.scene.setArtworkImage(url);
                this.updateSceneDropdownActive('artwork');
                this.showToast('Логотип завантажено в центральну сцену!');
            }
        });

        // 7. Video Recording
        this.btnRecord.addEventListener('click', () => {
            if (!this.recorder.isRecording) {
                this.recorder.start();
            } else {
                this.recorder.stop();
            }
        });
        this.btnStopRecord.addEventListener('click', () => {
            this.recorder.stop();
        });

        this.recorder.onStart = () => {
            this.btnRecord.classList.add('recording');
            this.btnRecord.title = 'Зупинити запис';
            this.recordingModal.classList.add('active');
            this.showToast('Запис відео розпочато (60 FPS)...');
        };

        this.recorder.onStop = () => {
            this.btnRecord.classList.remove('recording');
            this.btnRecord.title = 'Записати відео (60 FPS)';
            this.recordingModal.classList.remove('active');
            this.showToast('Відео збережено та завантажується!');
        };

        this.recorder.onTick = (ms) => {
            const sec = Math.floor(ms / 1000);
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            this.recTimerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };

        // 8. Playlist Dropdown Popover (Toggle & Outside Click)
        this.btnPlaylistToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playlistDropdown.classList.toggle('open');
        });
        this.btnClosePlaylist.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playlistDropdown.classList.remove('open');
        });

        document.addEventListener('click', (e) => {
            if (!this.playlistDropdown.contains(e.target) && e.target !== this.btnPlaylistToggle) {
                this.playlistDropdown.classList.remove('open');
            }
        });

        // 9. Drag & Drop Audio Upload
        this.dropZone.addEventListener('click', () => this.audioFileInput.click());
        this.audioFileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const added = await this.audio.addFiles(e.target.files);
                this.renderPlaylist();
                this.showToast(`Додано ${added.length} трек(ів) до плейлиста`);
            }
        });

        ['dragenter', 'dragover'].forEach(name => {
            this.dropZone.addEventListener(name, (e) => {
                e.preventDefault();
                this.dropZone.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(name => {
            this.dropZone.addEventListener(name, (e) => {
                e.preventDefault();
                this.dropZone.classList.remove('dragover');
            });
        });

        this.dropZone.addEventListener('drop', async (e) => {
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const added = await this.audio.addFiles(files);
                this.renderPlaylist();
                this.showToast(`Додано ${added.length} трек(ів) до плейлиста`);
            }
        });

        // 10. Fullscreen Toggle
        if (this.btnFullscreen) {
            this.btnFullscreen.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            });
        }

        // 11. Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
                e.preventDefault();
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
                this.audio.togglePlay();
                this.showTapFeedback(this.audio.isPlaying);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                this.audio.next();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                this.audio.prev();
            } else if (e.key === 'f' || e.key === 'F') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
                else document.exitFullscreen().catch(() => {});
            } else if (e.key === '1') {
                this.scene.setMode('galaxy');
            } else if (e.key === '2') {
                this.scene.setMode('universe');
            } else if (e.key === '3') {
                this.scene.setMode('vortex');
            } else if (e.key === '4') {
                this.scene.setMode('artwork');
            } else if (e.key === '0') {
                this.scene.setMode('auto');
            }
        });
    }

    showTapFeedback(isPlaying) {
        if (!this.tapFeedback) return;
        if (this.tapPlaySvg) this.tapPlaySvg.style.display = isPlaying ? 'block' : 'none';
        if (this.tapPauseSvg) this.tapPauseSvg.style.display = isPlaying ? 'none' : 'block';

        this.tapFeedback.classList.remove('show');
        // Force reflow
        void this.tapFeedback.offsetWidth;
        this.tapFeedback.classList.add('show');

        clearTimeout(this.tapFeedbackTimer);
        this.tapFeedbackTimer = setTimeout(() => {
            this.tapFeedback.classList.remove('show');
        }, 450);
    }

    updateSceneDropdownActive(mode) {
        if (!this.sceneOptItems) return;
        this.sceneOptItems.forEach(item => {
            if (item.dataset.mode === mode) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    renderPlaylist() {
        this.playlistCountBadge.textContent = this.audio.playlist.length;
        this.trackList.innerHTML = '';

        if (this.audio.playlist.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'playlist-empty';
            emptyEl.textContent = 'Плейлист порожній. Додайте аудіофайли вище.';
            this.trackList.appendChild(emptyEl);
            return;
        }

        this.audio.playlist.forEach((track, idx) => {
            const item = document.createElement('div');
            item.className = `playlist-item ${idx === this.audio.currentIndex ? 'active' : ''}`;
            item.innerHTML = `
                <div class="playlist-item-left">
                    <span class="playlist-item-index">${idx + 1}</span>
                    <div class="playlist-item-meta">
                        <span class="playlist-item-title">${track.title}</span>
                        <span class="playlist-item-artist">${track.artist || 'Audio Track'}</span>
                    </div>
                </div>
                <div class="playlist-item-right">
                    <span class="playlist-item-dur">${track.duration ? this.formatTime(track.duration) : '--:--'}</span>
                    <button class="playlist-item-del-btn" title="Видалити з плейлиста" data-index="${idx}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            `;

            // Click row to play
            item.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-item-del-btn')) return;
                this.audio.loadTrack(idx).then(() => this.audio.play());
                this.playlistDropdown.classList.remove('open');
            });

            // Delete track button
            const delBtn = item.querySelector('.playlist-item-del-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const removed = this.audio.removeTrack(idx);
                    if (removed) {
                        this.renderPlaylist();
                        this.showToast(`Видалено: ${removed.title}`);
                    }
                });
            }

            this.trackList.appendChild(item);
        });
    }

    formatTime(sec) {
        if (!sec || isNaN(sec)) return '00:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    showToast(msg) {
        this.toast.textContent = msg;
        this.toast.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.toast.classList.remove('show');
        }, 2500);
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Update Audio Analysis
        this.audio.update();

        // Update Beat Meters in HUD
        if (this.meterBass) {
            this.meterBass.style.height = `${Math.max(3, this.audio.bassEnergy * 18)}px`;
            this.meterMid.style.height = `${Math.max(3, this.audio.midEnergy * 18)}px`;
            this.meterHigh.style.height = `${Math.max(3, this.audio.highEnergy * 18)}px`;
        }

        // Render 3D Scene
        this.scene.render();
    }
}

// Start application on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

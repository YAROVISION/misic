/**
 * SCENE MANAGER (THREE.JS 3D MULTI-VISUALIZER ENGINE)
 * Renders multiple audio-reactive 3D scenes:
 * 1. Galaxy Warp (from galaxy-visualizer)
 * 2. Universe Nebula (from universe-preset)
 * 3. Cyber Sound Vortex
 * 4. Pulsing Center Artwork / Logo
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
    constructor(canvas, audioManager) {
        this.canvas = canvas;
        this.audio = audioManager;

        this.currentMode = 'auto'; // 'auto' | 'galaxy' | 'universe' | 'vortex' | 'artwork'
        this.activeSceneKey = 'galaxy';
        this.availableScenes = ['galaxy', 'universe', 'vortex', 'artwork'];
        this.sceneIndex = 0;

        // Auto-Director state
        this.autoDirectorTimer = 0;
        this.sceneDuration = 16.0; // switch scene every 16 seconds or on drop
        this.dropCount = 0;

        // Artwork texture
        this.customArtworkTexture = null;

        // Three.js Core
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        // Scene Groups
        this.galaxyGroup = new THREE.Group();
        this.universeGroup = new THREE.Group();
        this.vortexGroup = new THREE.Group();
        this.artworkGroup = new THREE.Group();

        // Mouse coordinates
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetMouseX = 0;
        this.targetMouseY = 0;

        // Camera shake
        this.shakeIntensity = 0;

        // UI callbacks
        this.onSceneSwitch = null;

        this.init();
    }

    init() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;

        // Scene & Camera
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x02030a, 0.0015);

        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 3000);
        this.camera.position.set(0, 0, 700);

        // OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false;
        this.controls.maxDistance = 1800;
        this.controls.minDistance = 50;

        // Add root groups
        this.scene.add(this.galaxyGroup);
        this.scene.add(this.universeGroup);
        this.scene.add(this.vortexGroup);
        this.scene.add(this.artworkGroup);

        // Build all scene layers
        this.buildGalaxyScene();
        this.buildUniverseScene();
        this.buildVortexScene();
        this.buildArtworkScene();

        // Set initial visibility
        this.showScene('galaxy', false);

        // Event listeners
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('mousemove', (e) => {
            this.targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            this.targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        });
    }

    /* Helper: create circular soft particle texture */
    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
        grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.25)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(32, 32, 32, 0, Math.PI * 2);
        ctx.fill();
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    /* =========================================================================
       SCENE 1: GALAXY WARP (Round Neon Particles & Rich Palette)
       ========================================================================= */
    buildGalaxyScene() {
        const count = 30000;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        // Rich Vibrant Neon Palette
        const neonPalette = [
            new THREE.Color('#00f0ff'), // Electric Cyan
            new THREE.Color('#ff007f'), // Neon Pink
            new THREE.Color('#9d4edd'), // Neon Purple / Violet
            new THREE.Color('#00ff66'), // Neon Green / Matrix Lime
            new THREE.Color('#ffd000'), // Neon Gold / Electric Yellow
            new THREE.Color('#ff4500'), // Laser Orange
            new THREE.Color('#0088ff'), // Deep Sky Neon Blue
            new THREE.Color('#ff00ea'), // Hot Magenta
            new THREE.Color('#ffffff')  // Star White
        ];

        for (let i = 0; i < count; i++) {
            // Spiral galaxy + spherical volumetric spread
            const radius = Math.pow(Math.random(), 1.4) * 1600 + 25;
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI * 0.85;

            positions[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
            positions[i * 3 + 1] = radius * Math.sin(phi) * 0.65;
            positions[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi);

            // Varied Neon Color Assignment
            const baseCol = neonPalette[Math.floor(Math.random() * neonPalette.length)];
            const col = baseCol.clone();
            if (Math.random() < 0.25) {
                col.lerp(new THREE.Color('#ffffff'), 0.35);
            }

            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;

            sizes[i] = Math.random() * 4.0 + 1.5;
        }

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Circular smooth PointsMaterial
        const circleTex = this.createCircleTexture();
        const mat = new THREE.PointsMaterial({
            size: 4.8,
            map: circleTex,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.galaxyStars = new THREE.Points(geom, mat);
        this.galaxyGroup.add(this.galaxyStars);

        // Center glowing multi-colored neon wireframe sphere & inner core
        const sphereGeo = new THREE.SphereGeometry(42, 18, 14);
        const wireGeo = new THREE.WireframeGeometry(sphereGeo);
        const posAttr = wireGeo.attributes.position;
        const wireCount = posAttr.count;
        const wireColors = new Float32Array(wireCount * 3);

        for (let i = 0; i < wireCount; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);

            // Compute spherical angle & normalized latitude
            const angle = Math.atan2(z, x); // -PI to PI
            const normAngle = (angle + Math.PI) / (Math.PI * 2); // 0 to 1
            const normY = (y / 42.0) * 0.5 + 0.5; // 0 to 1

            // Sample multi-colored neon spectrum smoothly across longitude & latitude
            const hueVal = (normAngle * 3.0 + normY * 2.0) % 1.0;
            const palIndex = Math.floor(hueVal * neonPalette.length) % neonPalette.length;
            const nextIndex = (palIndex + 1) % neonPalette.length;
            const frac = (hueVal * neonPalette.length) - palIndex;

            const col = neonPalette[palIndex].clone().lerp(neonPalette[nextIndex], frac);

            wireColors[i * 3] = col.r;
            wireColors[i * 3 + 1] = col.g;
            wireColors[i * 3 + 2] = col.b;
        }

        wireGeo.setAttribute('color', new THREE.BufferAttribute(wireColors, 3));

        const wireMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });

        this.galaxyCore = new THREE.LineSegments(wireGeo, wireMat);
        this.galaxyGroup.add(this.galaxyCore);

        // Inner counter-rotating neon icosahedron core for layered depth
        const innerGeo = new THREE.IcosahedronGeometry(22, 1);
        const innerWireGeo = new THREE.WireframeGeometry(innerGeo);
        const innerPosAttr = innerWireGeo.attributes.position;
        const innerCount = innerPosAttr.count;
        const innerColors = new Float32Array(innerCount * 3);

        for (let i = 0; i < innerCount; i++) {
            const x = innerPosAttr.getX(i);
            const y = innerPosAttr.getY(i);
            const z = innerPosAttr.getZ(i);

            const angle = Math.atan2(x, z);
            const normAngle = (angle + Math.PI) / (Math.PI * 2);
            const normY = (y / 22.0) * 0.5 + 0.5;

            // Inverted neon gradient for high contrast inner layer
            const hueVal = (1.0 - (normAngle * 2.5 + normY * 2.0) % 1.0) % 1.0;
            const palIndex = Math.floor(hueVal * neonPalette.length) % neonPalette.length;
            const col = neonPalette[palIndex];

            innerColors[i * 3] = col.r;
            innerColors[i * 3 + 1] = col.g;
            innerColors[i * 3 + 2] = col.b;
        }

        innerWireGeo.setAttribute('color', new THREE.BufferAttribute(innerColors, 3));
        const innerWireMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });

        this.galaxyInnerCore = new THREE.LineSegments(innerWireGeo, innerWireMat);
        this.galaxyGroup.add(this.galaxyInnerCore);
    }

    /* =========================================================================
       SCENE 2: UNIVERSE NEBULA (Procedural Shaders)
       ========================================================================= */
    buildUniverseScene() {
        // Nebula Background Dome
        const bgVertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        const bgFragmentShader = `
            uniform float uTime;
            uniform float uBass;
            varying vec2 vUv;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            float fbm(vec2 p) {
                float v = 0.0; float a = 0.5;
                for (int i = 0; i < 4; i++) {
                    v += a * noise(p); p *= 2.0; a *= 0.5;
                }
                return v;
            }
            void main() {
                vec2 uv = vUv * 2.0;
                float t = uTime * 0.03;
                float equator = smoothstep(0.5, 0.0, abs(vUv.y - 0.5));
                float n1 = fbm(uv * 2.5 + vec2(t, t));
                float n2 = fbm(uv * 4.0 - vec2(t * 1.2, t * 0.8) + n1);

                vec3 baseSpace = vec3(0.005, 0.0, 0.015);
                vec3 color1 = mix(vec3(0.18, 0.02, 0.35), vec3(0.0, 0.8, 1.0), uBass * 0.375);
                vec3 color2 = vec3(0.02, 0.22, 0.45);

                vec3 finalColor = baseSpace + color1 * n1 * (0.4 + 0.6 * equator) + color2 * n2 * (0.4 + 0.4 * equator);
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        const bgGeo = new THREE.SphereGeometry(1800, 32, 32);
        this.universeBgMat = new THREE.ShaderMaterial({
            vertexShader: bgVertexShader,
            fragmentShader: bgFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uBass: { value: 0 }
            },
            side: THREE.BackSide,
            depthWrite: false
        });
        const nebulaDome = new THREE.Mesh(bgGeo, this.universeBgMat);
        this.universeGroup.add(nebulaDome);

        // 60,000 Twinkle Stars with Custom Shader
        const pCount = 50000;
        const pGeom = new THREE.BufferGeometry();
        const pPos = new Float32Array(pCount * 3);
        const pCol = new Float32Array(pCount * 3);
        const pSizes = new Float32Array(pCount);
        const pPhases = new Float32Array(pCount);
        const pSpeeds = new Float32Array(pCount);

        const palette = ['#ff1e4a', '#23ff4b', '#2a6fff', '#ffd900', '#00ffea', '#ffffff'].map(c => new THREE.Color(c));
        const radius = 1400;

        for (let i = 0; i < pCount; i++) {
            const r = radius * Math.cbrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);

            pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pPos[i * 3 + 2] = r * Math.cos(phi);

            const col = palette[Math.floor(Math.random() * palette.length)];
            pCol[i * 3] = col.r;
            pCol[i * 3 + 1] = col.g;
            pCol[i * 3 + 2] = col.b;

            pSizes[i] = Math.pow(Math.random(), 5.0) * 22.0 + 2.0;
            pPhases[i] = Math.random() * Math.PI * 2;
            pSpeeds[i] = Math.random() * 3.0 + 0.8;
        }

        pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeom.setAttribute('customColor', new THREE.BufferAttribute(pCol, 3));
        pGeom.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));
        pGeom.setAttribute('phase', new THREE.BufferAttribute(pPhases, 1));
        pGeom.setAttribute('twinkleSpeed', new THREE.BufferAttribute(pSpeeds, 1));

        const starVertShader = `
            uniform float uTime;
            uniform float uBass;
            attribute float size;
            attribute float phase;
            attribute float twinkleSpeed;
            attribute vec3 customColor;
            varying vec3 vColor;
            varying float vTwinkle;

            void main() {
                vColor = customColor;
                float t = uTime * twinkleSpeed + phase;
                float wave = sin(t) * 0.5 + 0.5;
                float flash = pow(wave, 8.0) * (2.0 + uBass * 2.25);
                vTwinkle = 0.2 + wave * 0.4 + flash;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                float dist = length(mvPosition.xyz);
                gl_PointSize = size * (450.0 / max(1.0, dist)) * (1.0 + uBass * 1.125) * vTwinkle;
            }
        `;

        const starFragShader = `
            varying vec3 vColor;
            varying float vTwinkle;
            void main() {
                vec2 uv = gl_PointCoord.xy * 2.0 - 1.0;
                float d = length(uv);
                if (d > 1.0) discard;
                float core = exp(-d * 15.0);
                float halo = exp(-d * 4.67) * 0.3;
                float alpha = (core + halo) * min(vTwinkle, 2.5);
                gl_FragColor = vec4(vColor, alpha);
            }
        `;

        this.universeStarsMat = new THREE.ShaderMaterial({
            vertexShader: starVertShader,
            fragmentShader: starFragShader,
            uniforms: {
                uTime: { value: 0 },
                uBass: { value: 0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.universeStars = new THREE.Points(pGeom, this.universeStarsMat);
        this.universeGroup.add(this.universeStars);
    }

    /* =========================================================================
       SCENE 3: CYBER SOUND VORTEX (Circular Spectrum Bars & Tunnel)
       ========================================================================= */
    buildVortexScene() {
        // 1. Multi-Colored Starry Sky Background for Vortex
        const starCount = 20000;
        const starGeom = new THREE.BufferGeometry();
        const starPos = new Float32Array(starCount * 3);
        const starCols = new Float32Array(starCount * 3);
        const starSizes = new Float32Array(starCount);

        const neonStarPalette = [
            new THREE.Color('#00f0ff'), // Electric Cyan
            new THREE.Color('#ff007f'), // Neon Pink
            new THREE.Color('#9d4edd'), // Neon Violet / Purple
            new THREE.Color('#00ff66'), // Matrix Lime
            new THREE.Color('#ffd000'), // Electric Gold
            new THREE.Color('#ff4500'), // Laser Orange
            new THREE.Color('#0088ff'), // Deep Sky Blue
            new THREE.Color('#ff00ea'), // Hot Magenta
            new THREE.Color('#39ff14'), // Fluorescent Green
            new THREE.Color('#00ffff'), // Bright Aqua
            new THREE.Color('#ffffff')  // Pure Star White
        ];

        for (let i = 0; i < starCount; i++) {
            const radius = 600 + Math.random() * 1500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            starPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            starPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starPos[i * 3 + 2] = radius * Math.cos(phi) - 200;

            const baseCol = neonStarPalette[Math.floor(Math.random() * neonStarPalette.length)];
            const c = baseCol.clone();
            if (Math.random() < 0.25) c.lerp(new THREE.Color('#ffffff'), 0.4);

            starCols[i * 3] = c.r;
            starCols[i * 3 + 1] = c.g;
            starCols[i * 3 + 2] = c.b;

            starSizes[i] = Math.random() * 4.2 + 1.2;
        }

        starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeom.setAttribute('color', new THREE.BufferAttribute(starCols, 3));
        starGeom.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

        const starMat = new THREE.PointsMaterial({
            size: 6.2,
            map: this.createCircleTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0.98,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        });

        this.vortexStars = new THREE.Points(starGeom, starMat);
        this.vortexGroup.add(this.vortexStars);

        // 2. Vibrant Multi-Colored Neon Circular Spectrum Bars
        this.vortexBars = [];
        const ringCount = 144;
        const radius = 180;
        const barGeom = new THREE.BoxGeometry(4.5, 32, 9);

        const neonBarPalette = [
            new THREE.Color('#00f0ff'), // Electric Cyan
            new THREE.Color('#0088ff'), // Sky Blue
            new THREE.Color('#9d4edd'), // Purple
            new THREE.Color('#ff00ea'), // Magenta
            new THREE.Color('#ff007f'), // Pink
            new THREE.Color('#ff4500'), // Orange
            new THREE.Color('#ffd000'), // Gold
            new THREE.Color('#00ff66'), // Lime Green
            new THREE.Color('#00ffff')  // Aqua
        ];

        for (let i = 0; i < ringCount; i++) {
            const angle = (i / ringCount) * Math.PI * 2;
            const palIdx = Math.floor((i / ringCount) * neonBarPalette.length) % neonBarPalette.length;
            const nextIdx = (palIdx + 1) % neonBarPalette.length;
            const frac = ((i / ringCount) * neonBarPalette.length) - palIdx;
            const col = neonBarPalette[palIdx].clone().lerp(neonBarPalette[nextIdx], frac);

            const barMat = new THREE.MeshBasicMaterial({
                color: col,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending
            });
            const bar = new THREE.Mesh(barGeom, barMat);

            bar.position.x = Math.cos(angle) * radius;
            bar.position.y = Math.sin(angle) * radius;
            bar.position.z = 0;
            bar.rotation.z = angle + Math.PI / 2;

            this.vortexGroup.add(bar);
            this.vortexBars.push(bar);
        }

        // 3. Multi-Colored Concentric Glowing Neon Tunnel Rings
        this.tunnelRings = [];
        const ringColors = [
            '#00f0ff', '#ff007f', '#9d4edd', '#00ff66',
            '#ffd000', '#ff4500', '#ff00ea', '#00ffff',
            '#39ff14', '#0088ff', '#ff1493', '#7928ca',
            '#00f0ff', '#ff007f', '#9d4edd', '#00ff66'
        ];

        for (let r = 0; r < 16; r++) {
            const tRingGeo = new THREE.TorusGeometry(80 + r * 28, 2.0, 16, 72);
            const colHex = ringColors[r % ringColors.length];
            const tRingMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(colHex),
                transparent: true,
                opacity: 0.85,
                wireframe: true,
                blending: THREE.AdditiveBlending
            });
            const tRing = new THREE.Mesh(tRingGeo, tRingMat);
            tRing.position.z = -r * 75;
            this.vortexGroup.add(tRing);
            this.tunnelRings.push(tRing);
        }
    }

    /* =========================================================================
       SCENE 5: PULSING CENTER ARTWORK / LOGO (Vibrant Multi-Color Neon)
       ========================================================================= */
    buildArtworkScene() {
        // Rich Vibrant Neon Palette
        const neonPalette = [
            new THREE.Color('#00f0ff'), // Electric Cyan
            new THREE.Color('#ff007f'), // Neon Pink
            new THREE.Color('#9d4edd'), // Neon Purple / Violet
            new THREE.Color('#00ff66'), // Neon Green
            new THREE.Color('#ffd000'), // Neon Gold / Yellow
            new THREE.Color('#ff4500'), // Laser Orange
            new THREE.Color('#00d4ff'), // Electric Blue
            new THREE.Color('#ff00ea'), // Hot Magenta
            new THREE.Color('#ffffff')  // Star White
        ];

        // Center Circular Disc for Artwork
        const discGeo = new THREE.CircleGeometry(130, 64);
        
        // High-Vibrancy Multi-Colored Neon Canvas Texture for Artwork Disc
        const defCanvas = document.createElement('canvas');
        defCanvas.width = 512;
        defCanvas.height = 512;
        const ctx = defCanvas.getContext('2d');

        // Deep cyber radial gradient background
        const bgGrad = ctx.createRadialGradient(256, 256, 10, 256, 256, 256);
        bgGrad.addColorStop(0, '#150630');
        bgGrad.addColorStop(0.5, '#0a011a');
        bgGrad.addColorStop(1, '#020008');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 512, 512);

        // Neon glowing multi-color aura sweeps
        const auraGrad = ctx.createLinearGradient(0, 0, 512, 512);
        auraGrad.addColorStop(0, 'rgba(0, 240, 255, 0.55)');
        auraGrad.addColorStop(0.35, 'rgba(157, 78, 221, 0.6)');
        auraGrad.addColorStop(0.7, 'rgba(255, 0, 127, 0.65)');
        auraGrad.addColorStop(1, 'rgba(255, 208, 0, 0.55)');
        ctx.fillStyle = auraGrad;
        ctx.fillRect(0, 0, 512, 512);

        // Concentric neon rings on texture
        const ringColors = ['#00f0ff', '#ff007f', '#00ff66', '#ffd000', '#9d4edd', '#ff00ea'];
        for (let r = 0; r < 6; r++) {
            ctx.beginPath();
            ctx.arc(256, 256, 80 + r * 28, 0, Math.PI * 2);
            ctx.strokeStyle = ringColors[r % ringColors.length];
            ctx.lineWidth = 3;
            ctx.shadowColor = ringColors[r % ringColors.length];
            ctx.shadowBlur = 18;
            ctx.stroke();
        }

        // Ambient neon specks
        for (let p = 0; p < 120; p++) {
            const px = Math.random() * 512;
            const py = Math.random() * 512;
            const pr = Math.random() * 3.5 + 1.2;
            ctx.fillStyle = ringColors[p % ringColors.length];
            ctx.shadowColor = ringColors[p % ringColors.length];
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Glowing Bold Neon Typography
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 32;
        ctx.font = '900 52px "Segoe UI", Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Gradient text fill
        const textGrad = ctx.createLinearGradient(100, 220, 412, 290);
        textGrad.addColorStop(0, '#00f0ff');
        textGrad.addColorStop(0.4, '#ffffff');
        textGrad.addColorStop(0.7, '#ff00ea');
        textGrad.addColorStop(1, '#ffd000');
        ctx.fillStyle = textGrad;
        ctx.fillText('COSMIC BEATS', 256, 256);

        // Neon text outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeText('COSMIC BEATS', 256, 256);

        // Outer glowing rim on disc
        ctx.beginPath();
        ctx.arc(256, 256, 250, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 8;
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 36;
        ctx.stroke();

        this.artTexture = new THREE.CanvasTexture(defCanvas);
        this.artTexture.colorSpace = THREE.SRGBColorSpace;
        this.artTexture.needsUpdate = true;

        this.artDiscMat = new THREE.MeshBasicMaterial({
            map: this.artTexture,
            side: THREE.DoubleSide
        });
        this.artDisc = new THREE.Mesh(discGeo, this.artDiscMat);
        this.artworkGroup.add(this.artDisc);

        // Surrounding Multi-Colored Neon Pulse Halo Rings
        // 1. Inner Neon Pink/Magenta Halo
        const haloInnerGeo = new THREE.RingGeometry(136, 142, 80);
        const haloInnerMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#ff007f'),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });
        this.artHaloInner = new THREE.Mesh(haloInnerGeo, haloInnerMat);
        this.artworkGroup.add(this.artHaloInner);

        // 2. Mid Electric Cyan Halo
        const haloMidGeo = new THREE.RingGeometry(148, 155, 80);
        const haloMidMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#00f0ff'),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        this.artHaloMid = new THREE.Mesh(haloMidGeo, haloMidMat);
        this.artworkGroup.add(this.artHaloMid);

        // 3. Outer Neon Purple/Violet Pulse Halo
        const haloOuterGeo = new THREE.RingGeometry(162, 170, 80);
        const haloOuterMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#9d4edd'),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });
        this.artHaloOuter = new THREE.Mesh(haloOuterGeo, haloOuterMat);
        this.artworkGroup.add(this.artHaloOuter);

        // Legacy reference
        this.artHalo = this.artHaloMid;

        // 4. 360° Radial Frequency Spectrum Bars (Multi-Colored Neon)
        this.artRadialBars = [];
        const numBars = 128;
        const barBaseRadius = 176;
        const barWidth = 4.2;
        const barUnitHeight = 16;

        const barGeo = new THREE.PlaneGeometry(barWidth, barUnitHeight);
        barGeo.translate(0, barUnitHeight / 2, 0); // Base at origin

        for (let i = 0; i < numBars; i++) {
            const angle = (i / numBars) * Math.PI * 2;
            const palIdx = Math.floor((i / numBars) * (neonPalette.length - 1));
            const col = neonPalette[palIdx].clone();

            const barMat = new THREE.MeshBasicMaterial({
                color: col,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending
            });

            const barMesh = new THREE.Mesh(barGeo, barMat);
            barMesh.position.x = Math.cos(angle) * barBaseRadius;
            barMesh.position.y = Math.sin(angle) * barBaseRadius;
            barMesh.rotation.z = angle - Math.PI / 2;

            this.artworkGroup.add(barMesh);
            this.artRadialBars.push(barMesh);
        }

        // 5. Orbiting Multi-Colored Neon Starfield & Swarm
        const partCount = 16000;
        const pGeo = new THREE.BufferGeometry();
        const pPos = new Float32Array(partCount * 3);
        const pCol = new Float32Array(partCount * 3);
        const pSizes = new Float32Array(partCount);

        for (let i = 0; i < partCount; i++) {
            const rad = 150 + Math.pow(Math.random(), 1.3) * 850;
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI * 0.85;

            pPos[i * 3] = Math.cos(theta) * rad * Math.cos(phi);
            pPos[i * 3 + 1] = Math.sin(theta) * rad * Math.cos(phi);
            pPos[i * 3 + 2] = Math.sin(phi) * rad * 0.6;

            const baseCol = neonPalette[Math.floor(Math.random() * neonPalette.length)];
            const c = baseCol.clone();
            if (Math.random() < 0.25) {
                c.lerp(new THREE.Color('#ffffff'), 0.5);
            }

            pCol[i * 3] = c.r;
            pCol[i * 3 + 1] = c.g;
            pCol[i * 3 + 2] = c.b;

            pSizes[i] = Math.random() * 5.0 + 2.0;
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
        pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

        const pMat = new THREE.PointsMaterial({
            size: 5.0,
            map: this.createCircleTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.artParticles = new THREE.Points(pGeo, pMat);
        this.artworkGroup.add(this.artParticles);
    }

    /**
     * Update center artwork from image URL or File
     */
    setArtworkImage(url) {
        new THREE.TextureLoader().load(url, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.artDiscMat.map = texture;
            this.artDiscMat.needsUpdate = true;
            this.showScene('artwork', true);
        });
    }

    setMode(mode) {
        this.currentMode = mode;
        if (mode !== 'auto') {
            this.showScene(mode, true);
        }
    }

    showScene(sceneKey, triggerFlash = true) {
        this.activeSceneKey = sceneKey;
        const isGal = sceneKey === 'galaxy';
        const isUni = sceneKey === 'universe';
        const isVor = sceneKey === 'vortex';
        const isArt = sceneKey === 'artwork';

        this.galaxyGroup.visible = isGal;
        this.universeGroup.visible = isUni;
        this.vortexGroup.visible = isVor;
        this.artworkGroup.visible = isArt;

        if (isVor) {
            this.camera.position.set(0, 0, 700);
            this.controls.target.set(0, 0, 0);
            this.vortexGroup.position.set(0, 0, 0);
            this.vortexGroup.rotation.set(0, 0, 0);
            this.controls.enabled = false;
        } else {
            this.controls.enabled = true;
        }

        if (triggerFlash) {
            const overlay = document.getElementById('transitionOverlay');
            if (overlay) {
                overlay.classList.add('flash');
                setTimeout(() => overlay.classList.remove('flash'), 300);
            }

            const badge = document.getElementById('sceneBadge');
            if (badge) {
                const names = {
                    galaxy: '🌌 GALAXY WARP',
                    universe: '🌠 UNIVERSE NEBULA',
                    vortex: '⚡ CYBER SOUND VORTEX',
                    artwork: '🖼️ PULSING ARTWORK'
                };
                badge.textContent = names[sceneKey] || sceneKey.toUpperCase();
                badge.classList.add('show');
                setTimeout(() => badge.classList.remove('show'), 2000);
            }
        }

        if (this.onSceneSwitch) this.onSceneSwitch(sceneKey);
    }

    nextScene() {
        this.sceneIndex = (this.sceneIndex + 1) % this.availableScenes.length;
        this.showScene(this.availableScenes[this.sceneIndex], true);
    }

    onBeatDrop() {
        this.shakeIntensity = 18.0;
        this.dropCount++;
        // If in auto mode and after every 4 heavy drops, trigger scene change
        if (this.currentMode === 'auto' && this.dropCount % 4 === 0) {
            this.nextScene();
        }
    }

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    render() {
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Smooth mouse parallax
        this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
        this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

        const bass = this.audio.bassEnergy;
        const mid = this.audio.midEnergy;
        const high = this.audio.highEnergy;
        const energy = this.audio.overallEnergy;

        // Auto-Director scene switcher timer
        if (this.currentMode === 'auto' && this.audio.isPlaying) {
            this.autoDirectorTimer += delta;
            if (this.autoDirectorTimer >= this.sceneDuration) {
                this.autoDirectorTimer = 0;
                this.nextScene();
            }
        }

        // Camera Shake decay
        if (this.shakeIntensity > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.88;
        }

        // 1. GALAXY SCENE UPDATE
        if (this.galaxyGroup.visible) {
            const rotSpeed = 0.001 + bass * 0.008;
            this.galaxyStars.rotation.y += rotSpeed;
            this.galaxyStars.rotation.x += rotSpeed * 0.3;

            const scale = 1.0 + bass * 0.65;
            this.galaxyStars.scale.set(scale, scale, scale);

            if (this.galaxyCore) {
                this.galaxyCore.rotation.y -= 0.015;
                this.galaxyCore.rotation.x += 0.008;
                const cScale = 1.0 + bass * 1.6;
                this.galaxyCore.scale.set(cScale, cScale, cScale);
            }
            if (this.galaxyInnerCore) {
                this.galaxyInnerCore.rotation.y += 0.025;
                this.galaxyInnerCore.rotation.z -= 0.015;
                const inScale = 1.0 + bass * 2.0;
                this.galaxyInnerCore.scale.set(inScale, inScale, inScale);
            }

            this.galaxyGroup.rotation.x = this.mouseY * 0.25;
            this.galaxyGroup.rotation.y = this.mouseX * 0.25;
        }

        // 2. UNIVERSE SCENE UPDATE
        if (this.universeGroup.visible) {
            if (this.universeBgMat) {
                this.universeBgMat.uniforms.uTime.value = time;
                this.universeBgMat.uniforms.uBass.value = bass;
            }
            if (this.universeStarsMat) {
                this.universeStarsMat.uniforms.uTime.value = time;
                this.universeStarsMat.uniforms.uBass.value = bass;
            }
            this.universeStars.rotation.y += 0.0006 + bass * 0.002;
            this.universeGroup.rotation.x = this.mouseY * 0.15;
            this.universeGroup.rotation.y = this.mouseX * 0.15;
        }

        // 3. VORTEX SCENE UPDATE
        if (this.vortexGroup.visible) {
            // Keep strictly centered and independent of mouse
            this.vortexGroup.position.set(0, 0, 0);
            this.vortexGroup.rotation.x = 0;
            this.vortexGroup.rotation.y = 0;

            // Animate Multi-Colored Starry Sky
            if (this.vortexStars) {
                this.vortexStars.rotation.y += 0.0008 + bass * 0.002;
                this.vortexStars.rotation.x += 0.0004;
                const sScale = 1.0 + bass * 0.12;
                this.vortexStars.scale.set(sScale, sScale, sScale);
            }

            if (this.audio.frequencyData) {
                const freq = this.audio.frequencyData;
                for (let i = 0; i < this.vortexBars.length; i++) {
                    const bar = this.vortexBars[i];
                    const val = freq[i % freq.length] / 255;
                    const hScale = Math.max(0.25, val * 5.5 + bass * 2.2);
                    bar.scale.y = hScale;
                }
            }
            for (let r = 0; r < this.tunnelRings.length; r++) {
                const ring = this.tunnelRings[r];
                ring.rotation.z += (r % 2 === 0 ? 1 : -1) * (0.012 + bass * 0.035);
                const s = 1.0 + bass * 0.35;
                ring.scale.set(s, s, s);
            }
            this.vortexGroup.rotation.z += 0.004;
        }

        // 5. ARTWORK SCENE UPDATE (Cosmic Beats Multi-Color Neon)
        if (this.artworkGroup.visible) {
            const artScale = 1.0 + Math.pow(bass, 1.4) * 0.45;
            this.artDisc.scale.set(artScale, artScale, artScale);

            // Multi-colored pulse halos
            if (this.artHaloInner) {
                const sIn = 1.0 + bass * 0.65;
                this.artHaloInner.scale.set(sIn, sIn, sIn);
                this.artHaloInner.rotation.z += 0.018 + high * 0.04;
            }
            if (this.artHaloMid) {
                const sMid = 1.0 + bass * 0.85;
                this.artHaloMid.scale.set(sMid, sMid, sMid);
                this.artHaloMid.rotation.z -= 0.022 + high * 0.05;
            }
            if (this.artHaloOuter) {
                const sOut = 1.0 + bass * 1.05;
                this.artHaloOuter.scale.set(sOut, sOut, sOut);
                this.artHaloOuter.rotation.z += 0.028 + mid * 0.04;
            }

            // 360° Circular Radial Equalizer Bars
            if (this.artRadialBars && this.audio.frequencyData) {
                const freq = this.audio.frequencyData;
                const num = this.artRadialBars.length;
                const half = num / 2;
                for (let i = 0; i < num; i++) {
                    const bar = this.artRadialBars[i];
                    const distFromCenter = Math.abs(i - half) / half;
                    const fIdx = Math.floor(distFromCenter * (freq.length * 0.7));
                    const val = (freq[fIdx] || 0) / 255;
                    const scaleY = Math.max(0.18, val * 6.5 + bass * 2.8);
                    bar.scale.y = scaleY;
                }
            }

            // Orbiting Multi-Colored Neon Swarm
            if (this.artParticles) {
                this.artParticles.rotation.z += 0.003 + mid * 0.012;
                this.artParticles.rotation.x += 0.001;
                const pScale = 1.0 + bass * 0.35;
                this.artParticles.scale.set(pScale, pScale, pScale);
            }

            this.artworkGroup.rotation.x = this.mouseY * 0.2;
            this.artworkGroup.rotation.y = this.mouseX * 0.2;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Stars Creation
const starsGeometry = new THREE.BufferGeometry();
const starVertices = [];
for (let i = 0; i < 10000; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    starVertices.push(x, y, z);
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.7 });
const starField = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starField);

// Audio Setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioSource, analyser;
document.getElementById('audioInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const reader = new FileReader();
    reader.onload = function () {
        audioContext.decodeAudioData(reader.result, function (buffer) {
            if (audioSource) audioSource.stop();
            audioSource = audioContext.createBufferSource();
            audioSource.buffer = buffer;

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            audioSource.connect(analyser);
            analyser.connect(audioContext.destination);

            audioSource.start(0);
        });
    };
    reader.readAsArrayBuffer(file);
});

// Animation Loop
camera.position.z = 1000;
function animate() {
    requestAnimationFrame(animate);

    // Rotate Stars
    starField.rotation.x += 0.0005;
    starField.rotation.y += 0.0005;

    // Audio Visualization
    if (analyser) {
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
        const average = frequencyData.reduce((a, b) => a + b) / frequencyData.length;
        starField.scale.set(1 + average / 100, 1 + average/100, 1 + average/100);
    }

    renderer.render(scene, camera);
}
animate();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mouse Interaction
document.addEventListener('mousemove', (e) => {
    starField.rotation.x = (e.clientY / window.innerHeight - 0.5) * 2;
    starField.rotation.y = (e.clientX / window.innerWidth - 0.5) * 2;
});

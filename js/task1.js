import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let camera, scene, renderer;
let icosahedronMesh, torusMesh, circleMesh;
let controls;
let hue = 0;

// Animation states
let rotationEnabled = true;
let pulseMoveEnabled = true;
let colorEmitEnabled = true;
let speedMode = 'normal';
let texturesEnabled = true;
let rotationDirection = 1; // 1: Forward; -1: Backward
let specialEffectActive = false;
let specialEffectTimer = 0;
let controlsVisible = true;

// Materials with and without textures
let icosahedronMaterial, icosahedronMaterialNoTexture;
let torusMaterial, torusMaterialNoTexture;
let circleMaterial, circleMaterialNoTexture;

// Store original material properties
const originalProperties = {
  icosahedron: {},
  torus: {},
  circle: {}
};

init();
animate();

function init() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

  // Rendering
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
  directionalLight.position.set(3, 3, 3);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 10, 10);
  pointLight.position.set(-2, 2, 2);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  // Load textures
  const textureLoader = new THREE.TextureLoader();
  const glassTexture = textureLoader.load(
    'https://as1.ftcdn.net/v2/jpg/01/61/23/82/1000_F_161238202_GbkRIC1lSjG7lZCLLPfQ7wAaEQyw9UsG.jpg'
  );
  const metalTexture = textureLoader.load(
    'https://images.unsplash.com/photo-1501166222995-ff31c7e93cef?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bWV0YWwlMjB0ZXh0dXJlc3xlbnwwfHwwfHx8MA%3D%3D'
  );
  const lavaTexture = textureLoader.load(
    'https://t4.ftcdn.net/jpg/01/83/14/47/360_F_183144766_dbGaN37u6a4VCliXQ6wcarerpYmuLAto.jpg'
  );

  // 1. Icosahedron
  const icosahedronGeometry = new THREE.IcosahedronGeometry(0.6);
  icosahedronMaterial = new THREE.MeshPhysicalMaterial({
    map: glassTexture,
    transparent: true,
    opacity: 0.7,
    roughness: 0.5,
    metalness: 0.3,
    transmission: 0.6,
  });
  icosahedronMaterialNoTexture = new THREE.MeshPhysicalMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7,
    roughness: 0.5,
    metalness: 0.3,
    transmission: 0.6,
  });
  icosahedronMesh = new THREE.Mesh(icosahedronGeometry, icosahedronMaterial);
  icosahedronMesh.position.set(-1.5, 0, -5);
  scene.add(icosahedronMesh);

  // Store original properties
  originalProperties.icosahedron = {
    opacity: icosahedronMaterial.opacity,
    emissiveIntensity: icosahedronMaterial.emissiveIntensity || 0,
    transmission: icosahedronMaterial.transmission
  };

  // 2. Torus
  const torusGeometry = new THREE.TorusGeometry(0.4, 0.2, 16, 100);
  torusMaterial = new THREE.MeshStandardMaterial({
    map: metalTexture,
    metalness: 0.8,
    roughness: 0.2,
  });
  torusMaterialNoTexture = new THREE.MeshStandardMaterial({
    color: 0xff4500,
    emissive: 0xff4500,
    emissiveIntensity: 3,
    metalness: 0.5,
    roughness: 0.2,
  });
  torusMesh = new THREE.Mesh(torusGeometry, torusMaterial);
  torusMesh.position.set(0, 0, -5);
  scene.add(torusMesh);

  // Store original properties
  originalProperties.torus = {
    emissiveIntensity: torusMaterial.emissiveIntensity || 0,
    metalness: torusMaterial.metalness
  };

  // 3. Circle
  const circleGeometry = new THREE.CircleGeometry(0.6, 32);
  circleMaterial = new THREE.MeshStandardMaterial({
    map: lavaTexture,
    emissive: 0xff0000,
    emissiveIntensity: 1.5,
    side: THREE.DoubleSide,
    metalness: 0.5,
    roughness: 0.4,
  });
  circleMaterialNoTexture = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1.5,
    side: THREE.DoubleSide,
    metalness: 0.5,
    roughness: 0.4,
  });
  circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
  circleMesh.position.set(1.5, 0, -5);
  scene.add(circleMesh);

  // Store original properties
  originalProperties.circle = {
    emissiveIntensity: circleMaterial.emissiveIntensity,
    metalness: circleMaterial.metalness
  };

  // Camera position
  camera.position.z = 3;

  // Controllers for 360 view on webpage
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // AR mode setup
  const button = ARButton.createButton(renderer, {
    onSessionStarted: () => {
      renderer.domElement.style.background = 'transparent';
      document.getElementById('controls').style.display = 'flex';
    },
    onSessionEnded: () => {
      document.getElementById('controls').style.display = 'flex';
    },
  });
  document.body.appendChild(button);
  renderer.domElement.style.display = 'block';

  // Add Listener for buttons
  document
    .getElementById('toggleRotationBtn')
    .addEventListener('click', toggleRotation);
  document
    .getElementById('togglePulseBtn')
    .addEventListener('click', togglePulseMove);
  document
    .getElementById('toggleColorBtn')
    .addEventListener('click', toggleColorEmit);
  document
    .getElementById('toggleSpeedBtn')
    .addEventListener('click', toggleSpeed);
  document
    .getElementById('toggleTexturesBtn')
    .addEventListener('click', toggleTextures);
  document
    .getElementById('toggleDirectionBtn')
    .addEventListener('click', toggleDirection);
  document
    .getElementById('specialEffectBtn')
    .addEventListener('click', triggerSpecialEffect);
  document
    .getElementById('toggleControlsBtn')
    .addEventListener('click', toggleControls);

  window.addEventListener('resize', onWindowResize, false);
}

function toggleRotation() {
  rotationEnabled = !rotationEnabled;
  document.getElementById('toggleRotationBtn').textContent = rotationEnabled
    ? 'Disable Rotation'
    : 'Enable Rotation';
}

function togglePulseMove() {
  pulseMoveEnabled = !pulseMoveEnabled;
  document.getElementById('togglePulseBtn').textContent = pulseMoveEnabled
    ? 'Disable Pulse/Move'
    : 'Enable Pulse/Move';
}

function toggleColorEmit() {
  colorEmitEnabled = !colorEmitEnabled;
  document.getElementById('toggleColorBtn').textContent = colorEmitEnabled
    ? 'Disable Color/Emit'
    : 'Enable Color/Emit';
}

function toggleSpeed() {
  speedMode = speedMode === 'normal' ? 'fast' : 'normal';
  document.getElementById('toggleSpeedBtn').textContent = `Speed: ${
    speedMode.charAt(0).toUpperCase() + speedMode.slice(1)
  }`;
}

function toggleTextures() {
  texturesEnabled = !texturesEnabled;
  document.getElementById('toggleTexturesBtn').textContent = texturesEnabled
    ? 'Disable Textures'
    : 'Enable Textures';

  icosahedronMesh.material = texturesEnabled
    ? icosahedronMaterial
    : icosahedronMaterialNoTexture;
  torusMesh.material = texturesEnabled ? torusMaterial : torusMaterialNoTexture;
  circleMesh.material = texturesEnabled
    ? circleMaterial
    : circleMaterialNoTexture;

  icosahedronMesh.material.needsUpdate = true;
  torusMesh.material.needsUpdate = true;
  circleMesh.material.needsUpdate = true;
}

function toggleDirection() {
  rotationDirection *= -1;
  document.getElementById('toggleDirectionBtn').textContent =
    rotationDirection === 1 ? 'Direction: Forward' : 'Direction: Backward';
}

function triggerSpecialEffect() {
  specialEffectActive = true;
  specialEffectTimer = 0;
}

function toggleControls() {
  controlsVisible = !controlsVisible;
  const controls = document.getElementById('controls');
  const toggleBtn = document.getElementById('toggleControlsBtn');
  
  if (controlsVisible) {
    controls.classList.remove('collapsed');
    toggleBtn.textContent = 'Hide Controls';
  } else {
    controls.classList.add('collapsed');
    toggleBtn.textContent = 'Show Controls';
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
  controls.update();
}

function render(timestamp) {
  animateObjects(timestamp);
  renderer.render(scene, camera);
}

function animateObjects(timestamp) {
  const speed = speedMode === 'normal' ? 1 : 2;
  const specialSpeed = specialEffectActive ? 3 : 1;

  // Icosahedron animation
  if (rotationEnabled) {
    icosahedronMesh.rotation.y -=
      0.01 * speed * rotationDirection * specialSpeed;
  }
  if (pulseMoveEnabled) {
    const scale = 1 + 0.2 * Math.sin(timestamp * 0.002 * speed * specialSpeed);
    icosahedronMesh.scale.set(scale, scale, scale);
    icosahedronMesh.position.y =
      0.5 * Math.sin(timestamp * 0.002 * speed * specialSpeed);
    if (icosahedronMesh.material.opacity !== undefined) {
      icosahedronMesh.material.opacity =
        0.5 + 0.2 * Math.sin(timestamp * 0.003 * speed * specialSpeed);
    }
  }

  // Torus animation
  if (rotationEnabled) {
    torusMesh.rotation.x -= 0.01 * speed * rotationDirection * specialSpeed;
    torusMesh.rotation.z += 0.005 * speed * rotationDirection * specialSpeed;
  }
  if (pulseMoveEnabled) {
    torusMesh.position.y = 0.3 * Math.sin(timestamp * 0.003 * speed * specialSpeed);
  }
  if (colorEmitEnabled) {
    hue += 0.005 * speed * specialSpeed;
    if (hue > 1) hue = 0;
    torusMesh.material.color.setHSL(hue, 1, 0.5);
    if (torusMesh.material.emissive) {
      torusMesh.material.emissive.setHSL(hue, 1, 0.5);
    }
  }

  // Circle animation
  if (rotationEnabled) {
    circleMesh.rotation.x -= 0.01 * speed * rotationDirection * specialSpeed;
    circleMesh.rotation.y -= 0.01 * speed * rotationDirection * specialSpeed;
  }
  if (pulseMoveEnabled) {
    const jump = Math.abs(Math.sin(timestamp * 0.005 * speed * specialSpeed)) * 0.5;
    circleMesh.position.y = jump;
  }
  if (colorEmitEnabled && circleMesh.material.emissiveIntensity !== undefined) {
    circleMesh.material.emissiveIntensity =
      1.5 + Math.sin(timestamp * 0.003 * speed * specialSpeed);
  }

  // Special Effect (Flicker)
  if (specialEffectActive) {
    specialEffectTimer += 0.1;
    
    // Random flicker values
    const flickerOpacity = Math.random() * 0.5 + 0.5;
    const flickerEmissive = Math.random() * 3;
    const flickerMetalness = Math.random();
    
    // Apply flicker to Icosahedron
    if (icosahedronMesh.material.opacity !== undefined) {
      icosahedronMesh.material.opacity = flickerOpacity;
      icosahedronMesh.material.transmission = flickerOpacity * 0.6;
    }
    
    // Apply flicker to Torus
    if (torusMesh.material.emissiveIntensity !== undefined) {
      torusMesh.material.emissiveIntensity = flickerEmissive;
      torusMesh.material.metalness = flickerMetalness;
    }
    
    // Apply flicker to Circle
    if (circleMesh.material.emissiveIntensity !== undefined) {
      circleMesh.material.emissiveIntensity = flickerEmissive;
      circleMesh.material.metalness = flickerMetalness;
    }
    
    // Reset after 2 seconds
    if (specialEffectTimer >= 20) {
      specialEffectActive = false;
      specialEffectTimer = 0;
      
      // Reset to original properties
      if (icosahedronMesh.material.opacity !== undefined) {
        icosahedronMesh.material.opacity = originalProperties.icosahedron.opacity;
        icosahedronMesh.material.transmission = originalProperties.icosahedron.transmission;
      }
      
      if (torusMesh.material.emissiveIntensity !== undefined) {
        torusMesh.material.emissiveIntensity = originalProperties.torus.emissiveIntensity;
        torusMesh.material.metalness = originalProperties.torus.metalness;
      }
      
      if (circleMesh.material.emissiveIntensity !== undefined) {
        circleMesh.material.emissiveIntensity = originalProperties.circle.emissiveIntensity;
        circleMesh.material.metalness = originalProperties.circle.metalness;
      }
    }
  }
}
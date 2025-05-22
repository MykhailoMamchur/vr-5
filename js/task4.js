import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let container;
let camera, scene, renderer;
let reticle;
let controller;
let model;
let spawnedModels = []; // Array to track all spawned models
let loader; // GLTF Loader instance
let directionalLightEnabled = true;
let jumpEnabled = true;
let rotationEnabled = true;
let directionalLight;
let lightIntensity = 3;
let lightColors = [0xffffff, 0xffaaaa, 0xaaffaa, 0xaaaaff]; // White, red, green, blue
let currentLightColorIndex = 0;
let controlsVisible = true;

// Material styles array
const materials = {
  realistic: null, // Realistic (with model textures)
  gold: new THREE.MeshStandardMaterial({
    color: 0xffd700, // Gold color
    metalness: 0.9, // Increased for clearer reflections
    roughness: 0.1,
  }),
  glow: new THREE.MeshStandardMaterial({
    color: 0x00ff00, // Green glow
    emissive: 0x00ff00,
    emissiveIntensity: 1.5, // Reduced to not obscure details
    metalness: 0.3,
    roughness: 0.3, // Reduced for clarity
  }),
  glass: new THREE.MeshPhysicalMaterial({
    transparent: true,
    opacity: 0.5, // Increased for clarity
    metalness: 0.2,
    roughness: 0.05, // Reduced for clearer reflections
    transmission: 0.9,
    thickness: 0.5,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: 0xffffff, // White for chrome effect
    metalness: 1, // Maximum reflectivity
    roughness: 0.02, // Minimum roughness for clarity
  }),
};

// Save original materials for model
const originalMaterials = new Map();
let currentMaterial = 'realistic';

// Model URL
const modelUrl = 'https://manufactura-public.s3.us-east-1.amazonaws.com/musical/scene.gltf';

init();
loadModel(modelUrl);
animate();

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // Rendering
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.setClearColor(0x000000, 0); // Set clear color to transparent
  renderer.shadowMap.enabled = true; // Enable shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
  container.appendChild(renderer.domElement);

    // Model loading will be handled by loadModel function

  // Light
  directionalLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
  directionalLight.position.set(2, 3, 2); // Changed position for clearer shadows
  directionalLight.castShadow = true; // Enable shadows
  directionalLight.shadow.mapSize.width = 1024; // Shadow quality
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Reduced intensity
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5); // Added Hemisphere Light
  hemisphereLight.position.set(0, 1, 0);
  scene.add(hemisphereLight);

  // Controller for adding objects
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  // Add surface marker
  addReticleToScene();

  // AR mode setup with hit-test
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
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
    .getElementById('materialRealisticBtn')
    .addEventListener('click', () => setMaterial('realistic'));
  document
    .getElementById('materialGoldBtn')
    .addEventListener('click', () => setMaterial('gold'));
  document
    .getElementById('materialGlowBtn')
    .addEventListener('click', () => setMaterial('glow'));
  document
    .getElementById('materialGlassBtn')
    .addEventListener('click', () => setMaterial('glass'));
  document
    .getElementById('materialChromeBtn')
    .addEventListener('click', () => setMaterial('chrome'));
  document
    .getElementById('toggleDirectionalLightBtn')
    .addEventListener('click', toggleDirectionalLight);
  document
    .getElementById('increaseLightIntensityBtn')
    .addEventListener('click', increaseLightIntensity);
  document
    .getElementById('decreaseLightIntensityBtn')
    .addEventListener('click', decreaseLightIntensity);
  document
    .getElementById('changeLightColorBtn')
    .addEventListener('click', changeLightColor);
  document
    .getElementById('toggleJumpBtn')
    .addEventListener('click', toggleJump);
  document
    .getElementById('toggleRotationBtn')
    .addEventListener('click', toggleRotation);
  document
    .getElementById('toggleControlsBtn')
    .addEventListener('click', toggleControls);

  window.addEventListener('resize', onWindowResize, false);
}

function addReticleToScene() {
  const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.7,
  });

  reticle = new THREE.Mesh(geometry, material);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  reticle.add(new THREE.AxesHelper(0.5));
}

function onSelect() {
  if (reticle.visible) {
    // Create a new instance of the model at the reticle position
    if (model) {
      // Clone the model
      const newModel = model.clone();
      
      // Position the new model at the reticle position
      newModel.position.setFromMatrixPosition(reticle.matrix);
      newModel.quaternion.setFromRotationMatrix(reticle.matrix);
      newModel.visible = true;
      
      // Ensure consistent scale for all spawned models
      newModel.scale.set(0.1, 0.1, 0.1);
      
      // Store base position for animations
      newModel.userData.basePosition = newModel.position.clone();
      
      // Add the model to the scene
      scene.add(newModel);
      
      // Add to our array of spawned models
      spawnedModels.push(newModel);
      
      // Apply current material to the new model
      applyMaterialToModel(newModel, currentMaterial);

    }
  }
}

function setMaterial(type) {
  if (!model) return;
  
  currentMaterial = type;
  
  // Apply to template model
  applyMaterialToModel(model, type);
  
  // Apply to all spawned models
  spawnedModels.forEach(spawnedModel => {
    applyMaterialToModel(spawnedModel, type);
  });

  // Update material buttons UI
  document.querySelectorAll('.material-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.getElementById(`material${type.charAt(0).toUpperCase() + type.slice(1)}Btn`).classList.add('active');

  // Play sound on material change
  const materialSound = document.getElementById('materialSound');
  if (materialSound) {
    materialSound.currentTime = 0;
    materialSound.play();
  }
}

function applyMaterialToModel(modelInstance, type) {
  if (!modelInstance) return;
  
  // Ensure consistent scale is maintained when applying materials
  modelInstance.scale.set(0.1, 0.1, 0.1);
  
  modelInstance.traverse((child) => {
    if (child.isMesh) {
      if (type === 'realistic') {
        // Restore original material if it exists
        const originalMaterial = originalMaterials.get(child) || originalMaterials.get(findOriginalMesh(child));
        if (originalMaterial) {
          child.material = originalMaterial.clone();
        }
      } else {
        // Clone the material to avoid sharing materials between different meshes
        child.material = materials[type].clone();
      }
    }
  });
}

function findOriginalMesh(clonedMesh) {
  for (const [originalMesh] of originalMaterials.entries()) {
    if (originalMesh.geometry.uuid === clonedMesh.geometry.uuid) {
      return originalMesh;
    }
  }
  return null;
  document.getElementById('materialGlassBtn').textContent =
    currentMaterial === 'glass'
      ? 'Material: Glass (Active)'
      : 'Material: Glass';
  document.getElementById('materialChromeBtn').textContent =
    currentMaterial === 'chrome'
      ? 'Material: Chrome (Active)'
      : 'Material: Chrome';
}

function toggleDirectionalLight() {
  directionalLightEnabled = !directionalLightEnabled;
  directionalLight.visible = directionalLightEnabled;
  document.getElementById('toggleDirectionalLightBtn').textContent =
    directionalLightEnabled
      ? 'Directional Light: On'
      : 'Directional Light: Off';
}

function increaseLightIntensity() {
  lightIntensity = Math.min(lightIntensity + 0.5, 5); // Max: 5
  directionalLight.intensity = lightIntensity;
  console.log('Light intensity increased to', lightIntensity);
}

function decreaseLightIntensity() {
  lightIntensity = Math.max(lightIntensity - 0.5, 0); // Min: 0
  directionalLight.intensity = lightIntensity;
  console.log('Light intensity decreased to', lightIntensity);
}

function changeLightColor() {
  currentLightColorIndex = (currentLightColorIndex + 1) % lightColors.length;
  directionalLight.color.setHex(lightColors[currentLightColorIndex]);
  const colorNames = ['White', 'Red', 'Green', 'Blue'];
  document.getElementById(
    'changeLightColorBtn'
  ).textContent = `Light Color: ${colorNames[currentLightColorIndex]}`;
}

function toggleJump() {
  jumpEnabled = !jumpEnabled;
  document.getElementById('toggleJumpBtn').textContent = jumpEnabled
    ? 'Jump: On'
    : 'Jump: Off';
}

function toggleRotation() {
  rotationEnabled = !rotationEnabled;
  document.getElementById('toggleRotationBtn').textContent = rotationEnabled
    ? 'Rotation: On'
    : 'Rotation: Off';
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

function loadModel(url) {
  // Clear any previous template model
  if (model) {
    scene.remove(model);
    originalMaterials.clear();
  }
  
  // Note: We don't remove spawned models, as they should persist

  loader = new GLTFLoader();
  loader.load(
    url,
    function (gltf) {
      model = gltf.scene;
      // Hide model initially, will be shown when placed
      model.visible = false;
      // Scale the model appropriately
      model.scale.set(0.1, 0.1, 0.1);
      scene.add(model);

      // Save original materials
      model.traverse((child) => {
        if (child.isMesh) {
          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Store original material
          originalMaterials.set(child, child.material);
          
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.needsUpdate = true;
            if (child.material.map) {
              child.material.map.encoding = THREE.sRGBEncoding;
              child.material.map.flipY = false;
            }
            if (child.material.normalMap) {
              child.material.normalMap.encoding = THREE.LinearEncoding;
            }
            if (child.material.roughnessMap) {
              child.material.roughnessMap.encoding = THREE.LinearEncoding;
            }
            if (child.material.metalnessMap) {
              child.material.metalnessMap.encoding = THREE.LinearEncoding;
            }
          }
        }
      });

      // Apply current material after loading
      setMaterial(currentMaterial);
      console.log('Model loaded successfully:', url);
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
    },
    function (error) {
      console.error('Error loading model:', error);
    }
  );
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

let hitTestSource = null;
let localSpace = null;
let hitTestSourceInitialized = false;

async function initializeHitTestSource() {
  const session = renderer.xr.getSession();
  const viewerSpace = await session.requestReferenceSpace('viewer');
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  localSpace = await session.requestReferenceSpace('local');

  hitTestSourceInitialized = true;

  session.addEventListener('end', () => {
    hitTestSourceInitialized = false;
    hitTestSource = null;
  });
}

function render(timestamp, frame) {
  if (frame) {
    if (!hitTestSourceInitialized) {
      initializeHitTestSource();
    }

    if (hitTestSourceInitialized) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(localSpace);

        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);

        reticle.material.opacity = 0.7 + 0.3 * Math.sin(timestamp * 0.005);
        reticle.material.color.setHSL((timestamp * 0.0005) % 1, 0.7, 0.5);
      } else {
        reticle.visible = false;
      }
    }

    // Animations for the template model
    if (model && model.userData.basePosition) {
      // Jump animation
      if (jumpEnabled) {
        const jumpHeight = 0.1;
        const jumpSpeed = 0.005;
        const offsetY = Math.sin(timestamp * jumpSpeed) * jumpHeight;
        model.position.y = model.userData.basePosition.y + offsetY;
      } else {
        model.position.y = model.userData.basePosition.y;
      }

      // Rotation animation
      if (rotationEnabled) {
        model.rotation.y += 0.01; // Fixed rotation speed
      }
    }
    
    // Apply animations to all spawned models
    spawnedModels.forEach((spawnedModel, index) => {
      if (spawnedModel && spawnedModel.userData.basePosition) {
        // Jump animation with phase offset based on index for variety
        if (jumpEnabled) {
          const jumpHeight = 0.1;
          const jumpSpeed = 0.005;
          const phaseOffset = index * 0.5; // Different phase for each model
          const offsetY = Math.sin((timestamp + phaseOffset) * jumpSpeed) * jumpHeight;
          spawnedModel.position.y = spawnedModel.userData.basePosition.y + offsetY;
        } else {
          spawnedModel.position.y = spawnedModel.userData.basePosition.y;
        }

        // Rotation animation
        if (rotationEnabled) {
          spawnedModel.rotation.y += 0.01; // Fixed rotation speed
        }
      }
    });

    renderer.render(scene, camera);
  }
}
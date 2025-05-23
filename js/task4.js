import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let container;
let camera, scene, renderer;
let reticle;
let controller;
let model;
let spawnedModels = [];
let loader;
let directionalLightEnabled = true;
let jumpEnabled = true;
let rotationEnabled = true;
let directionalLight;
let lightIntensity = 3;
let lightColors = [0xffffff, 0xffaaaa, 0xaaffaa, 0xaaaaff];
let currentLightColorIndex = 0;
let controlsVisible = true;

const materials = {
  realistic: null,
  gold: new THREE.MeshPhysicalMaterial({
    color: 0xffd700,
    metalness: 1.0,
    roughness: 0.15,
    reflectivity: 1.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    ior: 2.5,
    envMapIntensity: 1.5
  }),
  glow: new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 1.5,
    metalness: 0.3,
    roughness: 0.3,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    transparent: true,
    opacity: 0.5,
    metalness: 0.2,
    roughness: 0.05,
    transmission: 0.9,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    ior: 1.5
  }),
  chrome: new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
    envMapIntensity: 2.0
  })
};

const originalMaterials = new Map();
let currentMaterial = 'realistic';

const modelUrl = 'https://manufactura-public.s3.us-east-1.amazonaws.com/musical/scene.gltf';

init();
loadModel(modelUrl);
animate();

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  directionalLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
  directionalLight.position.set(2, 3, 2);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.5);
  hemisphereLight.position.set(0, 1, 0);
  scene.add(hemisphereLight);

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  addReticleToScene();

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

  document.getElementById('materialRealisticBtn').addEventListener('click', () => setMaterial('realistic'));
  document.getElementById('materialGoldBtn').addEventListener('click', () => setMaterial('gold'));
  document.getElementById('materialGlowBtn').addEventListener('click', () => setMaterial('glow'));
  document.getElementById('materialGlassBtn').addEventListener('click', () => setMaterial('glass'));
  document.getElementById('materialChromeBtn').addEventListener('click', () => setMaterial('chrome'));
  document.getElementById('toggleDirectionalLightBtn').addEventListener('click', toggleDirectionalLight);
  document.getElementById('increaseLightIntensityBtn').addEventListener('click', increaseLightIntensity);
  document.getElementById('decreaseLightIntensityBtn').addEventListener('click', decreaseLightIntensity);
  document.getElementById('changeLightColorBtn').addEventListener('click', changeLightColor);
  document.getElementById('toggleJumpBtn').addEventListener('click', toggleJump);
  document.getElementById('toggleRotationBtn').addEventListener('click', toggleRotation);
  document.getElementById('toggleControlsBtn').addEventListener('click', toggleControls);

  window.addEventListener('resize', onWindowResize, false);
}

function updateMaterialButtonStates() {
  const materials = ['Realistic', 'Gold', 'Glow', 'Glass', 'Chrome'];
  materials.forEach(mat => {
    const btn = document.getElementById(`material${mat}Btn`);
    const materialType = mat.toLowerCase();
    btn.textContent = `Material: ${mat}${currentMaterial === materialType ? ' (Active)' : ''}`;
    btn.classList.toggle('active', currentMaterial === materialType);
  });
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
    if (model) {
      const newModel = model.clone();
      newModel.position.setFromMatrixPosition(reticle.matrix);
      newModel.quaternion.setFromRotationMatrix(reticle.matrix);
      newModel.visible = true;
      newModel.scale.set(0.1, 0.1, 0.1);
      newModel.userData.basePosition = newModel.position.clone();
      scene.add(newModel);
      spawnedModels.push(newModel);
      applyMaterialToModel(newModel, currentMaterial);
    }
  }
}

function setMaterial(type) {
  if (!model) return;
  
  currentMaterial = type;
  
  applyMaterialToModel(model, type);
  spawnedModels.forEach(spawnedModel => {
    applyMaterialToModel(spawnedModel, type);
  });

  updateMaterialButtonStates();

  const materialSound = document.getElementById('materialSound');
  if (materialSound) {
    materialSound.currentTime = 0;
    materialSound.play();
  }
}

function applyMaterialToModel(modelInstance, type) {
  if (!modelInstance) return;
  
  modelInstance.scale.set(0.1, 0.1, 0.1);
  
  modelInstance.traverse((child) => {
    if (child.isMesh) {
      if (type === 'realistic') {
        const originalMaterial = originalMaterials.get(child) || originalMaterials.get(findOriginalMesh(child));
        if (originalMaterial) {
          child.material = originalMaterial.clone();
        }
      } else {
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
}

function toggleDirectionalLight() {
  directionalLightEnabled = !directionalLightEnabled;
  directionalLight.visible = directionalLightEnabled;
  document.getElementById('toggleDirectionalLightBtn').textContent = directionalLightEnabled ? 'Directional Light: On' : 'Directional Light: Off';
}

function increaseLightIntensity() {
  lightIntensity = Math.min(lightIntensity + 0.5, 5);
  directionalLight.intensity = lightIntensity;
}

function decreaseLightIntensity() {
  lightIntensity = Math.max(lightIntensity - 0.5, 0);
  directionalLight.intensity = lightIntensity;
}

function changeLightColor() {
  currentLightColorIndex = (currentLightColorIndex + 1) % lightColors.length;
  directionalLight.color.setHex(lightColors[currentLightColorIndex]);
  const colorNames = ['White', 'Red', 'Green', 'Blue'];
  document.getElementById('changeLightColorBtn').textContent = `Light Color: ${colorNames[currentLightColorIndex]}`;
}

function toggleJump() {
  jumpEnabled = !jumpEnabled;
  document.getElementById('toggleJumpBtn').textContent = jumpEnabled ? 'Jump: On' : 'Jump: Off';
}

function toggleRotation() {
  rotationEnabled = !rotationEnabled;
  document.getElementById('toggleRotationBtn').textContent = rotationEnabled ? 'Rotation: On' : 'Rotation: Off';
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
  if (model) {
    scene.remove(model);
    originalMaterials.clear();
  }
  
  loader = new GLTFLoader();
  loader.load(
    url,
    function (gltf) {
      model = gltf.scene;
      model.visible = false;
      model.scale.set(0.1, 0.1, 0.1);
      scene.add(model);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
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

    if (model && model.userData.basePosition) {
      if (jumpEnabled) {
        const jumpHeight = 0.1;
        const jumpSpeed = 0.005;
        const offsetY = Math.sin(timestamp * jumpSpeed) * jumpHeight;
        model.position.y = model.userData.basePosition.y + offsetY;
      } else {
        model.position.y = model.userData.basePosition.y;
      }

      if (rotationEnabled) {
        model.rotation.y += 0.01;
      }
    }
    
    spawnedModels.forEach((spawnedModel, index) => {
      if (spawnedModel && spawnedModel.userData.basePosition) {
        if (jumpEnabled) {
          const jumpHeight = 0.1;
          const jumpSpeed = 0.005;
          const phaseOffset = index * 0.5;
          const offsetY = Math.sin((timestamp + phaseOffset) * jumpSpeed) * jumpHeight;
          spawnedModel.position.y = spawnedModel.userData.basePosition.y + offsetY;
        } else {
          spawnedModel.position.y = spawnedModel.userData.basePosition.y;
        }

        if (rotationEnabled) {
          spawnedModel.rotation.y += 0.01;
        }
      }
    });

    renderer.render(scene, camera);
  }
}
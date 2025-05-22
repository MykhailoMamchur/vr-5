import * as THREE from 'three';

// Check if WebXR is available
document.addEventListener('DOMContentLoaded', () => {
  if ('xr' in navigator) {
    // Check if AR is supported
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      if (!supported) {
        showARSupportMessage(false);
      }
    }).catch(() => {
      showARSupportMessage(false);
    });
  } else {
    showARSupportMessage(false);
  }

  // Set proper page title based on URL
  setPageTitle();
});

function showARSupportMessage(supported) {
  const message = document.createElement('div');
  message.className = 'ar-message';
  
  if (!supported) {
    message.textContent = 'WebXR AR is not supported in your browser. Please try on a compatible device with AR support.';
    document.body.appendChild(message);
  }
}

function setPageTitle() {
  const path = window.location.pathname;
  const titleElement = document.querySelector('title');
  
  if (path.includes('task1')) {
    titleElement.textContent = 'Task 1 - Basic AR Scene';
    document.body.classList.add('ar-mode');
  } else if (path.includes('task2')) {
    titleElement.textContent = 'Task 2 - GLTF Model';
    document.body.classList.add('ar-mode');
  } else if (path.includes('task3')) {
    titleElement.textContent = 'Task 3 - Object Placement';
    document.body.classList.add('ar-mode');
  } else if (path.includes('task4')) {
    titleElement.textContent = 'Task 4 - Model Placement';
    document.body.classList.add('ar-mode');
  } else {
    titleElement.textContent = 'WebXR AR Application';
  }
}
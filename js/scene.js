import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { CONFIG } from './config.js';

/**
 * Менеджер Three.js сцены
 */
export class SceneManager {
  
  constructor(container) {
    this.container = container;
    this._init();
  }
  
  _init() {
    // Сцена
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BACKGROUND);
    this.scene.fog = new THREE.Fog(CONFIG.FOG_COLOR, CONFIG.FOG_NEAR, CONFIG.FOG_FAR);
    
    // Камера
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, CONFIG.CAMERA_DISTANCE);
    
    // Рендерер
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.MAX_PIXEL_RATIO));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);
    
    // Контроллеры
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = CONFIG.MIN_ZOOM;
    this.controls.maxDistance = CONFIG.MAX_ZOOM;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = CONFIG.AUTO_ROTATE_SPEED;
    
    // Свет
    this._addLights();
    
    // Группа для всех текстур
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    // События
    window.addEventListener('resize', () => this._onResize());
  }
  
  _addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 2.2);
    this.scene.add(ambient);
    
    const directional = new THREE.DirectionalLight(0xffffff, 1.4);
    directional.position.set(10, 20, 10);
    this.scene.add(directional);
  }
  
  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  start(renderCallback) {
    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      if (renderCallback) renderCallback();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
  
  add(mesh) {
    this.group.add(mesh);
  }
  
  remove(mesh) {
    this.group.remove(mesh);
  }
  
  getCamera() {
    return this.camera;
  }
  
  getScene() {
    return this.scene;
  }
  
  getGroup() {
    return this.group;
  }
}

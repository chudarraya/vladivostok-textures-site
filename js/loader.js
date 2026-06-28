import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

/**
 * Загрузчик текстур с пакетной обработкой и прогрессом
 */
export class TextureLoader {
  
  constructor(onProgress, onComplete) {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.manager = new THREE.LoadingManager();
    this.textureLoader = new THREE.TextureLoader(this.manager);
    this.loaded = 0;
    this.total = 0;
    this.results = [];
    
    this.manager.onProgress = (url, loaded, total) => {
      this.loaded = loaded;
      this.total = total;
      const percent = Math.round((loaded / total) * 100);
      if (this.onProgress) {
        this.onProgress({ percent, loaded, total });
      }
    };
    
    this.manager.onLoad = () => {
      if (this.onComplete) {
        this.onComplete(this.results);
      }
    };
  }
  
  /**
   * Загружает массив текстур пакетно
   * @param {Array} textures - массив объектов { id, url, category, ... }
   */
  loadBatch(textures) {
    this.results = [];
    let index = 0;
    
    const loadNext = () => {
      const batch = textures.slice(index, index + CONFIG.BATCH_SIZE);
      
      batch.forEach(data => {
        this.textureLoader.load(
          data.url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;
            this.results.push({ ...data, texture });
            this._checkComplete();
          },
          undefined,
          (err) => {
            console.warn(`❌ Не загрузилось: ${data.url}`, err);
            // Создаём плейсхолдер для битых ссылок
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = '#666';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('❌', 128, 140);
            const placeholder = new THREE.CanvasTexture(canvas);
            this.results.push({ ...data, texture: placeholder });
            this._checkComplete();
          }
        );
      });
      
      index += CONFIG.BATCH_SIZE;
      if (index < textures.length) {
        setTimeout(loadNext, CONFIG.BATCH_DELAY);
      }
    };
    
    loadNext();
  }
  
  _checkComplete() {
    if (this.results.length === this.total && this.total > 0) {
      // LoadingManager сам вызовет onLoad
    }
  }
}

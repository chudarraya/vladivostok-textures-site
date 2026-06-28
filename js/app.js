import { SceneManager } from './scene.js';
import { TextureLoader } from './loader.js';
import { CategoryParser } from './parser.js';
import { CONFIG } from './config.js';

// DOM элементы
const els = {
  loader: document.getElementById('loader'),
  progressBar: document.getElementById('progress-bar'),
  progressText: document.getElementById('progress-text'),
  infoPanel: document.getElementById('info-panel'),
  infoClose: document.getElementById('info-close'),
  valCategory: document.getElementById('val-category'),
  valMaterial: document.getElementById('val-material'),
  valDistrict: document.getElementById('val-district'),
  valWhat: document.getElementById('val-what'),
  valId: document.getElementById('val-id'),
  downloadBtn: document.getElementById('download-btn'),
  modeToggle: document.getElementById('mode-toggle'),
  modeIcon: document.getElementById('mode-icon'),
  modeLabel: document.getElementById('mode-label'),
  clusterControls: document.getElementById('cluster-sort-controls'),
  sortBtns: document.querySelectorAll('.sort-btn'),
  modeHint: document.getElementById('mode-hint')
};

// Состояние
const state = {
  scene: null,
  nodes: [],
  connections: [],
  clusterMode: false,
  clusterSort: 'district', // 'district' | 'category'
  selectedNode: null,
  hoveredNode: null
};

// Инициализация
async function init() {
  // 1. Создаём сцену
  state.scene = new SceneManager(document.getElementById('canvas-container'));
  
  // 2. Загружаем данные (в реальном проекте — fetch('./data/textures.json'))
  const textures = await loadTexturesData();
  
  // 3. Настраиваем загрузчик
  const loader = new TextureLoader(
    (progress) => updateProgress(progress),
    (results) => onTexturesLoaded(results)
  );
  loader.loadBatch(textures);
  
  // 4. Запускаем рендер
  state.scene.start(() => onRender());
  
  // 5. Навешиваем события UI
  setupUI();
}

// Загрузка данных (заглушка — заменить на fetch)
async function loadTexturesData() {
  // В реальном проекте:
  // const res = await fetch('./data/textures.json');
  // return await res.json();
  
  // Временная генерация 523 записей для теста
  return Array.from({ length: 523 }, (_, i) => {
    const id = i + 1;
    const fmt = id === 1 ? 'png' : 'JPG';
    const categories = Object.values(CONFIG.PRIMARY_CATEGORIES);
    const districts = Object.keys(CONFIG.DISTRICT_CENTERS);
    return {
      id,
      url: `https://raw.githubusercontent.com/chudarraya/vladivostok-textures/main/1%20(${id}).${fmt}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      material: '',
      district: districts[Math.floor(Math.random() * districts.length)],
      whatIsIt: ''
    };
  });
}

// Обновление прогресс-бара
function updateProgress({ percent, loaded, total }) {
  els.progressBar.style.width = `${percent}%`;
  els.progressText.textContent = `${percent}% (${loaded}/${total})`;
}

// Когда все текстуры загрузились
function onTexturesLoaded(results) {
  // Скрываем лоадер
  setTimeout(() => {
    els.loader.classList.add('hidden');
  }, 300);
  
  // Создаём узлы
  results.forEach(data => {
    const parsed = CategoryParser.parse(data.category);
    const node = createTextureNode(data, parsed);
    state.nodes.push(node);
    state.scene.add(node.mesh);
  });
  
  console.log(`✅ Загружено ${state.nodes.length} текстур`);
}

// Создание 3D-узла текстуры
function createTextureNode(data, parsed) {
  // Вычисляем пропорции (в реальном проекте — из Image)
  const aspect = 1; // заглушка, в реальности: img.width / img.height
  const geometry = new THREE.PlaneGeometry(
    CONFIG.TEXTURE_BASE_SIZE * aspect, 
    CONFIG.TEXTURE_BASE_SIZE
  );
  
  const material = new THREE.MeshBasicMaterial({
    map: data.texture,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  
  // Начальная позиция (хаос)
  const chaosPos = CategoryParser.getRandomPosition();
  mesh.position.copy(chaosPos);
  mesh.lookAt(state.scene.getCamera().position);
  mesh.rotation.z = (Math.random() - 0.5) * 0.5;
  
  // Позиции для кластеров
  const clusterByCategory = CategoryParser.getCategoryPosition(parsed.primary);
  const clusterByDistrict = CategoryParser.getDistrictPosition(data.district);
  
  return {
    mesh,
    data,
    parsed,
    chaosPos,
    clusterByCategory,
    clusterByDistrict,
    targetPos: chaosPos.clone(),
    isAnimating: false
  };
}

// Главный цикл рендера
function onRender() {
  // Анимация перемещения узлов
  state.nodes.forEach(node => {
    if (node.isAnimating) {
      node.mesh.position.lerp(node.targetPos, 0.05);
      if (node.mesh.position.distanceTo(node.targetPos) < 0.1) {
        node.isAnimating = false;
      }
    }
    // Всегда поворачиваем к камере
    node.mesh.lookAt(state.scene.getCamera().position);
  });
  
  // Обновление линий
  updateConnections();
}

// Обновление линий связей
function updateConnections() {
  // Удаляем старые
  state.connections.forEach(conn => {
    state.scene.remove(conn.line);
    conn.line.geometry.dispose();
    conn.line.material.dispose();
  });
  state.connections = [];
  
  if (!state.clusterMode) return;
  
  // Определяем, по какому полю группировать для линий
  const linkBy = state.clusterSort === 'district' ? 'parsed.primary' : 'district';
  
  // Группируем узлы
  const groups = {};
  state.nodes.forEach(node => {
    const key = linkBy === 'district' ? node.data.district : node.parsed.primary;
    if (!groups[key]) groups[key] = [];
    groups[key].push(node);
  });
  
  // Создаём линии внутри групп
  Object.values(groups).forEach(group => {
    if (group.length < 2) return;
    
    group.forEach(node => {
      // Находим 2 ближайших соседа в группе
      const nearest = group
        .filter(n => n !== node)
        .sort((a, b) => 
          node.mesh.position.distanceTo(a.mesh.position) - 
          node.mesh.position.distanceTo(b.mesh.position)
        )
        .slice(0, CONFIG.MAX_CONNECTIONS_PER_NODE);
      
      nearest.forEach(target => {
        const line = createConnectionLine(node.mesh, target.mesh);
        state.connections.push({ line, node, target });
        state.scene.add(line);
      });
    });
  });
}

// Создание линии между двумя мешами
function createConnectionLine(mesh1, mesh2) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    mesh1.position.clone(),
    mesh2.position.clone()
  ]);
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    opacity: CONFIG.CONNECTION_OPACITY,
    transparent: true
  });
  return new THREE.Line(geometry, material);
}

// Настройка UI событий
function setupUI() {
  // Переключение режима кластеров
  els.modeToggle.addEventListener('click', toggleClusterMode);
  
  // Переключение сортировки
  els.sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.clusterMode) return;
      els.sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.clusterSort = btn.dataset.sort;
      animateToCluster();
    });
  });
  
  // Подсказка при наведении
  els.modeToggle.addEventListener('mouseenter', () => {
    els.modeHint.classList.remove('hidden');
    els.modeHint.classList.add('visible');
  });
  els.modeToggle.addEventListener('mouseleave', () => {
    els.modeHint.classList.remove('visible');
    setTimeout(() => els.modeHint.classList.add('hidden'), 400);
  });
  
  // Инфо-панель
  els.infoClose.addEventListener('click', () => {
    els.infoPanel.classList.remove('visible');
    els.downloadBtn.style.display = 'none';
    state.selectedNode = null;
    state.scene.controls.autoRotate = true;
    resetAllNodes();
  });
  
  // Клик по сцене
  const canvas = state.scene.renderer.domElement;
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMouseMove);
  
  // ESC для закрытия
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selectedNode) {
      els.infoClose.click();
    }
  });
}

// Переключение режима кластеров
function toggleClusterMode() {
  state.clusterMode = !state.clusterMode;
  
  if (state.clusterMode) {
    els.modeToggle.classList.add('active');
    els.modeIcon.textContent = '📦';
    els.modeLabel.textContent = 'Архив';
    els.clusterControls.classList.remove('hidden');
    els.clusterControls.classList.add('visible');
    animateToCluster();
  } else {
    els.modeToggle.classList.remove('active');
    els.modeIcon.textContent = '🗺️';
    els.modeLabel.textContent = 'Кластеры';
    els.clusterControls.classList.remove('visible');
    els.clusterControls.classList.add('hidden');
    animateToChaos();
  }
}

// Анимация перехода в кластеры
function animateToCluster() {
  state.nodes.forEach((node, i) => {
    const target = state.clusterSort === 'district' 
      ? node.clusterByDistrict 
      : node.clusterByCategory;
    
    node.targetPos.copy(target);
    node.isAnimating = true;
  });
  
  // Линии перерисуем после анимации
  setTimeout(updateConnections, CONFIG.ANIMATION_DURATION + 200);
}

// Анимация возврата в хаос
function animateToChaos() {
  state.nodes.forEach((node, i) => {
    node.targetPos.copy(node.chaosPos);
    node.isAnimating = true;
  });
  
  // Удаляем линии
  setTimeout(() => {
    state.connections.forEach(conn => {
      state.scene.remove(conn.line);
      conn.line.geometry.dispose();
      conn.line.material.dispose();
    });
    state.connections = [];
  }, CONFIG.ANIMATION_DURATION);
}

// Сброс всех узлов
function resetAllNodes() {
  state.nodes.forEach(node => {
    node.mesh.scale.set(1, 1, 1);
    node.mesh.material.opacity = 1;
  });
}

// Raycaster для кликов
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function updateMouse(event) {
  const rect = state.scene.renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onClick(event) {
  // Игнорируем клики по UI
  if (event.target.closest('#info-panel') || 
      event.target.closest('#mode-toggle') ||
      event.target.closest('#cluster-sort-controls')) {
    return;
  }
  
  updateMouse(event);
  raycaster.setFromCamera(mouse, state.scene.getCamera());
  const intersects = raycaster.intersectObjects(
    state.nodes.map(n => n.mesh)
  );
  
  if (intersects.length > 0) {
    const node = state.nodes.find(n => n.mesh === intersects[0].object);
    if (node) selectNode(node);
  } else {
    els.infoClose.click();
  }
}

function onMouseMove(event) {
  updateMouse(event);
  raycaster.setFromCamera(mouse, state.scene.getCamera());
  const intersects = raycaster.intersectObjects(
    state.nodes.map(n => n.mesh)
  );
  
  // Сброс ховера
  state.nodes.forEach(node => {
    if (node !== state.selectedNode) {
      node.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      node.mesh.material.opacity = THREE.MathUtils.lerp(
        node.mesh.material.opacity, 1, 0.1
      );
    }
  });
  
  if (intersects.length > 0) {
    const node = state.nodes.find(n => n.mesh === intersects[0].object);
    if (node && node !== state.selectedNode) {
      node.mesh.scale.lerp(new THREE.Vector3(1.22, 1.22, 1.22), 0.15);
      state.scene.container.style.cursor = 'pointer';
    }
  } else {
    state.scene.container.style.cursor = 'grab';
  }
}

// Выбор узла и показ инфо-панели
function selectNode(node) {
  // Сброс предыдущего
  if (state.selectedNode) {
    state.selectedNode.mesh.scale.set(1, 1, 1);
  }
  
  // Выделяем новый
  state.selectedNode = node;
  node.mesh.scale.set(CONFIG.FOCUS_SCALE, CONFIG.FOCUS_SCALE, CONFIG.FOCUS_SCALE);
  node.mesh.material.opacity = 1;
  
  // Затемняем остальные
  state.nodes.forEach(n => {
    if (n !== node) n.mesh.material.opacity = CONFIG.DIM_OPACITY;
  });
  
  // Заполняем панель
  els.valCategory.textContent = node.parsed.raw;
  els.valMaterial.textContent = node.data.material || '—';
  els.valDistrict.textContent = node.data.district || '—';
  els.valWhat.textContent = node.data.whatIsIt || '—';
  els.valId.textContent = `#${String(node.data.id).padStart(3, '0')}`;
  
  // Настраиваем кнопку скачивания
  els.downloadBtn.href = node.data.url;
  els.downloadBtn.download = `VDK_${String(node.data.id).padStart(3, '0')}_${node.parsed.primary.toLowerCase().replace(/[^a-zа-яё0-9]/g, '_')}.jpg`;
  els.downloadBtn.style.display = 'inline-flex';
  
  // Показываем панель
  els.infoPanel.classList.add('visible');
  
  // Останавливаем авто-вращение
  state.scene.controls.autoRotate = false;
}

// Запуск
init();

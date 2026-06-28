import { CONFIG } from './config.js';

/**
 * Парсер категорий: исправляет опечатки и выделяет основную категорию
 */
export class CategoryParser {
  
  /**
   * Нормализует сырую строку категории
   * @param {string} raw - исходная строка из JSON
   * @returns {object} { raw, primary, all: [] }
   */
  static parse(raw) {
    if (!raw || typeof raw !== 'string') {
      return { raw: '', primary: 'РАЗНОЕ', all: ['РАЗНОЕ'] };
    }
    
    // 1. Исправляем опечатки
    let cleaned = raw.trim();
    for (const [typo, fix] of Object.entries(CONFIG.TYPO_FIXES)) {
      cleaned = cleaned.replace(new RegExp(typo, 'gi'), fix);
    }
    
    // 2. Унифицируем разделители: | , пробелы → запятая+пробел
    cleaned = cleaned.replace(/[\|\s]+/g, ', ').replace(/,\s*,/g, ',').trim();
    
    // 3. Разбиваем на части и фильтруем пустые
    const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length === 0) {
      return { raw: cleaned, primary: 'РАЗНОЕ', all: ['РАЗНОЕ'] };
    }
    
    // 4. Берём первую часть как основную (для кластеризации)
    let primary = parts[0];
    
    // 5. Если основная не в списке канонических — ищем совпадение
    if (!CONFIG.PRIMARY_CATEGORIES.includes(primary)) {
      const found = CONFIG.PRIMARY_CATEGORIES.find(cat => 
        primary.includes(cat) || cat.includes(primary)
      );
      if (found) primary = found;
      else primary = 'РАЗНОЕ';
    }
    
    // 6. Собираем все валидные категории
    const all = parts
      .map(p => {
        // Проверяем точное совпадение
        if (CONFIG.PRIMARY_CATEGORIES.includes(p)) return p;
        // Проверяем частичное совпадение
        const found = CONFIG.PRIMARY_CATEGORIES.find(cat => 
          p.includes(cat) || cat.includes(p)
        );
        return found || null;
      })
      .filter(Boolean);
    
    if (all.length === 0) all.push('РАЗНОЕ');
    
    return {
      raw: cleaned,
      primary,
      all: [...new Set(all)] // убираем дубликаты
    };
  }
  
  /**
   * Получает позицию для кластера по категории
   */
  static getCategoryPosition(category, index = 0) {
    const catIndex = CONFIG.PRIMARY_CATEGORIES.indexOf(category);
    if (catIndex === -1) return { x: 0, y: 0, z: 0 };
    
    const angle = (catIndex / CONFIG.PRIMARY_CATEGORIES.length) * Math.PI * 2;
    const spread = CONFIG.CLUSTER_SPREAD_XZ;
    const height = CONFIG.CLUSTER_SPREAD_Y;
    
    return {
      x: Math.cos(angle) * CONFIG.CATEGORY_CIRCLE_RADIUS + (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * height,
      z: Math.sin(angle) * CONFIG.CATEGORY_CIRCLE_RADIUS + (Math.random() - 0.5) * spread
    };
  }
  
  /**
   * Получает позицию для кластера по району
   */
  static getDistrictPosition(district) {
    const center = CONFIG.DISTRICT_CENTERS[district] || { x: 0, y: 0, z: 0 };
    const spread = CONFIG.CLUSTER_RADIUS;
    
    return {
      x: center.x + (Math.random() - 0.5) * spread * 2,
      y: center.y + (Math.random() - 0.5) * CONFIG.CLUSTER_SPREAD_Y,
      z: center.z + (Math.random() - 0.5) * spread * 2
    };
  }
  
  /**
   * Получает случайную позицию для режима "хаос"
   */
  static getRandomPosition() {
    const r = 20;
    return {
      x: (Math.random() - 0.5) * r * 2,
      y: (Math.random() - 0.5) * 15,
      z: (Math.random() - 0.5) * r * 2
    };
  }
}

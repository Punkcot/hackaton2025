/**
 * @file: main.js
 * @description: Основной JavaScript файл для веб-приложения ЮТэйр с интеграцией карты
 * @dependencies: Яндекс.Карты API 2.1
 * @created: 2025-09-16
 */

// Конфигурация приложения
const CONFIG = {
    map: {
        center: [58.0, 65.0], // Центр России (между основными хабами) [широта, долгота]
        zoom: 5,
        minZoom: 3,
        maxZoom: 18
    },
    // Реальные данные маршрутной сети ЮТэйр будут загружены из JSON
    cities: {},
    routes: [],
    mainHubs: ['СУР', 'МОВ', 'УФА'] // Основные хабы ЮТэйр
};

// Глобальные переменные
let yandexMap;
let routeLines = [];
let markers = [];
let objectManager;

    /**
     * Инициализация приложения
     */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Инициализация приложения ЮТэйр');
    
    // Ждем загрузки Яндекс.Карты API
    ymaps.ready(function() {
        console.log('🗺️ Яндекс.Карты API загружен');
        
        // Проверяем наличие расширенных данных
        if (typeof UTAIR_DATA_EXTENDED !== 'undefined') {
            console.log('📊 Используем расширенные данные маршрутов (все города)');
            loadExtendedData();
        } else if (typeof UTAIR_DATA !== 'undefined') {
            console.log('📊 Используем базовые встроенные данные маршрутов');
            loadEmbeddedData();
        } else {
            console.log('📥 Загружаем данные из JSON файла');
            loadRouteData().catch(error => {
                console.error('❌ Ошибка загрузки данных:', error);
            });
        }
        
        // Инициализируем карту после небольшой задержки, чтобы данные успели загрузиться
        setTimeout(() => {
            initializeMap();
            bindEventListeners();
            console.log('✅ Приложение успешно загружено');
        }, 100);
    });
});

/**
 * Загрузка данных маршрутной сети из JSON файла
 */
async function loadRouteData() {
    console.log('📊 Загрузка данных маршрутной сети...');
    
    try {
        const response = await fetch('utair_routes.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
        const data = await response.json();
        
        // Обновляем конфигурацию
        CONFIG.cities = data.cities;
        CONFIG.routes = data.routes;
        
        console.log(`✅ Загружено ${data.routes.length} маршрутов для ${Object.keys(data.cities).length} городов`);
        console.log(`📈 Статистика: всего рейсов - ${data.routes.reduce((sum, route) => sum + route.flights, 0)}`);
        console.log('🏙️ Города:', Object.keys(data.cities));
        console.log('🛫 Первые 3 маршрута:', data.routes.slice(0, 3));
        
        // Обновляем статистику на странице
        updateStatistics(data);
        
        return data;
    } catch (error) {
        console.error('❌ Ошибка загрузки маршрутных данных:', error);
        throw error;
    }
}

/**
 * Загрузка встроенных данных маршрутной сети
 */
function loadEmbeddedData() {
    console.log('📊 Загрузка встроенных данных маршрутной сети...');
    
    try {
        // Обновляем конфигурацию
        CONFIG.cities = UTAIR_DATA.cities;
        CONFIG.routes = UTAIR_DATA.routes;
        
        console.log(`✅ Загружено ${UTAIR_DATA.routes.length} маршрутов для ${Object.keys(UTAIR_DATA.cities).length} городов`);
        console.log(`📈 Статистика: всего рейсов - ${UTAIR_DATA.routes.reduce((sum, route) => sum + route.flights, 0)}`);
        console.log('🏙️ Города:', Object.keys(UTAIR_DATA.cities));
        console.log('🛫 Первые 3 маршрута:', UTAIR_DATA.routes.slice(0, 3));
        
        // Обновляем статистику на странице
        updateStatistics(UTAIR_DATA);
        
        console.log('✅ Встроенные данные успешно загружены');
    } catch (error) {
        console.error('❌ Ошибка загрузки встроенных данных:', error);
    }
}

/**
 * Загрузка расширенных данных маршрутной сети (все города)
 */
function loadExtendedData() {
    console.log('🌍 Загрузка расширенных данных маршрутной сети...');
    
    try {
        // Обновляем конфигурацию
        CONFIG.cities = UTAIR_DATA_EXTENDED.cities;
        CONFIG.routes = UTAIR_DATA_EXTENDED.routes;
        
        console.log(`✅ Загружено ${UTAIR_DATA_EXTENDED.routes.length} маршрутов для ${Object.keys(UTAIR_DATA_EXTENDED.cities).length} городов`);
        console.log(`📈 Статистика: всего рейсов - ${UTAIR_DATA_EXTENDED.routes.reduce((sum, route) => sum + route.flights, 0)}`);
        console.log('🏙️ Основные хабы:', UTAIR_DATA_EXTENDED.stats.main_hubs);
        console.log('🌐 География: от России до Турции и ОАЭ');
        
        // Обновляем статистику на странице
        updateStatistics(UTAIR_DATA_EXTENDED);
        
        console.log('✅ Расширенные данные успешно загружены');
    } catch (error) {
        console.error('❌ Ошибка загрузки расширенных данных:', error);
    }
}

/**
 * Инициализация карты
 */
function initializeMap() {
    console.log('🗺️ Инициализация Яндекс.Карты...');
    
    try {
        // Создание карты
        yandexMap = new ymaps.Map('mapContainer', {
            center: CONFIG.map.center,
            zoom: CONFIG.map.zoom,
            controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
        }, {
            minZoom: CONFIG.map.minZoom,
            maxZoom: CONFIG.map.maxZoom
        });

        // Создание менеджера объектов для маркеров
        objectManager = new ymaps.ObjectManager({
            clusterize: true,
            gridSize: 64,
            clusterDisableClickZoom: false
        });

        // Добавление менеджера объектов на карту
        yandexMap.geoObjects.add(objectManager);

        // Добавление маркеров аэропортов
        addAirportMarkers();
        
        // Добавление маршрутов
        addRoutes();

        console.log('✅ Яндекс.Карта успешно инициализирована');
        
    } catch (error) {
        console.error('❌ Ошибка при инициализации карты:', error);
        showErrorMessage('Не удалось загрузить карту. Проверьте подключение к интернету.');
    }
}

/**
 * Добавление маркеров аэропортов
 */
function addAirportMarkers() {
    console.log('✈️ Добавление маркеров аэропортов...');
    
    if (Object.keys(CONFIG.cities).length === 0) {
        console.log('⚠️ Данные о городах не загружены, пропускаем добавление маркеров');
        return;
    }
    
    console.log(`🏙️ Найдено ${Object.keys(CONFIG.cities).length} городов для отображения`);

    // Подсчет количества маршрутов для каждого города
    const cityStats = {};
    CONFIG.routes.forEach(route => {
        const fromCity = findCityByCoords(route.from);
        const toCity = findCityByCoords(route.to);
        
        if (fromCity) {
            cityStats[fromCity.code] = (cityStats[fromCity.code] || 0) + route.flights;
        }
        if (toCity) {
            cityStats[toCity.code] = (cityStats[toCity.code] || 0) + route.flights;
        }
    });

    // Создание коллекции объектов для маркеров
    const features = [];

    // Создание маркеров для каждого города
    Object.entries(CONFIG.cities).forEach(([cityCode, cityData], index) => {
        const isHub = CONFIG.mainHubs.includes(cityCode);
        const flightCount = cityStats[cityCode] || 0;
        
        // Создание объекта маркера
        const feature = {
            type: 'Feature',
            id: index,
            geometry: {
                type: 'Point',
                coordinates: [cityData.coords[0], cityData.coords[1]] // Яндекс использует [широта, долгота]
            },
            properties: {
                balloonContentHeader: cityData.name,
                balloonContentBody: `
                    <strong>${isHub ? 'Основной хаб' : 'Аэропорт'} ЮТэйр</strong><br>
                    Код: ${cityCode}<br>
                    Рейсов: ${flightCount}
                `,
                balloonContentFooter: `Координаты: ${cityData.coords[0].toFixed(4)}, ${cityData.coords[1].toFixed(4)}`,
                clusterCaption: cityData.name,
                hintContent: cityData.name,
                iconContent: isHub ? '🏢' : '✈️'
            },
            options: {
                preset: 'islands#blueIcon',
                iconColor: isHub ? '#004499' : '#0066CC'
            }
        };
        
        features.push(feature);
        markers.push(feature);
    });

    // Добавление маркеров в менеджер объектов
    const collection = {
        type: 'FeatureCollection',
        features: features
    };
    
    console.log('📍 Добавляемые маркеры:', collection);
    objectManager.add(collection);

    console.log(`✅ Добавлено ${Object.keys(CONFIG.cities).length} маркеров аэропортов`);
}

/**
 * Поиск города по координатам
 */
function findCityByCoords(coords) {
    for (const [code, cityData] of Object.entries(CONFIG.cities)) {
        if (Math.abs(cityData.coords[0] - coords[0]) < 0.01 && 
            Math.abs(cityData.coords[1] - coords[1]) < 0.01) {
            return { code, ...cityData };
        }
    }
    return null;
}

/**
 * Добавление маршрутов на карту
 */
function addRoutes() {
    console.log('🛫 Добавление маршрутов...');
    
    if (CONFIG.routes.length === 0) {
        console.log('⚠️ Данные о маршрутах не загружены, пропускаем добавление маршрутов');
        return;
    }
    
    console.log(`🗺️ Найдено ${CONFIG.routes.length} маршрутов для отображения`);
    
    // Сортируем маршруты по количеству рейсов (самые загруженные - толще)
    const sortedRoutes = [...CONFIG.routes].sort((a, b) => b.flights - a.flights);
    
    sortedRoutes.forEach((route, index) => {
        // Определяем толщину линии в зависимости от количества рейсов
        const weight = Math.min(2 + Math.log(route.flights), 8);
        const opacity = Math.min(0.5 + route.flights / 100, 0.9);
        
        // Цвет зависит от интенсивности маршрута
        const color = route.flights > 30 ? '#004499' : 
                     route.flights > 15 ? '#0066CC' : '#3399FF';
        
        // Создание плавной линии маршрута
        let pathCoords;
        if (route.path && route.path.length > 2) {
            // Используем плавный путь, если он есть
            pathCoords = route.path.map(point => [point[0], point[1]]);
        } else {
            // Создаем простую линию, если плавного пути нет
            pathCoords = [
                [route.from[0], route.from[1]],  // Начальная точка
                [route.to[0], route.to[1]]       // Конечная точка
            ];
        }
        
        const routeLine = new ymaps.Polyline(pathCoords, {
            balloonContentHeader: route.name,
            balloonContentBody: `<strong>Рейсов в неделю: ${route.flights}</strong>`,
            balloonContentFooter: `Код маршрута: ${route.code}<br>Маршрут #${index + 1} из ${sortedRoutes.length}`,
            hintContent: route.name
        }, {
            strokeColor: color,
            strokeWidth: weight,
            strokeOpacity: opacity,
            strokeStyle: route.flights > 20 ? 'solid' : 'dash' // Сплошные линии для основных маршрутов
        });

        // Добавление маршрута на карту
        console.log(`🛫 Добавляем маршрут: ${route.name}`, routeLine);
        yandexMap.geoObjects.add(routeLine);
        routeLines.push(routeLine);
    });

    console.log(`✅ Добавлено ${CONFIG.routes.length} маршрутов`);
    console.log(`📊 Самый загруженный: ${sortedRoutes[0]?.name} (${sortedRoutes[0]?.flights} рейсов)`);
}

/**
 * Привязка обработчиков событий
 */
function bindEventListeners() {
    console.log('🔗 Привязка обработчиков событий...');
    
    // Кнопка "Показать все маршруты"
    const showAllRoutesBtn = document.getElementById('showAllRoutes');
    if (showAllRoutesBtn) {
        showAllRoutesBtn.addEventListener('click', showAllRoutes);
    }

    // Кнопка "Сбросить вид"
    const resetViewBtn = document.getElementById('resetView');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', resetMapView);
    }

    // Плавная прокрутка для навигации
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    console.log('✅ Обработчики событий успешно привязаны');
}

/**
 * Показать все маршруты (подогнать карту под все маркеры)
 */
function showAllRoutes() {
    console.log('🔍 Показ всех маршрутов...');
    
    if (markers.length > 0) {
        // Создаем массив координат всех маркеров
        const bounds = [];
        markers.forEach(marker => {
            if (marker.geometry && marker.geometry.coordinates) {
                bounds.push(marker.geometry.coordinates);
            }
        });
        
        if (bounds.length > 0) {
            yandexMap.setBounds(yandexMap.geoObjects.getBounds(), {
                checkZoomRange: true,
                zoomMargin: 50
            });
            console.log('✅ Карта подогнана под все маршруты');
        }
        }
    }

    /**
 * Сброс вида карты к начальному состоянию
 */
function resetMapView() {
    console.log('🔄 Сброс вида карты...');
    
    yandexMap.setCenter(CONFIG.map.center, CONFIG.map.zoom);
    console.log('✅ Вид карты сброшен');
}

/**
 * Показ сообщения об ошибке
 */
function showErrorMessage(message) {
    console.error('❌ Ошибка:', message);
    
    const mapContainer = document.getElementById('mapContainer');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                background-color: #f5f5f5;
                color: #666;
                text-align: center;
                font-family: Inter, sans-serif;
            ">
                <div>
                    <h3 style="color: #0066CC; margin-bottom: 15px;">Ошибка загрузки карты</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" style="
                        margin-top: 15px;
                        padding: 10px 20px;
                        background-color: #0066CC;
            color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Обновить страницу</button>
                </div>
            </div>
        `;
    }
    }

    /**
     * Обработка изменения размера окна
     */
window.addEventListener('resize', function() {
    if (yandexMap) {
        setTimeout(() => {
            yandexMap.container.fitToViewport();
            console.log('🔄 Размер карты обновлен');
        }, 100);
    }
});

/**
 * Обновление статистики на странице
 */
function updateStatistics(data) {
    console.log('📊 Обновление статистики на странице...');
    
    const routeCount = document.getElementById('routeCount');
    const cityCount = document.getElementById('cityCount');
    const flightCount = document.getElementById('flightCount');
    
    if (routeCount) {
        routeCount.textContent = data.routes.length;
    }
    
    if (cityCount) {
        cityCount.textContent = Object.keys(data.cities).length;
    }
    
    if (flightCount) {
        const totalFlights = data.routes.reduce((sum, route) => sum + route.flights, 0);
        flightCount.textContent = totalFlights;
    }
    
    console.log('✅ Статистика обновлена');
}

// Экспорт функций для глобального доступа (если необходимо)
window.UtairApp = {
    showAllRoutes,
    resetMapView,
    updateStatistics,
    map: () => yandexMap,
    config: () => CONFIG
};

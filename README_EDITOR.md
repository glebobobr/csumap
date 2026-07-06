# Editor (React-less MapLibre Editor)

Встроенный редактор объектов кампуса на чистом JS (без React/Vue).
Доступен по `/src/editor/editor.html`, авторизация по паролю (JWT).

---

## Архитектура

```
editor.html  ←  editor.js  ←  SaveService.js  ←  client.ts (API)
                              SyncService.js   ←  BroadcastChannel
                              EditorStore.js   ←  EventBus
                              FeatureStore.js  ←  localStorage
                              tools/
                                properties.js  ←  панель свойств
                                toolbar.js     ←  тулбар инструментов
                              store/
                                undo-redo.js   ←  история (30 шагов)
```

### editor.js
Главный модуль: создаёт карту, инициализирует mapbox-gl-draw,
загружает данные, обрабатывает Apply/Delete/Undo/Copy.

### SaveService.js
Асинхронное сохранение всех объектов в Draw через API.
Умеет:
- пропускать фичи, удалённые из Draw во время save (race condition)
- пересоздавать (DELETE+CREATE) при смене слоя (`_savedLayer`)
- чистить `serverId` при ошибке updateFeature (следующий save → POST вместо PUT)

### SyncService.js
BroadcastChannel-обёртка для канала `csumap:sync`.
Сигналы: `published`, `draft-saved`.
Главная страница слушает `published` и вызывает `refreshMapData()`.

### EditorStore.js
Простой EventBus. Хранит `dirty` флаг, оповещает подписчиков при изменении.

### FeatureStore.js
Резервное сохранение/загрузка в localStorage (если сервер недоступен).

---

## Слой-логика (getLayerForFeature)

```js
function getLayerForFeature(feature) {
  // 1. Явный выбор пользователем — свойство _layer
  if (props._layer) return props._layer

  // 2. Polygon → complex / buildings / zones
  // 3. LineString → roads
  // 4. Point → poi
}
```

### Типы зданий (buildings)
`academic`, `dormitory`, `library`, `sports`, `admin`, `canteen`, `utility`, `passage`

### Типы зон (zones)
`garden`, `lawn`, `parking`, `sports-ground`, `construction`

### Явный слой (свойство `_layer`)
Пользователь может выбрать в панели свойств: **авто / здание / зона / комплекс**.
Если выбран не "авто" — `_layer` сохраняется в properties и переопределяет `getLayerForFeature` во всех модулях (editor.js, main.js, SaveService.js).

---

## Поток данных

### Создание объекта
1. Пользователь рисует полигон/линию/точку
2. `draw.create` → фигура в Draw, **но не сохраняется на сервер**
3. Пользователь заполняет свойства (имя, тип, этажи, слой)
4. Apply → `safeSetProp()` обновляет свойства в Draw
5. Save → `saveAll()` → `createFeature()` → POST /api/v1/admin/layers/{layer}/features
6. В ответе приходит `result.id` → `Draw.setFeatureProperty(feature.id, 'serverId', result.id)`

### Обновление существующего
1. Пользователь меняет свойства / геометрию
2. Apply → `saveAll()` → `updateFeature(props.serverId, body)` → PUT

### Смена слоя
Если изменился слой (например, был `zones` → стал `buildings`):
1. `_savedLayer !== layerId` → `deleteFeature(oldServerId) + createFeature(newLayer, body)`
2. Новый `result.id` сохраняется как `serverId`

---

## Известные проблемы и фиксы

### 1. 400 Bad Request на создание фичи
**Причина**: `featureToRequest()` передавал `feature.id` (число) как `feature_id`, Go структура `CreateFeatureRequest.FeatureID` — `*string`, JSON-декодер отклоняет число.

**Фикс**: `editor.js:274` — `String(isNew ? feature.id : props.serverId)`

### 2. 400 Bad Request при serverId == null (после ошибки update)
**Причина**: `serverId` очищался (`null`), при следующем save `feature_id` = `null` в JSON.

**Фикс**: `SaveService.js:46,105` — `String(isNew ? feature.id : props.serverId)`. Если `serverId === null`, `String(null)` = `"null"` → POST.

### 3. Объекты без 3D (нет экструзии)
**Причина**: `draw.create` вызывал `saveAll()` до того, как пользователь выбрал категорию. `type === ''` → `getLayerForFeature()` возвращал `'zones'` → объект сохранялся в слой `zones` (без `fill-extrusion` на главной). Apply → UPDATE не меняет слой.

**Фикс**:
- Убрали `saveAll()` из `draw.create` — первый save происходит только при Apply
- `saveAll()` отслеживает `_savedLayer` — при смене слоя DELETE + CREATE (миграция)
- Явное свойство `_layer` для принудительного указания слоя

### 4. Sync: главная страница не обновляется после публикации
**Решение**: BroadcastChannel `csumap:sync` + `window.addEventListener('focus', ...)` как fallback.
- `SyncService.onEvent('published', () => refreshMapData())`
- При фокусе вкладки — `refreshMapData()` (для случаев, когда BroadcastChannel не сработал)
- `source.setData()` вместо `location.reload()` для плавного обновления

### 5. Race condition: фича удалена во время saveAll
**Фикс**: `SaveService.js:36` — проверка `this._draw.get(feature.id)` перед отправкой.
**Фикс**: `SaveService.js:62` — try/catch вокруг `setFeatureProperty`.

### 6. Duplicate serverId
**Проблема**: при быстром рисовании/удалении/отмене нескольким Draw id присваивается одинаковый `serverId`.
**Статус**: не исправлено. Возникает, когда фича удалена из Draw до того, как `createFeature` вернул `result.id`, затем создана заново (новый Draw id), а старый `result.id` присваивается ей.

---

## MapLibre слои на главной странице

| Слой | Геометрия | 3D (fill-extrusion) | Источник |
|------|-----------|---------------------|----------|
| buildings | Polygon | ✅ Да | API / static |
| complex | Polygon | ✅ Да (через processBuildingsToFeatures) | API / static |
| zones | Polygon | ❌ Нет | API / static |
| roads | LineString | ❌ Нет | API / static |
| poi | Point | ❌ Нет | API / static |
| territory | Polygon | ❌ Нет | Static only |

3D экструзия считается из свойств: `levels` (этажи) × `floor_height` (высота этажа) + `base_height`.

---

## Разработка

```bash
# Собрать и перезапустить
docker compose up -d --build

# Только фронтенд (перед сборкой Go не менять)
# После npm test → docker compose up -d --build
npm test

# Применить миграции БД
docker compose exec app ./migrate -direction=up

# Прямой SQL
docker compose exec db psql -U postgres -d csumap
```

**Важно**: после каждого `docker compose up -d --build` нужен **Ctrl+F5** в браузере (жесткий сброс кэша).

---

## Тесты

```bash
npm test
```

Покрытие:
- `SyncService.test.js` — 8 тестов (BroadcastChannel, sendEvent, onEvent)
- `EditorStore.test.js` — 10 тестов (subscribe, notify, markDirty, error handling)
- `client.test.js` — 15 тестов (fetchLayers, auth, error handling)

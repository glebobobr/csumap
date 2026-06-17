# Go Backend for CSUMAP

Миграция Node.js (Express) бэкенда на Go для картографического проекта CSUMAP (MapLibre + PostGIS).

## Стек

| Компонент | Технология |
|-----------|-----------|
| Язык | Go 1.23 |
| HTTP роутер | chi/v5 |
| База данных | PostgreSQL 16 + PostGIS |
| Драйвер БД | pgx/v5 |
| Кэш тайлов | Redis (опционально) |
| Авторизация | JWT |
| Логирование | zap |
| Конфиг | viper (env + yaml) |
| Метрики | Prometheus |

---

## Быстрый старт

### 1. Требования

- Go 1.23+
- PostgreSQL 16 + PostGIS (локально или в WSL/Docker)
- Redis (опционально, для кэша тайлов)

### 2. Локальный запуск (Windows)

```powershell
# PostgreSQL уже запущен как служба Windows
# Проверка:
Get-Service postgresql*

# Создать базу (если ещё нет):
$env:PGPASSWORD="postgres"
psql -U postgres -c "CREATE DATABASE IF NOT EXISTS csumap;"

# Применить миграции:
$env:PGPASSWORD="postgres"
psql -U postgres -d csumap -f migrations\001_init_postgis.sql
psql -U postgres -d csumap -f migrations\002_create_layers.sql
psql -U postgres -d csumap -f migrations\003_create_features.sql

# Импортировать данные из GeoJSON (через Node.js скрипт):
npm run migrate

# Собрать и запустить Go сервер:
go build -o csumap.exe .\cmd\server
.\csumap.exe
```

Сервер запустится на `http://localhost:8080`.

### 3. Запуск через Docker

```bash
docker compose up -d
```

Поднимутся три контейнера:
- `db` — PostgreSQL + PostGIS
- `redis` — Redis для кэша
- `app` — Go приложение

### 4. Запуск на Linux / WSL

#### Установка PostgreSQL + PostGIS

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib postgis

sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE csumap OWNER postgres;"
sudo -u postgres psql -c "ALTER USER postgres WITH SUPERUSER;"

# Включить PostGIS
sudo -u postgres psql -d csumap -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d csumap -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

#### Сборка и запуск Go сервера

```bash
# Склонировать проект
cd ~/csumap

# Применить миграции
sudo -u postgres psql -d csumap -f migrations/001_init_postgis.sql
sudo -u postgres psql -d csumap -f migrations/002_create_layers.sql
sudo -u postgres psql -d csumap -f migrations/003_create_features.sql

# Собрать
go build -o ./bin/csumap ./cmd/server

# Запустить
./bin/csumap
```

Или через конфиг-файл:

```bash
# Отредактировать config.yaml под свой окружение
# Затем запустить:
./bin/csumap
```

---

## API Endpoints

После запуска сервер доступен на `http://localhost:8080`.

### Публичные endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus метрики |
| `GET` | `/tiles/{layer}/{z}/{x}/{y}.mvt` | MVT векторный тайл |
| `GET` | `/tiles/{layer}/{z}/{x}/{y}.pbf` | MVT тайл (альтернативный формат) |
| `GET` | `/api/v1/layers` | Список слоёв |
| `GET` | `/api/v1/layers/{layerID}` | Информация о слое |
| `GET` | `/api/v1/layers/{layerID}/features` | GeoJSON фичи в bbox |
| `GET` | `/api/v1/features/{id}` | Одна фича по ID |
| `GET` | `/api/v1/tilejson/{layer}` | TileJSON для MapLibre |

### Защищённые endpoints (требуют JWT)

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/v1/layers` | Создать слой |
| `PUT` | `/api/v1/layers/{layerID}` | Обновить слой |
| `DELETE` | `/api/v1/layers/{layerID}` | Удалить слой |
| `POST` | `/api/v1/layers/{layerID}/features` | Создать фичу |
| `PUT` | `/api/v1/features/{id}` | Обновить фичу |
| `DELETE` | `/api/v1/features/{id}` | Удалить фичу |
| `POST` | `/api/v1/layers/{layerID}/features/replace` | Заменить все фичи слоя |
| `POST` | `/api/v1/layers/{layerID}/import` | Импорт GeoJSON |
| `GET` | `/api/v1/layers/{layerID}/export` | Экспорт GeoJSON |

---

## Примеры запросов

### Получить список слоёв

```bash
curl http://localhost:8080/api/v1/layers
```

### Получить GeoJSON фичи слоя

```bash
curl "http://localhost:8080/api/v1/layers/buildings/features?min_lon=30.0&min_lat=59.0&max_lon=31.0&max_lat=60.0"
```

### Получить MVT тайл

```bash
curl -o tile.mvt "http://localhost:8080/tiles/buildings/14/5000/5000.mvt"
```

### Получить TileJSON для MapLibre

```bash
curl http://localhost:8080/api/v1/tilejson/buildings
```

**Ответ:**
```json
{
  "tilejson": "3.0.0",
  "name": "buildings",
  "tiles": ["http://localhost:8080/tiles/buildings/{z}/{x}/{y}.mvt"],
  "minzoom": 0,
  "maxzoom": 22,
  "bounds": [-180, -90, 180, 90]
}
```

### Создать фичу (с JWT)

```bash
TOKEN="..." # JWT токен

curl -X POST http://localhost:8080/api/v1/layers/buildings/features \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Building",
    "properties": {"height": 50, "floors": 12},
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[30.3, 59.9], [30.31, 59.9], [30.31, 59.91], [30.3, 59.91], [30.3, 59.9]]]
    }
  }'
```

### Заменить все фичи слоя (импорт)

```bash
curl -X POST http://localhost:8080/api/v1/layers/buildings/features/replace \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"features": [...]}'
```

---

## Конфигурация

### Через переменные окружения

Все переменные с префиксом `CSUMAP_`:

```bash
export CSUMAP_SERVER_ADDRESS=":8080"
export CSUMAP_DATABASE_DSN="postgres://postgres:postgres@localhost:5432/csumap"
export CSUMAP_REDIS_ADDRESS="localhost:6379"
export CSUMAP_JWT_SECRET="my-secret-key"
export CSUMAP_LOG_LEVEL="info"
```

### Через config.yaml

```yaml
server:
  address: ":8080"
  read_timeout: "15s"
  write_timeout: "30s"
  idle_timeout: "60s"
  shutdown_timeout: "10s"

database:
  dsn: "postgres://postgres:postgres@localhost:5432/csumap"
  max_conns: 25
  min_conns: 5
  max_conn_lifetime: "1h"
  max_conn_idle_time: "30m"

redis:
  address: "localhost:6379"
  password: ""
  db: 0
  pool_size: 10

jwt:
  secret: "change-me-in-production"
  access_token_ttl: "15m"

log:
  level: "info"
  development: false
```

---

## Подключение к MapLibre

```javascript
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      'csumap-buildings': {
        type: 'vector',
        tiles: ['http://localhost:8080/tiles/buildings/{z}/{x}/{y}.mvt'],
        minzoom: 0,
        maxzoom: 22
      }
    },
    layers: [
      {
        id: 'buildings-fill',
        type: 'fill',
        source: 'csumap-buildings',
        'source-layer': 'buildings',
        paint: {
          'fill-color': '#888888',
          'fill-opacity': 0.6
        }
      }
    ]
  }
});
```

Или через TileJSON (автоконфигурация):

```javascript
map.addSource('csumap-buildings', {
  type: 'vector',
  url: 'http://localhost:8080/api/v1/tilejson/buildings'
});
```

---

## Развертывание на Linux сервере

### 1. Сборка бинарника под Linux

```bash
# Из Windows (cross-compile):
$env:GOOS="linux"
$env:GOARCH="amd64"
go build -o csumap-linux ./cmd/server

# Из WSL / Linux:
GOOS=linux GOARCH=amd64 go build -o csumap ./cmd/server
```

### 2. Перенос на сервер

```bash
scp csumap-linux user@server:~/
scp -r migrations user@server:~/
scp config.yaml user@server:~/
```

### 3. Настройка PostgreSQL на сервере

```bash
sudo -u postgres psql -c "CREATE USER csumap WITH PASSWORD 'secure-password';"
sudo -u postgres psql -c "CREATE DATABASE csumap OWNER csumap;"
sudo -u postgres psql -d csumap -c "CREATE EXTENSION postgis;"

psql -U csumap -d csumap -f migrations/001_init_postgis.sql
psql -U csumap -d csumap -f migrations/002_create_layers.sql
psql -U csumap -d csumap -f migrations/003_create_features.sql
```

### 4. systemd сервис

```ini
# /etc/systemd/system/csumap.service
[Unit]
Description=CSUMAP Go Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=csumap
WorkingDirectory=/opt/csumap
ExecStart=/opt/csumap/csumap
Restart=always
RestartSec=5
Environment=CSUMAP_SERVER_ADDRESS=:8080
Environment=CSUMAP_DATABASE_DSN=postgres://csumap:secure-password@localhost:5432/csumap
Environment=CSUMAP_REDIS_ADDRESS=localhost:6379
Environment=CSUMAP_JWT_SECRET=production-secret
Environment=CSUMAP_LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable csumap
sudo systemctl start csumap
sudo systemctl status csumap
```

### 5. Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name map.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /tiles/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_cache csumap_tiles;
        proxy_cache_valid 200 1h;
        proxy_cache_key "$uri";
        add_header X-Cache-Status $upstream_cache_status;
        expires 1h;
    }
}
```

---

## Миграция данных из старого Node.js бэкенда

Данные уже в PostgreSQL. Старый Node.js сервер (`server/index.js`) можно отключить после проверки Go сервера:

```bash
# Проверить, что Go сервер отвечает:
curl http://localhost:8080/api/v1/layers

# Должны вернуться те же данные, что и на Node.js:
# GET http://localhost:3001/api/layers
```

---

## Структура БД

### Таблица `layers`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | VARCHAR(50) PK | Идентификатор слоя |
| name | VARCHAR(255) | Название |
| slug | VARCHAR(255) UNIQUE | URL-friendly имя |
| description | TEXT | Описание |
| style | JSONB | MapLibre style JSON |
| min_zoom | INT | Мин. zoom (0 по ум.) |
| max_zoom | INT | Макс. zoom (22 по ум.) |
| is_public | BOOL | Публичный ли слой |
| created_at | TIMESTAMPTZ | Дата создания |
| updated_at | TIMESTAMPTZ | Дата обновления |

### Таблица `features`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | BIGSERIAL PK | ID фичи |
| layer_id | VARCHAR(50) FK | Слой |
| feature_id | VARCHAR(255) | ID из GeoJSON |
| name | VARCHAR(255) | Название |
| properties | JSONB | Свойства |
| geometry | GEOMETRY(Geometry, 4326) | Геометрия (с индексом GIST) |
| is_visible | BOOL | Видимость |
| min_zoom | INT | Мин. zoom |
| max_zoom | INT | Макс. zoom |
| created_at | TIMESTAMPTZ | Дата создания |
| updated_at | TIMESTAMPTZ | Дата обновления |

### Таблица `backups`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | BIGSERIAL PK | ID бекапа |
| layer_id | VARCHAR(50) FK | Слой |
| snapshot | JSONB | Полный GeoJSON |
| feature_count | INT | Кол-во фич |
| created_at | TIMESTAMPTZ | Дата бекапа |

---

## Производительность

### Индексы (создаются миграциями)

```sql
-- GIST пространственный индекс (критически важен для тайловых запросов)
CREATE INDEX idx_features_geometry ON features USING GIST (geometry);

-- Индекс по слою (фильтрация)
CREATE INDEX idx_features_layer ON features(layer_id);

-- Составной индекс для тайлов (layer + zoom range)
CREATE INDEX idx_features_layer_zoom ON features (layer_id, min_zoom, max_zoom);

-- GIN индекс для JSONB (поиск по свойствам)
CREATE INDEX idx_features_properties ON features USING GIN (properties jsonb_path_ops);
```

### Кэширование тайлов (Redis)

- z ≤ 6: 24 часа
- z ≤ 10: 4 часа
- z ≤ 14: 1 час
- z > 14: 15 минут

При редактировании фичи кэш автоматически инвалидируется по её bbox.

---

## Мониторинг

- `/metrics` — Prometheus endpoint
- `/health` — Health check (200 = OK)
- Zap логгер структурированных логов в stdout

---

## Разница с оригинальным Node.js API

| Endpoint | Node.js | Go |
|----------|---------|-----|
| Список слоёв | `GET /api/layers` | `GET /api/v1/layers` |
| Фичи слоя | `GET /api/layers/:name` | `GET /api/v1/layers/{layerID}/features?min_lon=...` |
| Сохранение | `POST /api/layers/:name` | `POST /api/v1/layers/{layerID}/features/replace` |
| Файлы | `GET /api/files` | `GET /api/v1/layers` (содержит feature_count) |
| Загрузка | `GET /api/load/:filename` | `GET /api/v1/layers/{layerID}/features` |
| Сохранение файла | `POST /api/save/:filename` | `POST /api/v1/layers/{layerID}/features/replace` |
| Бекапы | `GET /api/layers/:name/backups` | Через таблицу backups напрямую |
| Восстановление | `POST /api/layers/:name/restore/:id` | Через импорт GeoJSON |
| Тайлы | — | `GET /tiles/{layer}/{z}/{x}/{y}.mvt` |
| TileJSON | — | `GET /api/v1/tilejson/{layer}` |

> **Важно:** Go API использует префикс `/api/v1/` (версионирование). Node.js API использовал `/api/` без версии.

---

## Редактор кампуса — Draft/Publish паттерн

### Проблема с оригинальным Node.js бэкендом

Оригинальный бэкенд использовал `replaceLayerFeatures`, который **стирал все фичи слоя** и заново вставлял их:

```sql
DELETE FROM features WHERE layer_id = $1;  -- Удалял опубликованные фичи!
INSERT INTO features (..., status, version) VALUES (...);
```

Результат:
- Нет возможности редактировать отдельные фичи
- Нет разницы между draft и published
- Нет механизма "promote to prod"

### Решение: Draft/Publish паттерн

#### 1. Схема БД (миграция 008)

```sql
-- Новая колонка статуса
ALTER TABLE features
    ADD COLUMN status edit_status DEFAULT 'draft',
    ADD COLUMN published_at TIMESTAMPTZ,
    ADD COLUMN published_by BIGINT,
    ADD COLUMN parent_id BIGINT,
    ADD COLUMN version INT DEFAULT 1;

-- VIEW для публичного API (только published)
CREATE VIEW features_published AS
    SELECT * FROM features WHERE status = 'published';

-- VIEW для редактора (draft + review)
CREATE VIEW features_draft AS
    SELECT * FROM features WHERE status IN ('draft', 'review');
```

#### 2. API endpoints для редактора

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/v1/layers/{layerID}/features` | Создать фичу (draft) |
| `PUT` | `/api/v1/features/{id}` | Обновить фичу (draft) |
| `DELETE` | `/api/v1/features/{id}` | Удалить фичу (draft) |
| `POST` | `/api/v1/layers/{layerID}/features/replace` | Заменить все draft фичи слоя |

#### 3. Changeset API (админ панель)

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/v1/changesets` | Экспорт changeset из draft фич |
| `GET` | `/api/v1/changesets/{id}/download` | Скачать changeset.json |
| `POST` | `/api/v1/changesets/apply` | Применить changeset на проде |
| `GET` | `/api/v1/changesets` | История применённых changesets |
| `POST` | `/api/v1/features/{id}/publish` | Опубликовать одну фичу |
| `POST` | `/api/v1/features/publish-all` | Опубликовать все draft фичи слоя |

#### 4. Пайплайн (CI/CD)

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_DB: geomap_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - name: Run Go tests
        run: go test ./...
        env:
          DATABASE_URL: "postgres://test:test@localhost:5432/geomap_test"

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
          docker push ghcr.io/${{ github.repository }}:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      # 1. Применить миграции СХЕМЫ
      - name: Run schema migrations
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/geomap
            ./migrate -direction=up

      # 2. Применить DATA changeset если есть в коммите
      - name: Apply data changeset
        if: hashFiles('changesets/*.json') != ''
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            for f in /opt/geomap/changesets/*.json; do
              ID=$(jq -r '.id' "$f")
              APPLIED=$(psql $DATABASE_URL -t -c \
                "SELECT COUNT(*) FROM applied_changesets WHERE id='$ID'")

              if [ "$APPLIED" -eq "0" ]; then
                curl -sS -X POST https://prod-internal/api/v1/changesets/apply \
                     -H "Authorization: Bearer $INTERNAL_TOKEN" \
                     -H "Content-Type: application/json" \
                     -d @"$f"
                echo "Applied: $f"
              else
                echo "Already applied: $f (skip)"
              fi
            done

      # 3. Перезапустить сервис
      - name: Restart service
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            docker pull ghcr.io/${{ github.repository }}:${{ github.sha }}
            docker-compose -f /opt/geomap/docker-compose.prod.yml up -d --no-deps api
```

#### 5. Frontend (editor.js) обновления

```javascript
// Загрузка: загружаем published для контекста + draft для редактирования
const layerMap = {
  buildings: 'buildings',
  complex: 'complex',
  roads: 'roads',
  poi: 'poi',
  zones: 'zones',
};

for (const [key, layerId] of Object.entries(layerMap)) {
  // Published (read-only)
  const publishedFc = await fetch(`${API_BASE}/layers/${layerId}/features`);
  if (publishedFc.ok) {
    const publishedData = await publishedFc.json();
    publishedData.features.forEach(f => {
      f.properties = { ...f.properties, _status: 'published' };
    });
    Draw.add(publishedData);
  }
  
  // Draft (editable)
  const draftFc = await fetchLayerFeaturesForEdit(layerId);
  if (draftFc.features?.length > 0) {
    draftFc.features.forEach(f => {
      f.properties = { ...f.properties, _status: 'draft' };
    });
    Draw.add(draftFc);
  }
}

// Сохранение: индивидуальное создание/обновление как draft
async function saveAll() {
  const all = Draw.getAll();
  let totalSaved = 0;
  
  for (const feature of all.features) {
    const props = feature.properties || {};
    const isNew = !props.serverId;
    const layerId = getLayerForFeature(feature);
    
    const request = featureToRequest(feature);
    
    try {
      if (isNew) {
        const result = await createFeature(layerId, request);
        if (result?.id) {
          Draw.setFeatureProperty(feature.id, 'serverId', result.id);
        }
      } else {
        await updateFeature(props.serverId, request);
      }
      totalSaved++;
    } catch (e) {
      console.error(`Failed to save feature ${feature.id}:`, e);
    }
  }
  
  setStatus(`💾 Сохранено как черновики: ${totalSaved} объектов`);
}

// Changeset UI
btnChangeset.addEventListener('click', async () => {
  const description = prompt('Описание изменений для changeset:');
  if (!description) return;
  
  const cs = await exportChangeset({ author: 'editor', description });
  // Скачать файл...
});

btnPublish.addEventListener('click', async () => {
  if (!confirm('Опубликовать ВСЕ черновики? Это действие необратимо.')) return;
  
  const result = await publishAllDrafts();
  setStatus(`✓ ${result.message}`);
});
```

#### 6. Пример использования

**1. Редактирование здания:**
- Выбираете инструмент → рисуйте полигон
- Заполняете свойства (название, этажность, категория)
- Автоматически сохраняется как draft

**2. Экспорт changeset:**
- Нажимаете 📦 Changeset → вводите описание
- Скачиваете `changeset_2026-06-16.json`
- Добавляете в git → коммитите → пушите в репозиторий

**3. CI/CD пайплайн:**
- GitHub Actions применяет schema миграции
- Применяет changeset.json на продакшн-сервере
- Инвалидирует кэш тайлов

**4. Публикация:**
- Нажимаете 🚀 Опубликовать (или публикуете changeset вручную)
- Все draft фичи становятся published
- Видны на публичной карте

### Преимущества

| Feature | Node.js | Go |
|---------|---------|-----|
| Draft/publish separation | ❌ Нет | ✅ Да |
| Changeset pipeline | ❌ Нет | ✅ Да |
| Individual feature edit | ❌ Нет (replace entire layer) | ✅ Да |
| Idempotent production deploy | ❌ Нет | ✅ Да |
| Schema versioning (golang-migrate) | ❌ Нет | ✅ Да |
| Public API (published only) | ❌ Нет | ✅ Да |

### TL;DR

1. **Редактор** работает с draft фичами (отдельное создание/обновление)
2. **Changeset** собирает draft фичи в пакет для экспорта
3. **CI/CD** применяет schema миграции + changeset на проде
4. **Публичный API** читает только из `features_published` VIEW
5. **Production deploy** — один раз, безопасно, автоматически

### Команды миграций

```bash
# Применить все pending миграции
./migrate -direction=up

# Применить N шагов
./migrate -direction=up -steps=5

# Откатить N шагов
./migrate -direction=down -steps=2

# Проверить версию
./migrate -direction=version
```

---

## Применение миграций в Docker контейнере

### Вариант 1: Через `docker-compose exec` (рекомендуется, не останавливает сервис)

```bash
# 1. Проверьте название контейнера приложения
docker-compose ps
# NAME: csumap-app-1

# 2. Запустите миграции внутри контейнера
docker-compose exec app ./migrate -direction=up

# Или с конкретным количеством шагов
docker-compose exec app ./migrate -direction=up -steps=3

# Проверить текущую версию
docker-compose exec app ./migrate -direction=version
```

> **Важно:** Контейнер приложения (`app`) должен быть запущен, так как он содержит бинарник `migrate`. База данных (`db`) также должна быть доступна (healthy).

### Вариант 2: Через `docker exec` напрямую

```bash
# Если знаете имя контейнера
docker exec csumap-app-1 ./migrate -direction=up

# Или с переменными окружения (если они не заданы в образе)
docker exec -e DATABASE_URL="postgres://postgres:postgres@db:5432/csumap?sslmode=disable" \
  csumap-app-1 ./migrate -direction=up
```

### Вариант 3: Отдельный контейнер для миграций (CI/CD)

```yaml
# docker-compose.migrate.yml
version: '3.8'
services:
  migrate:
    build: .
    command: ./migrate -direction=up
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/csumap?sslmode=disable
    depends_on:
      db:
        condition: service_healthy
```

```bash
docker-compose -f docker-compose.yml -f docker-compose.migrate.yml run --rm migrate
```

### Вариант 4: Вручную через psql (если бинарник недоступен)

```bash
# Подключиться к базе внутри контейнера
docker-compose exec db psql -U postgres -d csumap

# Внутри psql выполнить SQL из файла миграции
\i migrations/schema/008_add_draft_publish.up.sql

# Или применить все миграции по порядку
\i migrations/schema/001_init_postgis.up.sql
\i migrations/schema/002_create_layers.up.sql
\i migrations/schema/003_create_features.up.sql
\i migrations/schema/008_add_draft_publish.up.sql
```

### Нужно ли останавливать контейнер?

| Сценарий | Останавливать app? |
|----------|-------------------|
| `docker-compose exec app ./migrate -direction=up` | **НЕТ** — безопасно, работает на живой БД |
| Только schema (CREATE TABLE, ALTER) | **НЕТ** — транзакционно, не ломает чтение |
| Data миграции (DELETE/UPDATE больших объёмов) | Желательно — чтобы избежать конфликтов с запросами API |

> **Рекомендация:** Для schema миграций (DDL) контейнер **не нужно останавливать**. Go миграции запускаются в транзакциях и не блокируют SELECT запросы. Для больших data миграций (DML) лучше сделать в maintenance window.

### Проверка после миграции

```bash
# 1. Проверить версию
docker-compose exec app ./migrate -direction=version
# Current version: 8, dirty: false

# 2. Проверить структуру таблицы
docker-compose exec db psql -U postgres -d csumap -c "\d features"
# Должна быть колонка status с DEFAULT 'draft'

# 3. Проверить данные
docker-compose exec db psql -U postgres -d csumap -c "SELECT id, name, status FROM features LIMIT 5;"
```

### Troubleshooting

**Ошибка: "no migration files found"**
```bash
# Проверьте, что файлы миграций скопированы в образ
docker-compose exec app ls -la /app/migrations/schema/
# Должны быть: 001_*.sql, 002_*.sql, 003_*.sql, 008_*.sql
```

**Ошибка: "connection refused" к БД**
```bash
# Проверьте, что db контейнер healthy
docker-compose ps
# db должен быть: Up ... (healthy)

# Проверьте переменную DATABASE_URL в app контейнере
docker-compose exec app env | grep DATABASE
```

**Ошибка: "dirty database version"**
```bash
# Если миграция упала посередине, БД помечается как dirty
# Исправьте причину ошибки, затем принудительно установите версию:
docker-compose exec app ./migrate -direction=force 8
# Где 8 — это номер последней успешной миграции
```

### Автоматические миграции при старте (опционально)

Можно добавить в `cmd/server/main.go` автозапуск миграций перед стартом сервера:

```go
func main() {
    // ... existing code ...
    
    // Run migrations on startup
    if err := runMigrations(cfg.Database.DSN); err != nil {
        logger.Fatal("failed to run migrations", zap.Error(err))
    }
    
    // ... rest of main ...
}

func runMigrations(dsn string) error {
    m, err := migrate.New("file:///app/migrations/schema", dsn)
    if err != nil {
        return err
    }
    defer m.Close()
    
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return err
    }
    return nil
}
```

Тогда при каждом `docker-compose up` миграции применятся автоматически.

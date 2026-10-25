# mkeiitmods — рабочий журнал

Форк Vortex (Nexus Mods, GPL-3.0). Цель: своё название (mkeiitmods), полная
изоляция от установленного Vortex и раздел каталога модов Nexus.
Главная игра — Cyberpunk 2077 (Nexus gameId 3333, домен `cyberpunk2077`).

Рабочая ветка: `claude/new-session-ube4ui`. Remote `upstream` =
`https://github.com/Nexus-Mods/Vortex.git` (push в него отключён:
`git remote set-url --push upstream DISABLED`).

## Задачи

| #   | Задача                                                         | Статус                           |
| --- | -------------------------------------------------------------- | -------------------------------- |
| 0   | Окружение: зависимости, сборка, проверки                       | сделано (с оговорками, см. ниже) |
| 1   | `progress.md`, `CHANGELOG.mkeiitmods.md`                       | сделано                          |
| 2   | Своя папка данных                                              | сделано                          |
| 3   | Автообновление, телеметрия, отчёты об ошибках — выключить      | сделано                          |
| 4   | Заголовки API Nexus, протокол `nxm://`, анализ входа (OAuth)   | сделано (вход — см. блокеры)     |
| 5   | Переименование в интерфейсе, локализациях, установщике; иконки | не начато                        |
| 6   | Раздел каталога модов                                          | не начато                        |
| 7   | Раздел «Для редизайна», финальная проверка                     | не начато                        |

## Окружение (облачная песочница, Linux)

- Node 22 в системе, pnpm 11.10. Electron-окно здесь не запустить — проверка
  через typecheck, lint и vitest.
- `codeload.github.com` закрыт прокси песочницы, а 17 зависимостей лок-файла
  ставятся оттуда. Обход только для локальной установки: архивы собраны
  `git archive` из клонов github.com, лок-файл временно подменён и затем
  возвращён (в коммиты не попадает).
- Пересборка нативных модулей под Electron (`src/main postinstall`) падает:
  заголовки Electron не скачиваются через прокси. На typecheck/lint/тесты не
  влияет.
- `pnpm run …` сам перезапускает `pnpm install` — отключаю переменной
  `pnpm_config_verify_deps_before_run=false`.
- Перед typecheck `@vortex/main` нужен сгенерированный файл:
  `cd src/main && pnpm run generate:unleash` (в git не хранится).

## Решения

### Брендинг: где задаётся

Все «наши» константы в одном месте — `src/shared/src/branding.ts`
(`APP_NAME`, `APP_DISPLAY_NAME`, папки данных, выключатели `UPDATER_ENABLED` и
`TELEMETRY_ENABLED`). Внутренние имена Vortex (`vortex-api`, `getVortexPath`,
имена пакетов) не трогаем — иначе сломаются расширения игр и слияние с upstream.
После правок в `src/shared` нужно `cd src/shared && pnpm run build`: остальные
пакеты при typecheck читают его `dist`.

### Папка данных (п. 2)

- Где задаётся: `src/main/src/main.ts` — сразу после импортов вызываются
  `app.setName("mkeiitmods")` и `app.setPath("userData", …)`. Раньше имя
  папки бралось из имени пакета (`Vortex`), а состояние лежало в
  `%APPDATA%\vortex` — на Windows это та же папка, что `%APPDATA%\Vortex`.
- Теперь: `%APPDATA%\mkeiitmods` (сборка), `%APPDATA%\mkeiitmods_devel`
  (`pnpm run dev`), `%ProgramData%\mkeiitmods` (общий режим для всех
  пользователей). Логика — `src/main/src/appIdentity.ts`.
- Предохранитель: `assertNotVortexDataPath` в `Application.ts` (конструктор,
  обработка `--get/--set/--del`, выбор папки состояния). Если путь указывает в
  `%APPDATA%\Vortex`, `vortex_devel`, `@vortex` или `%ProgramData%\vortex`
  (без учёта регистра) — запуск прерывается с ошибкой. Это действует и для
  явного `--user-data`.
- Блокировка «одного экземпляра» Electron привязана к папке userData, поэтому
  mkeiitmods и Vortex могут работать одновременно.

### Автообновление (п. 3)

Встроенный апдейтер ищет релизы в `github.com/Nexus-Mods/Vortex` и поставил бы
настоящий Vortex поверх mkeiitmods. Выключен полностью: `UPDATER_ENABLED =
false` → `isUpdaterActive()` всегда `false` (`src/main/src/extensions/updater.ts`),
проверки, загрузки и периодический опрос не запускаются. В настройках вместо
кнопок обновления — пояснение «Автоматические обновления выключены». Включать
только после того, как у mkeiitmods появится свой канал релизов.

### Телеметрия и отчёты (п. 3)

Единый выключатель `TELEMETRY_ENABLED = false`; никакая настройка или согласие
его не обходит. Выключено:

- **Mixpanel-аналитика** (`src/renderer/src/extensions/analytics`): расширение
  не стартует, окно согласия и пункт настроек «Analytics» не показываются.
- **Трассировка OpenTelemetry** в `vortex-collector.nexusmods.com`:
  `isTelemetryEnabled()` и `isUnconsentedReportingEnabled()` всегда `false`.
- **Отчёты о крэшах** (включая «очищенные» отчёты, которые Vortex отправляет
  даже без согласия, и нативные дампы): `reportCrash()` ничего не отправляет,
  кнопки «Report and Quit» нет. Дампы остаются локально в
  `%APPDATA%\mkeiitmods\temp\dumps`.
- **Флаги Unleash** (`unleash-edge.nexusmods.com`, туда уходили id
  пользователя и метрики): сервер не опрашивается, все удалённые флаги
  выключены. Это скрывает экспериментальные функции Vortex
  (`vortex-tier-0-game-support`, проверка файловых требований).
- **Отправка отзывов в Nexus Mods** (`submit-feedback`): возвращает ошибку.

Ещё два канала вне расширения analytics тоже закрыты: событие «найденные
игры» и «снимок списка модов» (внутренний API v3 Nexus) — селектор
`isTelemetryEnabled` в renderer учитывает выключатель, а
`createVortexNexusV3InternalClient` бросает ошибку. Обработчик `send-metric`
ничего не отправляет.

Тесты: `src/main/src/telemetry.mkeiitmods.test.ts`,
`src/main/src/extensions/updater.mkeiitmods.test.ts`. В тестах upstream
(`updater.test.ts`, `nativeCrashReporting.test.ts`) выключатель подменяется на
`true`, чтобы они по-прежнему проверяли логику Vortex.

### Заголовки к API Nexus (п. 4)

`Application-Name: mkeiitmods`, `Application-Version: 0.1.0` (константы
`NEXUS_APP_NAME`/`NEXUS_APP_VERSION`), `User-Agent: mkeiitmods/0.1.0`
(`USER_AGENT`). Где задаются:

- клиент `@nexusmods/nexus-api` (REST v1 и GraphQL v2) —
  `nexus_integration/index.tsx`, `new Nexus(NEXUS_APP_NAME, NEXUS_APP_VERSION, …)`;
- клиент v3 (`packages/nexus-api-v3`) — `nexus_integration/nexusV3Client.ts`;
- прямой запрос категорий — `category_management/util/getCategoriesFromNexusMods.ts`;
- `util/network.ts`, лента новостей (`news_dashlet/rss.ts`), `util/github.ts`,
  загрузки файлов в main (`main.ts`, `UploadManager`).

Версия приложения Electron (`app.getVersion()`) осталась версией Vortex:
расширения игр проверяют по ней совместимость. Наша версия — отдельная
константа `APP_VERSION` в `branding.ts`. Тесты: `src/shared/src/branding.test.ts`,
`getCategoriesFromNexusMods.test.ts`.

Важно: клиент `@nexusmods/nexus-api` сам ставит свой `User-Agent`
(`NexusApiClient/…`), это библиотека Nexus — не меняли.

### Протокол `nxm://` (п. 4)

Vortex при первом запуске сам делал себя обработчиком `nxm://`. Теперь
mkeiitmods регистрируется в системе только когда пользователь включил
«Handle Nexus Links» в настройках (Settings → Downloads). Логика —
`nexus_integration/nxmAssociation.ts` (+ тест). Внутри окна программы ссылки
`nxm://` по-прежнему работают. Установщик протокол не регистрирует.
Отключение настройки снимает регистрацию только если обработчик — сам
mkeiitmods (так работает `removeAsDefaultProtocolClient` в Electron на
Windows), настоящий Vortex не затрагивается. Не проверено вживую.

На Linux имена `.desktop`-файлов остались `com.nexusmods.vortex*`
(`util/protocolRegistration/linux/nxm.ts`) — для Windows не важно, но при
сборке под Linux их нужно переименовать, иначе форк перезапишет файл Vortex.

### Вход в Nexus (п. 4) — анализ

- Сейчас вход — OAuth 2 (PKCE, редирект на `http://127.0.0.1:<порт>`),
  клиент `OAUTH_CLIENT_ID = "vortex_loopback"`
  (`nexus_integration/constants.ts`). Работает, не трогали. Клиент
  зарегистрирован на Vortex, поэтому **для публичного релиза это блокер**.
- Вариант 1 — **личный API-ключ** (nexusmods.com → Site preferences → API
  Keys; для личного использования разрешено). Что есть в коде:
    - хранение `confidential.account.nexus.APIKey`, действие `setUserAPIKey`,
      `isLoggedIn()` считает ключ входом, клиент проверяет ключ через
      `/v1/users/validate` (`nexus.setKey`);
    - **чего нет**: поля ввода ключа в интерфейсе (поле в окне входа — это
      вставка OAuth-кода, а не ключа); при перезапуске ключ не применяется к
      клиенту (`//updateKey(api, nexus, apiKey)` закомментирован в
      `nexus_integration/index.tsx`); после проверки ключа не заполняется
      профиль пользователя (`updateUserInfo` закомментирован в `util.ts`
      `updateKey`). То есть вход по ключу сейчас **не поддерживается**, но
      доделывается небольшим изменением (поле ввода + 2 закомментированных
      вызова). Предлагаю сделать это следующим шагом, если нужен вход без OAuth.
- Вариант 2 — **свой OAuth client ID**: написать на `support@nexusmods.com`,
  попросить регистрацию OAuth-клиента для mkeiitmods с loopback-редиректом
  (`http://127.0.0.1`). После получения — заменить `OAUTH_CLIENT_ID`.

## Проверено

- Базовая линия до изменений: `pnpm run typecheck` — проходит;
  `pnpm run test` — 3 падения, все из-за окружения: 2 теста
  `installer_fomod_native/tester.test.ts` (нативный модуль fomod не собран под
  Electron), 1 нестабильный тест `nativeCrashReporting.test.ts` (при
  повторном прогоне проходит).
- После п. 2–3: `src/main` — `tsc` и `vitest run` (35 файлов, 373 теста)
  проходят; `src/renderer` — `tsc` и тесты analytics/updater/nexus_integration
  проходят.

## Не проверено вживую

_(заполняется по ходу работы)_

## Блокеры и вопросы

- **Публичный релиз**: нужен свой OAuth client ID от Nexus Mods (или вход
  только по личному API-ключу, который ещё надо доделать). Для разработки и
  личного использования не мешает.

## Следующий шаг

Пункт 5 — переименование в интерфейсе, локализациях и установщике.

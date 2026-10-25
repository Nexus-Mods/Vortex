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
| 5   | Переименование в интерфейсе, локализациях, установщике; иконки | сделано                          |
| 6   | Раздел каталога модов                                          | сделано (не проверено вживую)    |
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

### Переименование (п. 5)

**Как сделано и почему.** В Vortex английские строки интерфейса одновременно
служат ключами перевода (`t("Restart Vortex")`), а языковые пакеты сообщества
ищут перевод по этим ключам. Таких строк с «Vortex» ~1400. Переписать их все —
огромный дифф, вечные конфликты при слиянии с upstream и сломанные переводы.
Поэтому название меняется **при выводе**:

- `src/shared/src/rebrand.ts` — `rebrandText()`: «Vortex» → «mkeiitmods» как
  отдельное слово. Не трогает: «based on Vortex» / «основан на Vortex»,
  «Vortex (Nexus Mods)», «Vortex Wiki», `Vortex.exe`, URL и пути
  (`Nexus-Mods/Vortex`), идентификаторы (`vortex-api`, `VortexGameId`).
- `src/renderer/src/util/i18n.ts` — постпроцессор i18next `RebrandPP`
  применяется ко всем переводам (и к запасной `t` до старта i18n). Работает и
  для языковых пакетов, и для сторонних расширений.
- `src/main/src/rebrandDialogs.ts` — обёртка `dialog.showErrorBox` /
  `showMessageBox(Sync)` в main: стартовые ошибки, проблемы с базой и т. п.
- Системные уведомления (`util/GlobalNotifications.ts`) — тоже через
  `rebrandText`.

Следствие: **поиск по «Vortex» в исходниках по-прежнему находит строки** — это
ключи перевода, пользователь их не видит. В файлах `locales/en/*.json` (там
значения, а не ключи) название заменено напрямую.

**Что изменено напрямую:**

- Заголовок окна (`MainWindow.ts`), `<title>` в `index.html` и `splash.html`,
  страница «вход выполнен» после OAuth (убран логотип Vortex), имя команды
  CLI.
- «О программе»: `mkeiitmods 0.1.0`, строка «Based on Vortex <версия> by Nexus
  Mods», копирайт Black Tree Gaming Ltd. и лицензия GPL-3 сохранены. Запрос
  релизов Vortex с GitHub отключён.
- Установщик (`src/main/electron-builder.config.json`, `prepare-dist-package.mjs`,
  `nsis/installer.nsh`): `appId io.github.lidfc.mkeiitmods` (с прежним `appId`
  установщик считал бы себя Vortex и мог удалить его), `productName` и
  `executableName` = `mkeiitmods`, файл установщика
  `mkeiitmods-setup-<версия>.exe`, публикация — `LIDFC/mkeiitmods`, убран
  `publisherName` Black Tree Gaming (проверка подписи их сертификатом), убрано
  предложение отзыва через форму Nexus при удалении. Определение «обычной»
  установки ищет `Uninstall mkeiitmods.exe`.
- Ярлык профиля на рабочем столе указывал на `Vortex.exe` (запустил бы
  настоящий Vortex) — теперь на исполняемый файл mkeiitmods.
- «Сообщить об ошибке», «Отзыв», «Пакет поддержки» ведут в issues
  `github.com/LIDFC/mkeiitmods`, а не на форум/трекер Vortex. Ссылка на
  Discord Nexus Mods в окне пакета поддержки осталась.
- Иконки и картинки-логотипы заменены нейтральными заглушками (тёмный квадрат
  «mk», баннер «mkeiitmods»): `assets/images/vortex.png|.ico`, `splash.png`,
  `splash_old.png`, `src/main/nsis/icon.ico`, `installerSidebar.bmp`. Имена
  файлов оставлены, чтобы не трогать код. Логотип Nexus Mods (`nexus.svg`) у
  кнопок входа оставлен — это ссылка на их сервис, а не наш бренд.
- README: «mkeiitmods основан на Vortex (Nexus Mods), GPL-3.0», LICENSE и
  копирайты сохранены.

**Не переименовано (намеренно):** пакеты, `vortex-api`, внутренние id
(`getVortexPath`, `VortexGameId`), версия Electron-приложения (по ней
расширения проверяют совместимость), имена файлов логов (`vortex.log`), имена
файлов картинок. Расширения игр и тексты, которые они выводят мимо `t()`,
могут изредка показать «Vortex».

### Каталог модов (п. 6)

**Название.** Варианты: «Каталог», «Обзор модов», «Моды Nexus». Выбрано
**«Каталог»** (в интерфейсе — ключ `Catalog`): короткое, помещается в боковое
меню и не путается с существующим пунктом «Browse Nexus Mods» (там коллекции).
Если хочется другое — меняется одной строкой в
`src/renderer/src/extensions/mod_catalog/index.ts`.

**Доработать «Browse Nexus Mods» или новая страница — решение: новая.**
Страница upstream (`browse_nexus`) — это коллекции, а её вкладка «Mods» —
заглушка «скоро будет»; Nexus явно планирует заполнить её сам. Если писать
каталог в их файл, каждое слияние с upstream будет давать конфликты. Поэтому
каталог — отдельное расширение `src/renderer/src/extensions/mod_catalog/`, а
в файлы upstream добавлено только: регистрация расширения
(`ExtensionManager.ts`, `extensions/index.ts`) и функция `nexusQueryGraph` в
API nexus_integration (`index.tsx`, `types/INexusAPIExtension.ts`).

**Откуда данные (только официальный API):**

- Список, поиск, фильтры, сортировка — GraphQL v2 `mods(filter, sort, count,
offset)` (публичный, работает без входа). Запрос строится в
  `catalogQuery.ts`. Отправляется **через существующий клиент**
  `@nexusmods/nexus-api` (`nexus_integration/util/rawGraphQuery.ts`): у
  клиента нет метода поиска модов, но через него запрос получает общую квоту и
  ожидание при лимите, авторизацию и наши заголовки. Используются приватные
  члены клиента (`request`, `args`, `mGraphBaseURL`, `mQuota`) — если
  библиотеку обновят и они пропадут, будет понятная ошибка, а не тихий сбой.
- Страница мода: описание и файлы — REST v1 через уже существующие
  `api.ext.nexusGetModInfo` / `nexusGetModFiles` (нужен вход в Nexus),
  требования — `api.ext.nexusGetModRequirements` (GraphQL по `uid`).
- Установка — `api.ext.nexusDownload(…, allowInstall = true)`: обычный путь
  Vortex (проверка входа, бесплатный/премиум сценарий загрузки, установщик,
  FOMOD и т. д.). С карточки ставится основной файл (помеченный автором
  primary, иначе самый новый MAIN); если основного нет — открывается страница
  мода, чтобы выбрать файл.

**Фильтры GraphQL** (`ModsFilter`): `gameDomainName`, `name` (WILDCARD),
`categoryName`, `adultContent`. Сортировка — по полю `Mod`, по убыванию:
популярные = `downloads` (проверено 25.10.2026), новые = `createdAt`,
недавно обновлённые = `updatedAt`, по лайкам = `endorsements`.

⚠️ **Не проверено против живого API** (из песочницы `api.nexusmods.com`
недоступен, прокси отвечает 403, интроспекцию сделать не удалось):
сортировки `createdAt`, `updatedAt`, `endorsements` (поля есть в типе `Mod`,
но то, что это допустимые ключи сортировки, — предположение); фильтр
`gameDomainName` (в списке `ModsFilter`, проверенный пример использовал
`gameId`); тип переменной `ModsFilter`; булево значение в фильтре
`adultContent`; поля `modCategory { name }` и `uploader { name avatar }` (так
их запрашивает существующий код Vortex для модов в коллекциях). Если какой-то
из них неверен, страница покажет текст ошибки API. Проверить интроспекцией:

```graphql
{
    __type(name: "ModsSort") {
        inputFields {
            name
        }
    }
}
{
    __type(name: "ModsFilter") {
        inputFields {
            name
            type {
                name
                ofType {
                    name
                }
            }
        }
    }
}
```

**Лимиты API.** Поиск отправляется через 500 мс после остановки ввода
(debounce), запросы короче 2 символов не отправляются. Страницы (по 20 модов)
кэшируются в памяти на 10 минут (до 200 страниц), одинаковые одновременные
запросы объединяются (`catalogCache.ts`). Устаревшие ответы (пользователь уже
сменил фильтр) отбрасываются.

**Отметки «установлен» / «есть обновление»** (`installState.ts`): мод считается
установленным, если для активной игры есть мод с `source = nexus` и тем же
`modId`. «Есть обновление» — если штатная проверка обновлений Vortex нашла
новый файл, или версия на сайте отличается от установленной (Vortex тоже
считает любое изменение версии обновлением).

**18+.** Скрыты по умолчанию (фильтр `adultContent = false` в самом запросе).
Показываются только при включённом переключателе «Show adult mods» на
странице каталога; значение сохраняется в настройках
(`settings.modCatalog.showAdult`).

**Тесты** (`src/renderer/src/extensions/mod_catalog/*.test.ts(x)`,
`nexus_integration/util/rawGraphQuery.test.ts`): построение запроса и
фильтров, маппинг ответа, ключи кэша, кэш (TTL, вытеснение, общие запросы,
ошибки не кэшируются), статусы установки, выбор файла, страница целиком
(список, debounce поиска, «Load more», отметки, установка с карточки и со
страницы мода, просьба войти) — 41 тест.

## Проверено

- Базовая линия до изменений: `pnpm run typecheck` — проходит;
  `pnpm run test` — 3 падения, все из-за окружения: 2 теста
  `installer_fomod_native/tester.test.ts` (нативный модуль fomod не собран под
  Electron), 1 нестабильный тест `nativeCrashReporting.test.ts` (при
  повторном прогоне проходит).
- После п. 2–3: `src/main` — `tsc` и `vitest run` (35 файлов, 373 теста)
  проходят; `src/renderer` — `tsc` и тесты analytics/updater/nexus_integration
  проходят.
- После п. 5: `src/main` — `tsc`, `vitest run` (375 тестов) проходят;
  `src/renderer` — `tsc` проходит, `vitest run` — 4987 проходят, 2 падают
  (известные `installer_fomod_native/tester.test.ts`, окружение);
  `src/shared` — тесты `branding`, `rebrand` проходят.

## Не проверено вживую

Electron-окно в песочнице не запускается, установщик не собирается (нужен
Windows). Не проверено руками:

- что приложение стартует с папкой `%APPDATA%\mkeiitmods` и не трогает
  `%APPDATA%\Vortex` (проверено тестами логики путей, не живым запуском);
- что окно, трей, диалоги и «О программе» показывают mkeiitmods;
- установщик: имя, иконка, `appId`, что он не задевает установленный Vortex;
- регистрация `nxm://` через настройку на Windows;
- что вход OAuth продолжает работать.

Рекомендую первый живой запуск делать с `pnpm run dev` (данные в
`%APPDATA%\mkeiitmods_devel`).

## Блокеры и вопросы

- **Публичный релиз**: нужен свой OAuth client ID от Nexus Mods (или вход
  только по личному API-ключу, который ещё надо доделать). Для разработки и
  личного использования не мешает.

## Следующий шаг

Пункт 7 — раздел «Для редизайна», финальная проверка.

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { safeLocalStorageGet, safeLocalStorageSet } from "../lib/clientStorage";

const STORAGE_KEY = "locale";

const STRINGS = {
  ru: {
    nav_play: "Играть",
    nav_history: "История",
    nav_learn: "Учиться",
    nav_rating: "Рейтинг",
    nav_shop: "Магазин",
    nav_login: "Войти",
    nav_profile: "Профиль",
    nav_logout: "Выйти",
    theme_light: "Светлая",
    theme_dark: "Тёмная",
    firebase_not_configured: "Firebase не настроен",
    toast_login_success: "Вход выполнен",
    toast_logged_out: "Вы вышли из аккаунта",

    // Home
    home_title: "KAZ CHESS",
    home_desc:
      "Шахматы — это стратегия, которая развивает внимание, расчёт и терпение. Выберите режим и получайте удовольствие от игры. Удачи!",
    home_play: "Играть",
    home_history: "История",
    home_settings: "Профиль и настройки",
    home_shop: "Магазин",
    home_tip_moves:
      "Подсказка: в игре нажмите или перетащите фигуру — зелёные клетки это ходы, красные — взятия.",

    // Learn
    learn_title: "Учиться",
    learn_desc:
      "Здесь будут задачи, уроки и дебюты. Сейчас это заглушка — можем добавить тренировку на тактику и базовые уроки.",
    back_home: "На главную",
    main_menu: "Главное меню",

    // Lobby
    lobby_title: "Выбор игры",
    lobby_desc: "Выбери режим, время и (если нужно) силу Stockfish. После этого нажми Start.",
    match_settings: "Настройки матча",
    you_play_white: "В AI режиме ты играешь белыми, Stockfish играет чёрными.",
    minutes: "Минут",
    rated_hint: "Рейтинговая (Elo обновляется, Undo нельзя)",
    lobby_cta: "Start",
    lobby_footer: "KAZ CHESS сохраняет твои партии в историю, чтобы ты мог пересматривать и учиться.",

    // Auth
    login_title: "Вход",
    signup_title: "Регистрация",
    email: "Email",
    password: "Пароль",
    username: "Имя",
    confirm_password: "Повторите пароль",
    login_button: "Войти",
    signup_button: "Создать аккаунт",
    google_login: "Войти через Google",
    google_signup: "Регистрация через Google",
    forgot_password: "Забыли пароль?",
    reset_password_title: "Сброс пароля",
    send_reset_link: "Отправить ссылку",
    sending: "Отправка…",
    signing_in: "Вход…",
    creating: "Создание…",
    no_account: "Нет аккаунта?",
    have_account: "Уже есть аккаунт?",
    link_signup: "Регистрация",
    link_login: "Войти",
    reset_email_hint:
      "Если email зарегистрирован, вы получите письмо со ссылкой.",
    reset_sent:
      "Ссылка для сброса пароля отправлена на вашу почту",
    invalid_credentials: "Неверные данные",
    firebase_env_hint:
      "Firebase не настроен. Проверь .env.local.",
    toast_account_created: "Аккаунт создан",

    // Settings
    settings_title: "Настройки",
    account_page_title: "Профиль и настройки",
    interface_prefs_heading: "Оформление",
    appearance: "Внешний вид",
    board_theme: "Тема доски",
    applied_in_game: "Применяется в игре и в повторах.",

    // Profile
    profile_title: "Профиль",
    profile_security: "Безопасность",
    change_password: "Сменить пароль",
    new_password: "Новый пароль (минимум 6)",
    confirm_new_password: "Повторите новый пароль",
    password_updated: "Пароль обновлён",
    password_min: "Пароль должен быть минимум 6 символов",
    passwords_no_match: "Пароли не совпадают",
    relogin_required: "Войдите заново, чтобы сменить пароль.",
    logout: "Выйти",

    // History
    history_title: "История партий",
    refresh: "Обновить",
    refreshing: "Обновление…",
    no_games: "Пока нет сохранённых партий.",
    details: "Подробнее",
    moves: "Ходы",
    result: "Результат",
    reason: "Причина",
    mode: "Режим",
    time: "Время",
    back_to_history: "Назад к истории",
    replay_title: "Повтор",
    back_to_list: "Назад к списку",
    loading: "Загрузка…",
    loading_game: "Загрузка партии…",
    prev: "← Назад",
    next: "Вперёд →",
    start: "Начало",
    end: "Конец",

    // Leaderboard
    leaderboard_title: "Рейтинг",
    leaderboard_tab_elo: "Elo",
    leaderboard_tab_students: "Ученики",
    leaderboard_desc: "Топ игроков по Elo (рейтинговые партии против AI).",
    students_leaderboard_desc: "Топ учеников по XP/уровню (за обучение и активность).",
    player: "Игрок",
    no_players: "Пока нет игроков.",
    xp: "XP",
    level: "Уровень",

    // Game
    white: "Белые",
    black: "Чёрные",
    check: "Шах",
    white_to_move: "Ход белых",
    black_to_move: "Ход чёрных",
    new_game: "Новая партия",
    rematch: "Реванш",
    undo: "Отмена",
    game_setup: "Параметры",
    time_control: "Контроль времени",
    custom_minutes: "Своё (минуты)",
    review_mode: "Режим просмотра — нажмите последний ход, чтобы вернуться к игре.",
    jump_current: "Перейти к текущей позиции",
    stockfish_strength: "Сила Stockfish",
    done: "Готово",
    stockfish_thinking: "Stockfish думает…",
    stockfish_no_move:
      "Stockfish не вернул ход. Обновите страницу или проверьте консоль (F12).",
    saved_history: "Партия сохранена в историю.",
    save_failed:
      "Не удалось сохранить партию. Проверь Firebase rules/подключение.",

    learn_hub_title: "Обучение",
    learn_hub_desc: "Проходи тесты по теории — получай монеты и опыт.",
    lessons_heading: "Уроки",
    quizzes_heading: "Тесты",
    lesson_soon: "Скоро",
    start_quiz: "Начать тест",
    submit_quiz: "Отправить ответы",
    quiz_result: "Результат",
    coins: "Монеты",
    earned: "Получено",

    shop_title: "Магазин скинов",
    shop_desc: "Трать монеты, чтобы разблокировать скины фигур.",
    buy: "Купить",
    owned: "Есть",
    price: "Цена",
    piece_skin: "Скин фигур",
    piece_locked: "Заблокировано",
    shop_tip: "Подсказка: активный скин выбирается в профиле (раздел «Оформление»).",
    not_enough_coins: "Недостаточно монет",
    already_owned: "Уже куплено",
    purchased: "Куплено!",
    shop_purchase_failed: "Не удалось купить скин. Проверь монеты и подключение.",
    elite_checkout_failed: "Не удалось открыть оплату Elite (Stripe).",
    stripe_not_configured:
      "Stripe не настроен: в .env.local добавьте STRIPE_SECRET_KEY (секретный ключ из Stripe Dashboard → Developers → API keys) и STRIPE_ELITE_PRICE_ID — ID цены подписки вида price_… из Products (нужна именно recurring-подписка). Перезапустите npm run dev.",
    stripe_invalid_price:
      "Неверный STRIPE_ELITE_PRICE_ID: в Stripe должна быть цена подписки (recurring), её ID начинается с price_. Создайте продукт и цену в Stripe Dashboard → Products.",
    stripe_api_error_hint:
      "Ответ Stripe при создании оплаты отклонён. Проверьте ключи и режим (test/live).",
    unlock_skins_hint: "Разблокируй скины в Магазине.",
    quizzes_empty:
      "Пока нет опубликованных тестов. Запусти `npm run seed:quizzes` (нужен FIREBASE_SERVICE_ACCOUNT_JSON).",
    learn_load_failed: "Не удалось загрузить обучение",
    quiz_submit_failed: "Не удалось отправить ответы",
    quiz_not_found: "Тест не найден или снят с публикации.",
    quiz_profile_missing: "Не удалось подготовить профиль. Обновите страницу и войдите снова.",
    quiz_server_error: "Ошибка сервера при сохранении результата.",
    firestore_api_disabled:
      "В Google Cloud для этого проекта не включён API Cloud Firestore (или только что включён — подождите 2–5 минут). Откройте Firebase Console → Firestore Database → создайте базу, либо включите API «Cloud Firestore» для проекта в Google Cloud Console.",
    server_not_configured:
      "Сервер не настроен (нет FIREBASE_SERVICE_ACCOUNT_JSON). Начисления/анализы не будут работать.",
    stockfish_not_ready:
      "Stockfish не готов. Проверь что в `public/` есть `stockfish.wasm` и `stockfish.wasm.js`.",

    coach_analyze: "ИИ‑анализ",
    coach_analyzing: "Анализ…",
    coach_quota: "Бесплатные анализы в этом месяце",
    coach_elite: "Elite: безлимитные анализы",
    coach_no_auth: "Нужен вход",
    coach_failed: "Не удалось выполнить анализ",
    coach_quota_reached: "Лимит анализов на месяц",
    coach_ready: "Анализ готов",
    coach_analyze_positions: "Оценка позиций",
    coach_phase_server: "Отправка на сервер и генерация комментариев…",
    coach_replay_step_zero:
      "Начальная позиция. Нажми «Далее», чтобы листать ходы и видеть метку и комментарий к каждому ходу.",
    replay_login_prompt: "Войдите, чтобы смотреть повторы",
    game_not_found: "Партия не найдена.",
    game_forbidden: "Нет доступа к этой партии.",
    stockfish_level_label: "Уровень AI",
    elite_on: "Вкл",
    elite_off: "Выкл",

    elite_title: "Elite",
    elite_desc:
      "Подписка даёт доступ ко всем функциям Elite. Оплата проходит на защищённой странице Stripe.",
    elite_unlimited_ai: "Безлимитный ИИ‑анализ партий — без месячных лимитов.",
    elite_buy: "Купить Elite",
    elite_pay_secure_hint:
      "После успешной оплаты статус Elite обновится автоматически (нужны Stripe и webhook на сервере).",
    elite_subscription_active: "Подписка Elite активна — ИИ‑анализ без ограничений.",
    elite_dev_panel_title: "Тест: подписка без Stripe",
    elite_dev_panel_hint:
      "Включите в .env.local: ELITE_DEV_TOGGLE=true и NEXT_PUBLIC_ELITE_DEV_TOGGLE=true, перезапустите dev — затем можно выставить флаг isElite в Firebase.",
    elite_dev_on: "Есть подписка (тест)",
    elite_dev_off: "Без подписки (тест)",
    elite_dev_saved: "Флаг подписки обновлён",
    elite_dev_toggle_disabled: "Тестовый переключатель выключен на сервере (ELITE_DEV_TOGGLE).",
    elite_price_caption: "Стоимость",
    elite_price_default: "299 ₽ / мес",
    elite_subscribe: "Оформить Elite (Stripe)",
    elite_manage: "Если оплата прошла — статус обновится автоматически.",

    coach_brilliant: "Бриллиант",
    coach_good: "Хороший",
    coach_inaccuracy: "Неточность",
    coach_mistake: "Ошибка",
    coach_blunder: "Зевок",

    // Reasons / modes labels
    reason_checkmate: "Мат",
    reason_stalemate: "Пат",
    reason_repetition: "Троекратное повторение",
    reason_insufficient: "Недостаточно материала",
    reason_fifty_move: "Правило 50 ходов",
    reason_time: "Время",
    mode_ai: "Против AI",
    mode_pvp: "Локально (2 игрока)",

    no_timer: "Без времени",
    custom: "Своё",
  },
  en: {
    nav_play: "Play",
    nav_history: "History",
    nav_learn: "Learn",
    nav_rating: "Rating",
    nav_shop: "Shop",
    nav_login: "Login",
    nav_profile: "Profile",
    nav_logout: "Sign out",
    theme_light: "Light",
    theme_dark: "Dark",
    firebase_not_configured: "Firebase not configured",
    toast_login_success: "Login successful",
    toast_logged_out: "Logged out",

    // Home
    home_title: "KAZ CHESS",
    home_desc:
      "Chess is a strategy game that helps develop focus, calculation, and patience. Choose a mode and enjoy the process. Good luck!",
    home_play: "Play",
    home_history: "History",
    home_settings: "Profile & settings",
    home_shop: "Shop",
    home_tip_moves:
      "Tip: in game, click or drag a piece to see legal moves (green) and captures (red).",

    // Learn
    learn_title: "Learn",
    learn_desc:
      "Puzzles, lessons, and openings will appear here. This is a placeholder for now.",
    back_home: "Back home",
    main_menu: "Main menu",

    // Lobby
    lobby_title: "Game lobby",
    lobby_desc: "Choose a mode, time control, and (if needed) Stockfish strength. Then press Start.",
    match_settings: "Match settings",
    you_play_white: "In AI mode you play White, Stockfish plays Black.",
    minutes: "Minutes",
    rated_hint: "Rated (Elo updates, undo disabled)",
    lobby_cta: "Start",
    lobby_footer: "KAZ CHESS saves your games to history so you can review and learn.",

    // Auth
    login_title: "Login",
    signup_title: "Create account",
    email: "Email",
    password: "Password",
    username: "Username",
    confirm_password: "Confirm password",
    login_button: "Sign in",
    signup_button: "Sign up",
    google_login: "Continue with Google",
    google_signup: "Sign up with Google",
    forgot_password: "Forgot Password?",
    reset_password_title: "Reset password",
    send_reset_link: "Send reset link",
    sending: "Sending…",
    signing_in: "Signing in…",
    creating: "Creating…",
    no_account: "No account?",
    have_account: "Already have an account?",
    link_signup: "Sign up",
    link_login: "Login",
    reset_email_hint:
      "If the email is registered, you will receive a reset link.",
    reset_sent: "Password reset link sent to your email",
    invalid_credentials: "Invalid credentials",
    firebase_env_hint: "Firebase not configured. Check .env.local.",
    toast_account_created: "Account created",

    // Settings
    settings_title: "Settings",
    account_page_title: "Profile & settings",
    interface_prefs_heading: "Appearance",
    appearance: "Appearance",
    board_theme: "Chessboard theme",
    applied_in_game: "Applied in game and replays.",

    // Profile
    profile_title: "Profile",
    profile_security: "Security",
    change_password: "Change password",
    new_password: "New password (min 6)",
    confirm_new_password: "Confirm new password",
    password_updated: "Password updated",
    password_min: "Password must be at least 6 characters",
    passwords_no_match: "Passwords do not match",
    relogin_required: "Please log in again to change your password.",
    logout: "Logout",

    // History
    history_title: "Game history",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    no_games: "No saved games yet.",
    details: "Details",
    moves: "Moves",
    result: "Result",
    reason: "Reason",
    mode: "Mode",
    time: "Time",
    back_to_history: "Back to history",
    replay_title: "Replay",
    back_to_list: "Back to list",
    loading: "Loading…",
    loading_game: "Loading game…",
    prev: "← Prev",
    next: "Next →",
    start: "Start",
    end: "End",

    // Leaderboard
    leaderboard_title: "Rating",
    leaderboard_tab_elo: "Elo",
    leaderboard_tab_students: "Students",
    leaderboard_desc: "Top players by Elo (rated vs AI).",
    students_leaderboard_desc: "Top students by XP/level (learning rewards).",
    player: "Player",
    no_players: "No entries yet.",
    xp: "XP",
    level: "Level",

    // Game
    white: "White",
    black: "Black",
    check: "Check",
    white_to_move: "White to move",
    black_to_move: "Black to move",
    new_game: "New game",
    rematch: "Rematch",
    undo: "Undo",
    game_setup: "Game setup",
    time_control: "Time control",
    custom_minutes: "Custom (minutes)",
    review_mode: "Review mode — click the latest move to return to play.",
    jump_current: "Jump to current position",
    stockfish_strength: "Stockfish strength",
    done: "Done",
    stockfish_thinking: "Stockfish thinking…",
    stockfish_no_move:
      "Engine did not return a move. Refresh the page or check the console (F12).",
    saved_history: "Saved to history.",
    save_failed:
      "Failed to save game to history. Check Firebase rules/connection.",

    learn_hub_title: "Learning",
    learn_hub_desc: "Take theory quizzes — earn coins and XP.",
    lessons_heading: "Lessons",
    quizzes_heading: "Quizzes",
    lesson_soon: "Soon",
    start_quiz: "Start quiz",
    submit_quiz: "Submit answers",
    quiz_result: "Result",
    coins: "Coins",
    earned: "Earned",

    shop_title: "Piece skins shop",
    shop_desc: "Spend coins to unlock piece skins.",
    buy: "Buy",
    owned: "Owned",
    price: "Price",
    piece_skin: "Piece skin",
    piece_locked: "Locked",
    shop_tip: "Tip: choose the active piece skin in Profile (Appearance section).",
    not_enough_coins: "Not enough coins",
    already_owned: "Already owned",
    purchased: "Purchased!",
    shop_purchase_failed: "Could not buy the skin. Check your balance and connection.",
    elite_checkout_failed: "Could not start Elite checkout (Stripe).",
    stripe_not_configured:
      "Stripe is not configured: add STRIPE_SECRET_KEY (secret key from Stripe Dashboard → Developers → API keys) and STRIPE_ELITE_PRICE_ID (a recurring subscription price id starting with price_) to .env.local, then restart npm run dev.",
    stripe_invalid_price:
      "Invalid STRIPE_ELITE_PRICE_ID: create a recurring subscription price in Stripe Dashboard → Products and use its price_… id.",
    stripe_api_error_hint:
      "Stripe rejected checkout creation. Verify API keys and test/live mode.",
    unlock_skins_hint: "Unlock skins in the Shop.",
    quizzes_empty:
      "No quizzes published yet. Run `npm run seed:quizzes` (with FIREBASE_SERVICE_ACCOUNT_JSON).",
    learn_load_failed: "Failed to load learning",
    quiz_submit_failed: "Failed to submit answers",
    quiz_not_found: "Quiz not found or unpublished.",
    quiz_profile_missing: "Could not prepare your profile. Refresh and sign in again.",
    quiz_server_error: "Server error while saving your result.",
    firestore_api_disabled:
      "Cloud Firestore API is disabled for this Google Cloud project (or was enabled recently — wait 2–5 minutes). Open Firebase Console → Firestore Database → create a database, or enable the Cloud Firestore API for the project in Google Cloud Console.",
    server_not_configured:
      "Server is not configured (missing FIREBASE_SERVICE_ACCOUNT_JSON). Awards/analysis won't work.",
    stockfish_not_ready:
      "Stockfish is not ready. Check `public/` has `stockfish.wasm` and `stockfish.wasm.js`.",

    coach_analyze: "AI analysis",
    coach_analyzing: "Analyzing…",
    coach_quota: "Free analyses this month",
    coach_elite: "Elite: unlimited analyses",
    coach_no_auth: "Login required",
    coach_failed: "Analysis failed",
    coach_quota_reached: "Monthly analysis limit reached",
    coach_ready: "Analysis ready",
    coach_analyze_positions: "Position evaluations",
    coach_phase_server: "Sending to server and generating comments…",
    coach_replay_step_zero:
      "Start position. Press Next to step through moves and see labels and notes for each move.",
    replay_login_prompt: "Log in to view replays",
    game_not_found: "Game not found.",
    game_forbidden: "You cannot view this game.",
    stockfish_level_label: "AI level",
    elite_on: "ON",
    elite_off: "OFF",

    elite_title: "Elite",
    elite_desc:
      "Subscription unlocks Elite features. Checkout opens on Stripe’s secure page.",
    elite_unlimited_ai: "Unlimited AI game analyses — no monthly quota.",
    elite_buy: "Buy Elite",
    elite_pay_secure_hint:
      "After payment, Elite status updates automatically (requires Stripe keys & webhook on the server).",
    elite_subscription_active: "Elite is active — unlimited AI analysis.",
    elite_dev_panel_title: "Test: subscription without Stripe",
    elite_dev_panel_hint:
      "Add to .env.local: ELITE_DEV_TOGGLE=true and NEXT_PUBLIC_ELITE_DEV_TOGGLE=true, restart dev — then toggle isElite in Firebase.",
    elite_dev_on: "Has subscription (test)",
    elite_dev_off: "No subscription (test)",
    elite_dev_saved: "Subscription flag updated",
    elite_dev_toggle_disabled: "Dev toggle is off on the server (ELITE_DEV_TOGGLE).",
    elite_price_caption: "Price",
    elite_price_default: "€4.99 / mo",
    elite_subscribe: "Subscribe to Elite (Stripe)",
    elite_manage: "After payment, status updates automatically.",

    coach_brilliant: "Brilliant",
    coach_good: "Good",
    coach_inaccuracy: "Inaccuracy",
    coach_mistake: "Mistake",
    coach_blunder: "Blunder",

    // Reasons / modes labels
    reason_checkmate: "Checkmate",
    reason_stalemate: "Stalemate",
    reason_repetition: "Threefold repetition",
    reason_insufficient: "Insufficient material",
    reason_fifty_move: "Fifty-move rule",
    reason_time: "Time",
    mode_ai: "vs AI",
    mode_pvp: "Local PvP",

    no_timer: "No timer",
    custom: "Custom",
  },
};

const LocaleContext = createContext({
  locale: "ru",
  setLocale: /** @type {(loc: "ru"|"en") => void} */ (() => {}),
  toggleLocale: /** @type {() => void} */ (() => {}),
  t: /** @type {(key: keyof typeof STRINGS["ru"]) => string} */ (() => ""),
  labelReason: /** @type {(reason: string) => string} */ (() => ""),
  labelMode: /** @type {(mode: string) => string} */ (() => ""),
  labelCoach: /** @type {(label: string) => string} */ (() => ""),
});

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState("ru");

  useEffect(() => {
    const v = safeLocalStorageGet(STORAGE_KEY, "ru");
    setLocaleState(v === "en" ? "en" : "ru");
  }, []);

  const setLocale = useCallback((loc) => {
    const v = loc === "en" ? "en" : "ru";
    setLocaleState(v);
    safeLocalStorageSet(STORAGE_KEY, v);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === "ru" ? "en" : "ru";
      safeLocalStorageSet(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key) => {
      const table = STRINGS[locale] || STRINGS.ru;
      return table[key] || STRINGS.ru[key] || String(key);
    },
    [locale]
  );

  const labelReason = useCallback(
    (reason) => {
      switch (reason) {
        case "checkmate":
          return t("reason_checkmate");
        case "stalemate":
          return t("reason_stalemate");
        case "repetition":
          return t("reason_repetition");
        case "insufficient":
          return t("reason_insufficient");
        case "fifty-move":
          return t("reason_fifty_move");
        case "time":
          return t("reason_time");
        default:
          return t("reason");
      }
    },
    [t]
  );

  const labelMode = useCallback(
    (mode) => {
      if (mode === "ai") return t("mode_ai");
      if (mode === "pvp") return t("mode_pvp");
      return String(mode || "—");
    },
    [t]
  );

  const labelCoach = useCallback(
    (label) => {
      switch (label) {
        case "brilliant":
          return t("coach_brilliant");
        case "good":
          return t("coach_good");
        case "inaccuracy":
          return t("coach_inaccuracy");
        case "mistake":
          return t("coach_mistake");
        case "blunder":
          return t("coach_blunder");
        default:
          return String(label || "—");
      }
    },
    [t]
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t, labelReason, labelMode, labelCoach }),
    [locale, setLocale, toggleLocale, t, labelReason, labelMode, labelCoach]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}


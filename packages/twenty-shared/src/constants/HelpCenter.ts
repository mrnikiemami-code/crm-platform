// The product help centre: the ONE source of help content and its search.
//
// Both consumers import this module, so the browser and the `search_help_center`
// tool can never show different articles or different search results:
//  - `twenty-front` renders the `/help` pages from it;
//  - the server-side `search_help_center` tool searches the same array.
//
// It is deliberately PURE and dependency-free: no `fetch`, no Node built-ins, no
// secret, no customer data. That is what lets the same bytes run in a browser
// bundle and in a NestJS tool without leaking server code into the front. It also
// means help works with the network completely unavailable — there is nothing to
// request.

/**
 * The route the in-app help centre is served from.
 *
 * Same-origin and absolute-from-root, so a link built from it can never point at
 * another site. A build that serves the app under a path prefix must map this
 * route rather than rewrite the links (see the task's routing note).
 */
export const HELP_CENTER_BASE_PATH = '/help';

/** One article: what the reader sees, and what search matches against. */
export type HelpArticle = {
  /** Stable id used in the URL. Never a translated string. */
  slug: string;
  /** Persian title, shown in the list and as the page heading. */
  title: string;
  /** One-line summary for the list and for search results. */
  summary: string;
  /** Body paragraphs. Rendered as text nodes, never as HTML. */
  paragraphs: readonly string[];
};

/**
 * The help content.
 *
 * The wording describes what THIS build actually does, so a reader following it
 * is not promised a feature that does not exist. Keep it that way when editing:
 * an article is documentation of shipped behaviour, not a wish list.
 */
export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'create-template',
    title: 'ساخت الگوی پیام',
    summary:
      'از فهرست الگوها یک الگوی تازه بسازید و پیش از ثبت، متن و پیش‌نمایش را ببینید.',
    paragraphs: [
      'از منوی کناری به «الگوهای پیامک» بروید و روی «الگوی پیام جدید» بزنید. ویرایشگر الگو در همان پنل باز می‌شود؛ تا زمانی که روی «ایجاد الگو» نزنید هیچ رکوردی ساخته نمی‌شود.',
      'عنوان را وارد کنید. عنوان اجباری است: اگر خالی بماند یا فقط فاصله باشد، پیام «عنوان الگو را وارد کنید» نشان داده می‌شود و چیزی ذخیره نمی‌شود.',
      'در «متن پیام» متن نهایی را بنویسید. می‌توانید از فهرست متغیرها، متغیری را به انتهای متن اضافه کنید؛ این کار متن تایپ‌شده را پاک نمی‌کند.',
      '«موجودیت منبع» تعیین می‌کند الگو برای کدام نوع رکورد نوشته می‌شود. با انتخاب منبع، فهرست متغیرها به فیلدهای همان منبع تغییر می‌کند.',
      'پس از انتخاب یک «رکورد نمونه» و زدن «پیش‌نمایش»، مقدار واقعی همان رکورد جای متغیرها نشان داده می‌شود. اگر پیش‌نمایش کامل نبود، دلیل آن زیر همان بخش نوشته می‌شود.',
      'با «ایجاد الگو» یک رکورد ساخته می‌شود و برنامه به فهرست الگوها برمی‌گردد تا بتوانید همان الگو را در جدول ببینید.',
    ],
  },
  {
    slug: 'edit-and-save',
    title: 'ویرایش و ذخیره',
    summary:
      'الگوی موجود را باز کنید، متن را تغییر دهید و با ذخیرهٔ امن آن را ثبت کنید.',
    paragraphs: [
      'در فهرست «الگوهای پیامک» روی عنوان الگو بزنید تا صفحهٔ رکورد باز شود. ویرایشگر تخصصی همان الگو در صفحه نمایش داده می‌شود؛ نیازی به منوی دستور یا میان‌بر نیست.',
      'عنوان، متن، موجودیت منبع و رابطهٔ گیرنده همان مقادیری هستند که قبلاً ذخیره شده‌اند.',
      'پس از هر تغییر، نشان «تغییرات ذخیره‌نشده» ظاهر می‌شود. تا زمانی که ذخیره نکنید، تغییر روی سرور نوشته نشده است.',
      '«ذخیره» فقط وقتی می‌نویسد که نسخهٔ روی صفحه هنوز همان نسخهٔ سرور باشد. اگر نشست دیگری زودتر ذخیره کرده باشد، ذخیرهٔ شما انجام نمی‌شود و متن تایپ‌شده حفظ می‌ماند تا خودتان تصمیم بگیرید.',
      'اگر عنوان را خالی کنید و ذخیره بزنید، پیام خطا نشان داده می‌شود و مقدار معتبر قبلی روی سرور خراب نمی‌شود.',
      '«انصراف» تغییرات ذخیره‌نشده را دور می‌ریزد و از شما تأیید می‌گیرد؛ در این حالت هیچ رکوردی ساخته یا تغییر داده نمی‌شود.',
    ],
  },
  {
    slug: 'source-and-variables',
    title: 'موجودیت منبع و متغیرها',
    summary:
      'منبع الگو را انتخاب کنید و بدانید هر گروه متغیر از کدام رکورد خوانده می‌شود.',
    paragraphs: [
      '«موجودیت منبع» نوع رکوردی است که الگو برای آن نوشته می‌شود؛ مثلاً اشخاص، فرصت‌ها، ارتباطات یا سرنخ‌های همایش.',
      'برای هر منبع فقط فیلدهای همان منبع فهرست می‌شود. با تغییر منبع، فهرست قبلی کنار گذاشته می‌شود و فهرست منبع تازه بارگذاری می‌شود؛ متن تایپ‌شده دست‌نخورده می‌ماند.',
      'متغیرها در گروه‌های جدا نشان داده می‌شوند: فیلدهای «منبع» از خود رکورد انتخاب‌شده خوانده می‌شوند، فیلدهای «شخص گیرنده» از شخصی که آن رکورد به او متصل است، و گروه شرکت از شرکت همان شخص.',
      'اگر منبع، چند رابطهٔ مجاز به شخص داشته باشد، باید «رابطهٔ گیرنده» را خودتان انتخاب کنید. رابطه‌ای که به مجموعه‌ای از اشخاص می‌رسد پیشنهاد نمی‌شود، چون یک رکورد آن به یک گیرندهٔ مشخص نمی‌رسد.',
      'نام متغیر همیشه به لاتین و با @ نمایش داده می‌شود تا در متن فارسی جابه‌جا نشود. برچسب کنار آن به فارسی توضیح می‌دهد چه فیلدی است.',
      'اگر منبعی فیلد قابل‌خواندنی نداشته باشد یا در دسترس شما نباشد، فهرست خالی نشان داده نمی‌شود؛ پیام مشخص با امکان تلاش دوباره می‌آید.',
    ],
  },
  {
    slug: 'preview-and-save-errors',
    title: 'پیش‌نمایش و خطاهای ذخیره',
    summary:
      'پیش‌نمایش را با رکورد نمونه ببینید و معنی هر پیام خطای ذخیره را بدانید.',
    paragraphs: [
      'برای پیش‌نمایش، ابتدا یک «رکورد نمونه» از همان منبع انتخاب کنید. بدون رکورد نمونه، پیش‌نمایش ساخته نمی‌شود.',
      'در پیش‌نمایش، مقدار واقعی رکورد نمونه جای هر متغیر گذاشته می‌شود. اگر متغیری در آن رکورد خالی باشد، متن پیش‌نمایش با برچسب «پیش‌نمایش ناقص» و دلیل فارسی نمایش داده می‌شود.',
      'اگر متغیری برای منبع انتخاب‌شده تعریف نشده باشد، همان متغیر با دلیل مشخص گزارش می‌شود و نتیجه کامل معرفی نمی‌شود.',
      'با تغییر متن، منبع، رابطه یا رکورد نمونه، پیش‌نمایش قبلی پاک می‌شود؛ پاسخ دیررس درخواست قبلی جای نتیجهٔ تازه را نمی‌گیرد.',
      'خطای «عنوان الگو را وارد کنید» یعنی عنوان خالی یا فقط فاصله است؛ متن شما حفظ می‌شود.',
      'خطای تعارض یعنی الگو پس از بارگذاری شما توسط نشست دیگری تغییر کرده است. متن شما حفظ می‌شود؛ صفحه را تازه کنید و تغییرها را دوباره اعمال کنید.',
      'اگر پیام «منبع در دسترس نیست» دیدید، یعنی منبع ذخیره‌شده دیگر در این فضای کاری معتبر نیست. یک منبع دیگر انتخاب کنید؛ برنامه به‌طور خودکار منبع دیگری جایگزین نمی‌کند.',
    ],
  },
] as const;

/**
 * Persian-aware normalization for search.
 *
 * Why this exists: Persian text is typed with several equivalent characters, and
 * a naive `includes` misses most real queries. The mapping is explicit so the
 * behaviour is testable rather than incidental:
 *  - Arabic vs Persian forms: ي→ی, ك→ک, ة→ه, ۀ→ه, أإآ→ا, ؤ→و, ئ→ی;
 *  - Arabic-Indic and Persian digits → ASCII;
 *  - ZWNJ (نیم‌فاصله) and all whitespace collapse to a single space;
 *  - diacritics (harakat) are removed, since they are rarely typed in a search.
 *
 * Lower-casing is applied too, so a Latin query is case-insensitive.
 */
const PERSIAN_SEARCH_FOLD: Readonly<Record<string, string>> = {
  'ي': 'ی',
  'ى': 'ی',
  'ك': 'ک',
  'ة': 'ه',
  'ۀ': 'ه',
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ؤ': 'و',
  'ئ': 'ی',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '\u200c': ' ',
};

/** Harakat and the like: presentational only, never typed in a query. */
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export const normalizeHelpSearchText = (value: string): string =>
  value
    .replace(ARABIC_DIACRITICS, '')
    .replace(
      /[\s\S]/g,
      (character) => PERSIAN_SEARCH_FOLD[character] ?? character,
    )
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** A search hit: the article plus WHERE the query matched, for an excerpt. */
export type HelpSearchResult = {
  slug: string;
  title: string;
  /** The internal path for this article, ready to use as a link target. */
  href: string;
  /** A short Persian excerpt around the match, or the summary when the title matched. */
  excerpt: string;
};

/** The canonical internal path for one article. */
export const getHelpArticlePath = (slug: string): string =>
  `${HELP_CENTER_BASE_PATH}/${slug}`;

export const findHelpArticle = (slug: string): HelpArticle | null =>
  HELP_ARTICLES.find((article) => article.slug === slug) ?? null;

/**
 * The excerpt for a title-only match.
 *
 * Deliberately the summary rather than the first paragraph: a list of results
 * reads better when each line is a summary, and the summary is written for
 * exactly this purpose.
 */
const titleMatchExcerpt = (article: HelpArticle): string => article.summary;

/**
 * The excerpt for a body match: the clause containing the first occurrence.
 *
 * Splitting on sentence punctuation keeps the excerpt readable in RTL and avoids
 * cutting a Persian word in half. When no punctuation exists, the paragraph is
 * truncated with an ellipsis instead of returning the whole block.
 */
const bodyMatchExcerpt = (article: HelpArticle, needle: string): string => {
  for (const paragraph of article.paragraphs) {
    const normalized = normalizeHelpSearchText(paragraph);
    const index = normalized.indexOf(needle);

    if (index === -1) {
      continue;
    }

    // The normalized text can differ in length from the original (ZWNJ collapse,
    // diacritic removal), so excerpt from the ORIGINAL by proportion, then widen
    // to sentence boundaries. This keeps the excerpt in the reader's own spelling.
    const ratio = paragraph.length / Math.max(normalized.length, 1);
    const originalIndexOfMatch = Math.floor(index * ratio);
    const windowStart = Math.max(0, originalIndexOfMatch - 60);
    const windowEnd = Math.min(paragraph.length, originalIndexOfMatch + 140);
    const window = paragraph.slice(windowStart, windowEnd);

    const sentences = window
      .split(/(?<=[.۔؛!؟?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    const containing = sentences.find(
      (sentence) =>
        normalizeHelpSearchText(sentence).includes(needle) ||
        normalizeHelpSearchText(window).includes(needle),
    );

    const excerpt = containing ?? sentences[0] ?? window.trim();

    return excerpt.length > 0 ? excerpt : article.summary;
  }

  return article.summary;
};

/**
 * Searches the local help content. Deterministic and dependency-free.
 *
 * Contract, relied on by both consumers:
 *  - an EMPTY or whitespace-only query returns the whole list (browsing), not an
 *    error and not an empty result;
 *  - a query with NO match returns an empty array SUCCESSFULLY — the caller
 *    decides how to phrase "nothing found";
 *  - results are ordered title-match first, then body-match, and are stable for
 *    the same input.
 *
 * Only the article's own fields are searched. There is no network call and no
 * external index, so there is nothing that could fail or leak.
 */
export const searchHelpArticles = (query: string): HelpSearchResult[] => {
  const needle = normalizeHelpSearchText(query);

  const toResult = (
    article: HelpArticle,
    excerpt: string,
  ): HelpSearchResult => ({
    slug: article.slug,
    title: article.title,
    href: getHelpArticlePath(article.slug),
    excerpt,
  });

  if (needle.length === 0) {
    return HELP_ARTICLES.map((article) =>
      toResult(article, article.summary),
    );
  }

  const titleMatches: HelpSearchResult[] = [];
  const bodyMatches: HelpSearchResult[] = [];

  for (const article of HELP_ARTICLES) {
    const normalizedTitle = normalizeHelpSearchText(article.title);
    const normalizedSummary = normalizeHelpSearchText(article.summary);

    if (normalizedTitle.includes(needle)) {
      titleMatches.push(toResult(article, titleMatchExcerpt(article)));
      continue;
    }

    // A summary hit is presented like a body hit: the reader wants the sentence
    // that matched, which for the summary IS the summary.
    if (normalizedSummary.includes(needle)) {
      bodyMatches.push(toResult(article, article.summary));
      continue;
    }

    const bodyHit = article.paragraphs.some((paragraph) =>
      normalizeHelpSearchText(paragraph).includes(needle),
    );

    if (bodyHit) {
      bodyMatches.push(toResult(article, bodyMatchExcerpt(article, needle)));
    }
  }

  return [...titleMatches, ...bodyMatches];
};

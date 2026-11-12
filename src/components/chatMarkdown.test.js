// CHAT-QUALITY-fe, регрессия CQF-1…CQF-3 (DESIGN.md §3 «FE-1», §6 контур 5, §7).
// Контракт модуля, который тест закрепляет: src/components/chatMarkdown.js, ДЕФОЛТНЫЙ экспорт —
// React-компонент <ChatMarkdown text={string} />. Он рисует только React-узлы узкого подмножества
// разметки: абзацы (p), перенос строки (br), strong, em, списки ul/ol > li. Никакого HTML из текста,
// никаких ссылок и картинок, без dangerouslySetInnerHTML и без новой библиотеки.
import fs from "fs";
import path from "path";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ChatMarkdown from "./chatMarkdown";

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  delete window.__xss;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const show = async text => act(async () => root.render(<ChatMarkdown text={text} />));
const all = selector => [...container.querySelectorAll(selector)];
const texts = selector => all(selector).map(el => el.textContent);
const ALLOWED_TAGS = ["DIV", "SPAN", "P", "BR", "STRONG", "EM", "UL", "OL", "LI"];
const FORBIDDEN_ATTRIBUTES = /^(on|href$|src$|srcdoc$|style$|action$|formaction$|xlink)/i;
const expectOnlySafeMarkup = () => {
  all("*").forEach(el => {
    expect(ALLOWED_TAGS).toContain(el.tagName);
    [...el.attributes].forEach(attribute => expect(attribute.name).not.toMatch(FORBIDDEN_ATTRIBUTES));
  });
};

describe("CQF-1: разметка, которую модель отдаёт в ответах", () => {
  it("делит текст на абзацы по пустой строке", async () => {
    await show("Первый абзац.\n\nВторой абзац.\n\nТретий абзац.");
    expect(texts("p")).toEqual(["Первый абзац.", "Второй абзац.", "Третий абзац."]);
  });

  it("понимает пустую строку и с пробелами, и в стиле Windows (\\r\\n)", async () => {
    await show("Один\r\n\r\nДва\n   \nТри");
    expect(texts("p")).toEqual(["Один", "Два", "Три"]);
  });

  it("одиночный перенос строки внутри абзаца даёт br, а не новый абзац", async () => {
    await show("Первая строка\nвторая строка");
    expect(all("p")).toHaveLength(1);
    expect(all("p br")).toHaveLength(1);
    expect(container.textContent).toContain("Первая строка");
    expect(container.textContent).toContain("вторая строка");
  });

  it("**жирное** становится strong без звёздочек", async () => {
    await show("Это **важно** для вас.");
    expect(texts("strong")).toEqual(["важно"]);
    expect(container.textContent).toBe("Это важно для вас.");
  });

  it("__жирное__ тоже становится strong без подчёркиваний", async () => {
    await show("Это __важно__ для вас.");
    expect(texts("strong")).toEqual(["важно"]);
    expect(container.textContent).toBe("Это важно для вас.");
  });

  it("*курсив* становится em без звёздочек", async () => {
    await show("Это *тонко* заметно.");
    expect(texts("em")).toEqual(["тонко"]);
    expect(container.textContent).toBe("Это тонко заметно.");
  });

  it("жирное и курсив в одном абзаце не мешают друг другу", async () => {
    await show("**Главное** и *второстепенное* рядом.");
    expect(texts("strong")).toEqual(["Главное"]);
    expect(texts("em")).toEqual(["второстепенное"]);
    expect(container.textContent).toBe("Главное и второстепенное рядом.");
  });

  it("список «- » — семантический ul > li без маркеров в тексте", async () => {
    await show("- Первый пункт\n- Второй пункт\n- Третий пункт");
    expect(all("ul")).toHaveLength(1);
    expect([...container.querySelector("ul").children].map(el => el.tagName)).toEqual(["LI", "LI", "LI"]);
    expect(texts("li")).toEqual(["Первый пункт", "Второй пункт", "Третий пункт"]);
    expect(all("ol")).toHaveLength(0);
  });

  it("список «* » — тоже ul > li, звёздочки не видны", async () => {
    await show("* Раз\n* Два\n* Три");
    expect(texts("ul > li")).toEqual(["Раз", "Два", "Три"]);
    expect(container.textContent).not.toContain("*");
    expect(all("em")).toHaveLength(0);
  });

  it("список «• » — тоже ul > li, точки не видны", async () => {
    await show("• Раз\n• Два\n• Три");
    expect(texts("ul > li")).toEqual(["Раз", "Два", "Три"]);
    expect(container.textContent).not.toContain("•");
  });

  it("нумерованный список «1. » — семантический ol > li без номеров в тексте", async () => {
    await show("1. Первое\n2. Второе\n3. Третье");
    expect(all("ol")).toHaveLength(1);
    expect([...container.querySelector("ol").children].map(el => el.tagName)).toEqual(["LI", "LI", "LI"]);
    expect(texts("li")).toEqual(["Первое", "Второе", "Третье"]);
    expect(all("ul")).toHaveLength(0);
  });

  it("нумерованный список «1) » — тоже ol > li", async () => {
    await show("1) Первое\n2) Второе");
    expect(texts("ol > li")).toEqual(["Первое", "Второе"]);
    expect(container.textContent).not.toContain(")");
  });

  it("жирное внутри пункта списка остаётся strong внутри li", async () => {
    await show("- **Солнце** в Рыбах\n- **Луна** в Раке");
    expect(texts("li > strong")).toEqual(["Солнце", "Луна"]);
    expect(texts("li")).toEqual(["Солнце в Рыбах", "Луна в Раке"]);
  });

  it("абзац, список и абзац идут в том же порядке, что в тексте", async () => {
    await show("Вот что важно.\n\n- один\n- два\n- три\n\nИтог: всё сходится.");
    expect(all("p, ul, ol").map(el => el.tagName)).toEqual(["P", "UL", "P"]);
    expect(texts("p")).toEqual(["Вот что важно.", "Итог: всё сходится."]);
    expect(texts("li")).toEqual(["один", "два", "три"]);
  });

  it("список сразу после строки без пустой строки тоже становится списком", async () => {
    await show("Вот что важно:\n- один\n- два\n- три");
    expect(all("p, ul, ol").map(el => el.tagName)).toEqual(["P", "UL"]);
    expect(texts("p")).toEqual(["Вот что важно:"]);
    expect(texts("li")).toEqual(["один", "два", "три"]);
  });

  it("строка с «#» становится абзацем жирным, без заголовка и без решёток", async () => {
    await show("### Главное про карту\n\nОбычный текст.");
    expect(all("h1, h2, h3, h4, h5, h6")).toHaveLength(0);
    expect(texts("p")).toEqual(["Главное про карту", "Обычный текст."]);
    expect(texts("p > strong")).toEqual(["Главное про карту"]);
    expect(container.textContent).not.toContain("#");
  });

  it("«#» с одним знаком и «##» ведут себя так же", async () => {
    await show("# Раз\n\n## Два");
    expect(all("h1, h2")).toHaveLength(0);
    expect(texts("p > strong")).toEqual(["Раз", "Два"]);
    expect(container.textContent).not.toContain("#");
  });

  it("решётка внутри строки остаётся текстом", async () => {
    await show("Дом #5 важен для вас.");
    expect(container.textContent).toBe("Дом #5 важен для вас.");
    expect(all("strong")).toHaveLength(0);
  });

  it("строка «---» пропускается: ни hr, ни чёрточек", async () => {
    await show("Раз\n\n---\n\nДва");
    expect(all("hr")).toHaveLength(0);
    expect(texts("p")).toEqual(["Раз", "Два"]);
    expect(container.textContent).not.toContain("---");
  });

  it("обратные кавычки убираются, текст остаётся", async () => {
    await show("Попробуйте `Луна в Раке` осознанно.");
    expect(container.textContent).toBe("Попробуйте Луна в Раке осознанно.");
  });

  it("текст без разметки выводится как есть, одним абзацем", async () => {
    await show("Просто ответ без оформления, с запятыми и точкой.");
    expect(texts("p")).toEqual(["Просто ответ без оформления, с запятыми и точкой."]);
    expect(all("strong, em, ul, ol, li, br")).toHaveLength(0);
  });

  it("пустой текст, null и undefined не падают и ничего не рисуют", async () => {
    for (const value of ["", null, undefined, "\n\n  \n"]) {
      await show(value);
      expect(container.textContent.trim()).toBe("");
      expect(all("strong, em, ul, ol, li, a, img")).toHaveLength(0);
    }
  });
});

describe("CQF-2: никакого HTML и никаких ссылок из ответа модели", () => {
  it("<img src=x onerror=…> остаётся текстом: нет img, нет onerror-атрибута", async () => {
    await show("Смотрите <img src=x onerror=alert(1)> вот.");
    expect(all("img")).toHaveLength(0);
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    expectOnlySafeMarkup();
  });

  it("<script> остаётся текстом: нет script, код не выполняется", async () => {
    await show("До <script>window.__xss = 1</script> после");
    expect(all("script")).toHaveLength(0);
    expect(container.textContent).toContain("<script>window.__xss = 1</script>");
    expect(window.__xss).toBeUndefined();
    expectOnlySafeMarkup();
  });

  it("[текст](http://…) даёт только текст: нет a, адреса не видно", async () => {
    await show("Смотрите [подробнее](http://evil.example/page) тут.");
    expect(all("a")).toHaveLength(0);
    expect(container.textContent).toBe("Смотрите подробнее тут.");
    expect(container.textContent).not.toContain("evil.example");
  });

  it("[текст](javascript:…) даёт только текст: нет a, нет javascript:", async () => {
    await show("Нажмите [сюда](javascript:window.__xss=1) пожалуйста.");
    expect(all("a")).toHaveLength(0);
    expect(container.textContent).toBe("Нажмите сюда пожалуйста.");
    expect(container.textContent).not.toContain("javascript:");
    expect(window.__xss).toBeUndefined();
  });

  it("ссылка со скобками в адресе даёт только текст: нет a, адреса не видно", async () => {
    await show("Нажмите [x](javascript:alert(1)) и [Марс](https://ru.wikipedia.org/wiki/Марс_(планета)) тут.");
    expect(all("a")).toHaveLength(0);
    expect(container.textContent).toBe("Нажмите x и Марс тут.");
    expect(container.textContent).not.toContain("javascript:");
    expect(container.textContent).not.toContain("wikipedia");
    expectOnlySafeMarkup();
  });

  it("ссылки со скобками: незакрытые и вложенные глубже одного уровня не ломают разбор и не виснут", async () => {
    await show("[x](a(b(c))) и [y](a(b");
    expect(container.textContent).toContain("[y](a(b");
    expect(all("a")).toHaveLength(0);
    const started = performance.now();
    await show("[т](".repeat(4000));
    await show("[т](a(".repeat(4000));
    await show(`[т](${"(а".repeat(20000)}`);
    await show(`[т](${"(а)".repeat(20000)}`);
    expect(performance.now() - started).toBeLessThan(3000);
  });

  it("![картинка](http://…) не превращается в img", async () => {
    await show("Вот ![схема](http://evil.example/p.png) карты.");
    expect(all("img")).toHaveLength(0);
    expect(all("a")).toHaveLength(0);
    expectOnlySafeMarkup();
  });

  it("голый адрес http://… не становится ссылкой", async () => {
    await show("Адрес http://evil.example/page и https://evil.example/x в тексте.");
    expect(all("a")).toHaveLength(0);
    expectOnlySafeMarkup();
  });

  it("готовый <a href=javascript:…> остаётся текстом", async () => {
    await show('Тут <a href="javascript:window.__xss=1">клик</a> конец.');
    expect(all("a")).toHaveLength(0);
    expect(container.textContent).toContain("<a href=");
    expectOnlySafeMarkup();
  });

  it.each([
    ["img в жирном", "**<img src=x onerror=alert(1)>**"],
    ["img в пункте списка", "- <img src=x onerror=alert(1)>\n- второй"],
    ["script в строке с решёткой", "# <script>window.__xss=1</script>"],
    ["svg с onload", "Знак <svg onload=window.__xss=1> тут"],
    ["iframe", '<iframe src="http://evil.example"></iframe>'],
    ["style", "<style>body{display:none}</style> текст"],
    ["ссылка в жирном", "**[текст](http://evil.example)**"],
    ["ссылка в пункте списка", "1. [текст](http://evil.example)\n2. [ещё](javascript:window.__xss=1)"],
    ["ссылка с курсивом в тексте", "*[текст](http://evil.example)* и [**жирный**](http://evil.example)"],
  ])("враждебный ввод (%s): только безопасные теги и атрибуты", async (_name, payload) => {
    await show(payload);
    expectOnlySafeMarkup();
    expect(window.__xss).toBeUndefined();
  });

  it("исходник модуля не использует innerHTML и dangerouslySetInnerHTML", () => {
    const source = fs.readFileSync(path.join(__dirname, "chatMarkdown.js"), "utf8");
    expect(source).not.toMatch(/dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|document\.write/);
  });
});

describe("CQF-3: края разбора и обрыв посреди разметки", () => {
  it("незакрытое ** во время потока остаётся буквально, без strong", async () => {
    await show("Это **важно");
    expect(container.textContent).toBe("Это **важно");
    expect(all("strong")).toHaveLength(0);
  });

  it("когда ** закрылось на следующем фрагменте, текст становится жирным", async () => {
    await show("Это **важно");
    expect(all("strong")).toHaveLength(0);
    await show("Это **важно** для вас");
    expect(texts("strong")).toEqual(["важно"]);
    expect(container.textContent).toBe("Это важно для вас");
  });

  it("обрыв посреди списка: пункты есть, последний недописан, ничего не падает", async () => {
    await show("Пункты:\n- первый\n- второй\n- тре");
    expect(texts("li")).toEqual(["первый", "второй", "тре"]);
    expect(all("ul")).toHaveLength(1);
  });

  it("обрыв посреди жирного в пункте списка: ** видно буквально", async () => {
    await show("- **Солнце** в Рыбах\n- **Лу");
    expect(texts("li")).toEqual(["Солнце в Рыбах", "**Лу"]);
    expect(texts("li > strong")).toEqual(["Солнце"]);
  });

  it("обрыв посреди ссылки не создаёт a и не падает", async () => {
    await show("Смотрите [подробнее](http://evil.ex");
    expect(all("a")).toHaveLength(0);
    expectOnlySafeMarkup();
  });

  it.each(["-", "- ", "1.", "1. ", "#", "# ", "**", "****", "*", "__", "`", "```", "[", "[]()", "---"])(
    "обрыв на «%s» не падает и не рисует опасных тегов", async fragment => {
      await show(`Начало\n\n${fragment}`);
      expect(container.textContent).toContain("Начало");
      expectOnlySafeMarkup();
    });

  it("одинокие звёздочки в тексте («2 * 3 * 4») остаются буквально", async () => {
    await show("Умножение: 2 * 3 * 4 = 24.");
    expect(container.textContent).toBe("Умножение: 2 * 3 * 4 = 24.");
    expect(all("em, strong")).toHaveLength(0);
  });

  it("одна звёздочка без пары остаётся буквально", async () => {
    await show("Это важно* и всё.");
    expect(container.textContent).toBe("Это важно* и всё.");
    expect(all("em, strong")).toHaveLength(0);
  });

  it("подчёркивания внутри слов не делают курсив", async () => {
    await show("Поле first_second_third в тексте.");
    expect(container.textContent).toBe("Поле first_second_third в тексте.");
    expect(all("em, strong")).toHaveLength(0);
  });

  it("очень длинный текст с незакрытой разметкой разбирается быстро (нет катастрофического разбора)", async () => {
    const started = performance.now();
    await show("**а ".repeat(5000));
    await show("*".repeat(20000));
    await show("[т](".repeat(4000));
    await show("- **x\n".repeat(3000));
    expect(performance.now() - started).toBeLessThan(3000);
  });
});

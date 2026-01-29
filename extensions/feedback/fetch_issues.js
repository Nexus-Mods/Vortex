const cf = require("cross-fetch");
const fs = require("fs-extra");

const WIKI_URL = "https://wiki.nexusmods.com";
const REPO_URL = "https://api.github.com/repos/Nexus-Mods/Vortex";

async function fetchWikiCategory(name) {
  const res = await cf(
    `${WIKI_URL}/api.php?action=query&list=categorymembers&cmtitle=Category:${name}&cmlimit=500&format=json`,
  );
  const data = await res.json();

  return await data.query.categorymembers.reduce(async (prev, member) => {
    if (member.title.startsWith("File:")) {
      return await prev;
    } else if (member.title.startsWith("Category:")) {
      return [].concat(
        await prev,
        await fetchWikiCategory(member.title.split(":")[1]),
      );
    } else {
      return [].concat(await prev, [member.title]);
    }
  }, []);
}

async function fetchFAQ() {
  const res = await cf(
    `${WIKI_URL}/api.php?action=parse&page=Frequently_Asked_Questions&format=json&prop=sections`,
  );
  const data = await res.json();
  return data.parse.sections.filter((faq) => faq.line !== undefined);
}

async function fetchIssues() {
  const res = await cf(`${REPO_URL}/issues?filter=all&labels=reference`);
  return await res.json();
}

function transformWikiPages(page, keywords) {
  return {
    type: "wiki",
    title: page,
    url: `${WIKI_URL}/index.php/${page.replace(/ /g, "_")}`,
    keywords: keywords[page] || [],
  };
}

function transformFAQ(faq, keywords) {
  return {
    type: "faq",
    title: faq.line,
    url: `${WIKI_URL}/index.php/Frequently_Asked_Questions#${faq.anchor}`,
    keywords: keywords[faq.line] || [],
  };
}

function transformIssue(issue, keywords) {
  return {
    type: "issue",
    title: issue.title,
    url: issue.html_url,
    keywords: keywords[issue.title] || [],
  };
}

function makeUniqueByKey(input, key) {
  return Object.values(
    input.reduce((prev, item) => {
      prev[key(item)] = item;
      return prev;
    }, {}),
  );
}

async function main() {
  const keywords = JSON.parse(await fs.readFile("keywords.json"));
  const wiki = makeUniqueByKey(
    (await fetchWikiCategory("Vortex")).map((w) =>
      transformWikiPages(w, keywords),
    ),
    (w) => w.title,
  );
  const faq = (await fetchFAQ()).map((f) => transformFAQ(f, keywords));
  const issues = (await fetchIssues()).map((i) => transformIssue(i, keywords));

  await fs.writeFile(
    "issues.json",
    JSON.stringify([...wiki, ...faq, ...issues], undefined, 2),
  );
}

main();

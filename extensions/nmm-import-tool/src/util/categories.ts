import Promise from 'bluebird';
import { fs } from 'vortex-api';

function parseCategories(data: string): { [id: string]: string } {
  const parser = new DOMParser();

  const xmlDoc = parser.parseFromString(data, 'text/xml');

  const categories = xmlDoc.querySelectorAll('categoryManager categoryList category');
  const items = [...Array(categories.length).keys()].map(i => categories.item(i));

  return items.reduce((prev: { [id: string]: string }, item) => {
    const categoryName = item.getElementsByTagName('name')[0].textContent;
    if (categoryName !== 'Unassigned') {
      // Ignore the "Unassigned" category.
      prev[item.getAttribute('ID')] = categoryName;
    }

    return prev;
  }, {});
}

export function getCategories(categoriesPath: string): Promise<{ [id: string]: string }> {
  return fs.readFileAsync(categoriesPath)
    .then(data => {
      if (data.compare(Buffer.from([0xEF, 0xBB, 0xBF]), 0, 3, 0, 3) === 0) {
        data = data.slice(3);
      }
      return parseCategories(data.toString('utf-8'));
    });
}

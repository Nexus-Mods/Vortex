
/**
 * generate the category's subtitle
 * 
 * @param {string} rootId
 * @param {any} mods
 * @return {string}
 */

function generateSubtitle(rootId: string, mods: any) {
  let modsCount = Object.keys(mods).filter((id: string) => {
    if (mods[id].attributes.category !== undefined) {
      if (mods[id].attributes.category.toString() === rootId) {
        return id;
      }
    }
  });

  if (modsCount.length === 0) {
    return '';
  } else {
    return modsCount.length === 1 ? modsCount.length + ' mod installed' :
      modsCount.length + ' mods installed';
  }
}

export default generateSubtitle;

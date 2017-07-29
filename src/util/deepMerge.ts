function pick(lhs: any, rhs: any): any {
  return lhs === undefined ? rhs : lhs;
}

/**
 * very simplistic deep merge.
 *
 * @param {*} lhs
 * @param {*} rhs
 * @returns {*}
 */
function deepMerge(lhs: any, rhs: any): any {
  if (lhs === undefined) {
    return rhs;
  } else if (rhs === undefined) {
    return lhs;
  }

  const result = {};
  for (const key of Object.keys(lhs).concat(Object.keys(rhs))) {
    if ((lhs[key] === undefined) || (rhs[key] === undefined)) {
      result[key] = pick(lhs[key], rhs[key]);
    }

    result[key] = ((typeof(lhs[key]) === 'object') && (typeof(rhs[key]) === 'object'))
      ? result[key] = deepMerge(lhs[key], rhs[key])
      : (Array.isArray(lhs[key]) && Array.isArray(rhs[key]))
        ? result[key] = lhs[key].concat(rhs[key])
        : result[key] = pick(rhs[key], lhs[key]);
  }
  return result;
}

export default deepMerge;
